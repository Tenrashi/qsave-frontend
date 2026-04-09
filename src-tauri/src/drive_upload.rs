use std::io::{Read, Seek, SeekFrom};
use std::time::Duration;

use crate::drive_common::{backoff_for, format_error_chain, is_retryable_status, truncate_body};
use crate::logger;

// Drive requires chunks to be a multiple of 256 KiB. 8 MiB keeps each PUT
// short enough to retry cheaply while still being big enough to amortize
// TLS/HTTP overhead across a multi-GB upload (Sims saves routinely hit
// several GB).
const CHUNK_SIZE: u64 = 8 * 1024 * 1024;
const MAX_RETRIES: u32 = 5;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Debug, serde::Serialize)]
pub struct UploadFileResult {
    pub file_id: String,
}

#[derive(serde::Deserialize)]
struct DriveFile {
    id: String,
}

#[derive(Debug)]
enum UploadStatus {
    Incomplete(u64),
    Complete(String),
}

enum UploadOutcome {
    Advanced(u64),
    Completed(UploadFileResult),
}

/// Result of interpreting a chunk PUT response. Pure data so that the
/// network-free logic can be unit tested.
#[derive(Debug)]
enum ChunkResponse {
    Complete(String),
    Incomplete(u64),
    Failed(String),
}

/// What `resync_after_failure` decided to do after querying Drive for the
/// upload's current position. `Retry` carries an optional query error so
/// persistent status query failures surface in the final error message
/// rather than being silently swallowed. `Fatal` short-circuits the retry
/// loop when the status query itself returns a permanent error (e.g. a
/// 401 from a revoked token) — retrying a permanent error just burns the
/// retry budget before surfacing what was already a non-recoverable state.
enum ResyncDecision {
    Stop(UploadOutcome),
    Fatal(String),
    Retry { query_error: Option<String> },
}

/// Error returned by the status-query path. `permanent == true` means the
/// retry loop must stop — the most common trigger is a 4xx HTTP response,
/// where retrying won't change the outcome.
#[derive(Debug)]
struct StatusQueryError {
    permanent: bool,
    message: String,
}

impl StatusQueryError {
    fn permanent(message: impl Into<String>) -> Self {
        Self {
            permanent: true,
            message: message.into(),
        }
    }

    fn transient(message: impl Into<String>) -> Self {
        Self {
            permanent: false,
            message: message.into(),
        }
    }
}

// ---------------------------------------------------------------------------
// Pure helpers (network-free, trivially unit-testable)
// ---------------------------------------------------------------------------

/// Formats the error returned when a chunk's retry budget is exhausted.
/// Appends the most recent status query error (if any) so the user sees
/// both the send failure and any repeated inability to query progress.
fn format_retry_exhausted(send_err: &str, last_query_error: Option<&str>) -> String {
    let mut msg = format!("Upload failed after {MAX_RETRIES} retries: {send_err}");
    if let Some(query_err) = last_query_error {
        msg.push_str(&format!(" (last status query error: {query_err})"));
    }
    msg
}

/// Inclusive (start, end) bounds of the next chunk. Caller must ensure
/// `start < file_size`.
fn chunk_bounds(start: u64, file_size: u64) -> (u64, u64) {
    let end = std::cmp::min(start + CHUNK_SIZE, file_size) - 1;
    (start, end)
}

/// Parses the `Range: bytes=0-<last>` header Drive returns on 308 responses.
fn parse_range_end(range_header: &str) -> Option<u64> {
    let stripped = range_header.strip_prefix("bytes=")?;
    let (_, end) = stripped.split_once('-')?;
    end.parse().ok()
}

/// Interprets a chunk PUT response. A 308 without a `Range` header is
/// treated as a hard failure: Drive is telling us zero bytes were accepted,
/// and silently advancing past un-uploaded data would corrupt the upload.
fn interpret_chunk_response(
    status: u16,
    range_header: Option<&str>,
    body: &str,
) -> ChunkResponse {
    if (200..300).contains(&status) {
        let Ok(data) = serde_json::from_str::<DriveFile>(body) else {
            return ChunkResponse::Failed(format!(
                "Failed to parse completion response body: {}",
                truncate_body(body)
            ));
        };
        return ChunkResponse::Complete(data.id);
    }

    if status == 308 {
        let Some(header) = range_header else {
            return ChunkResponse::Failed(
                "Drive returned 308 without Range header; refusing to advance".to_string(),
            );
        };
        let Some(last) = parse_range_end(header) else {
            return ChunkResponse::Failed(format!(
                "Drive returned 308 with malformed Range header: {header}"
            ));
        };
        return ChunkResponse::Incomplete(last + 1);
    }

    ChunkResponse::Failed(format!(
        "Upload failed: HTTP {status} {}",
        truncate_body(body)
    ))
}

/// Interprets a status query response. Missing `Range` on 308 means Drive
/// has received zero bytes — a valid state, not an error. Unexpected HTTP
/// statuses are classified as permanent vs transient so the retry loop
/// can short-circuit on e.g. a 401 from a revoked token.
fn interpret_status_query(
    status: u16,
    range_header: Option<&str>,
    body: &str,
) -> Result<UploadStatus, StatusQueryError> {
    if (200..300).contains(&status) {
        let data: DriveFile = serde_json::from_str(body).map_err(|e| {
            // A malformed success body is rare but is worth another try —
            // the server may have glitched mid-response.
            StatusQueryError::transient(format!("Failed to parse completion response: {e}"))
        })?;
        return Ok(UploadStatus::Complete(data.id));
    }

    if status != 308 {
        let message = format!(
            "Unexpected status during status query: HTTP {status} {}",
            truncate_body(body)
        );
        return Err(if is_retryable_status(status) {
            StatusQueryError::transient(message)
        } else {
            StatusQueryError::permanent(message)
        });
    }

    let Some(header) = range_header else {
        return Ok(UploadStatus::Incomplete(0));
    };
    let Some(last) = parse_range_end(header) else {
        return Err(StatusQueryError::transient(format!(
            "Malformed Range header from status query: {header}"
        )));
    };
    Ok(UploadStatus::Incomplete(last + 1))
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

pub fn upload_file_resumable(
    file_path: &str,
    upload_url: &str,
) -> Result<UploadFileResult, String> {
    let mut file = std::fs::File::open(file_path)
        .map_err(|e| format!("Failed to open {file_path}: {e}"))?;
    let file_size = file
        .metadata()
        .map_err(|e| format!("Failed to read file size for {file_path}: {e}"))?
        .len();
    logger::info(&format!(
        "drive_upload: {file_size} bytes, chunk size {CHUNK_SIZE}"
    ));

    let client = reqwest::blocking::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", format_error_chain(&e)))?;

    if file_size == 0 {
        return finalize_empty_upload(&client, upload_url, file_path);
    }

    let mut start: u64 = 0;
    while start < file_size {
        match upload_one_chunk(&client, upload_url, &mut file, start, file_size)? {
            UploadOutcome::Completed(result) => {
                let _ = std::fs::remove_file(file_path);
                logger::info(&format!("drive_upload: success, file_id={}", result.file_id));
                return Ok(result);
            }
            UploadOutcome::Advanced(next) => {
                start = next;
            }
        }
    }

    Err("Upload loop ended without a completion response".to_string())
}

// ---------------------------------------------------------------------------
// Single-chunk upload with retry + resync
// ---------------------------------------------------------------------------

fn upload_one_chunk(
    client: &reqwest::blocking::Client,
    upload_url: &str,
    file: &mut std::fs::File,
    start: u64,
    file_size: u64,
) -> Result<UploadOutcome, String> {
    let (chunk_start, chunk_end) = chunk_bounds(start, file_size);
    let chunk_len = chunk_end - chunk_start + 1;
    let buf = read_chunk(file, chunk_start, chunk_len)?;
    // Drive takes Content-Type from the initial `X-Upload-Content-Type`
    // header set by the frontend during session init, so chunk PUTs only
    // need Content-Length and Content-Range.
    let range_header = format!("bytes {chunk_start}-{chunk_end}/{file_size}");

    let mut attempt: u32 = 0;
    let mut last_query_error: Option<String> = None;
    loop {
        let send_result = client
            .put(upload_url)
            .header("Content-Length", chunk_len.to_string())
            .header("Content-Range", &range_header)
            .body(buf.clone())
            .send();

        let send_err = match send_result {
            Ok(res) => return finalize_chunk_response(res, chunk_start, chunk_end),
            Err(e) => format_error_chain(&e),
        };

        attempt += 1;
        if attempt > MAX_RETRIES {
            return Err(format_retry_exhausted(&send_err, last_query_error.as_deref()));
        }
        let backoff = backoff_for(attempt);
        logger::error(&format!(
            "drive_upload: chunk {chunk_start}-{chunk_end} error (attempt {attempt}/{MAX_RETRIES}): {send_err}; retrying in {}s",
            backoff.as_secs()
        ));
        std::thread::sleep(backoff);

        match resync_after_failure(client, upload_url, file_size, chunk_start) {
            ResyncDecision::Stop(outcome) => return Ok(outcome),
            ResyncDecision::Fatal(err) => {
                return Err(format!(
                    "Upload aborted after status query returned a permanent error: {err} (last send error: {send_err})"
                ));
            }
            ResyncDecision::Retry { query_error: Some(err) } => {
                last_query_error = Some(err);
            }
            ResyncDecision::Retry { query_error: None } => {}
        }
    }
}

/// Queries Drive after a network failure to decide whether to keep retrying
/// this chunk, advance past it, short-circuit on a completed upload, or
/// bail out entirely. A transient query failure is logged and converted
/// to `Retry` carrying the query error, so persistent transient failures
/// surface in the final error message instead of being silently swallowed.
/// A permanent query failure (e.g. a 401 from a revoked token) returns
/// `Fatal` so the caller can stop wasting retries on a non-recoverable
/// state.
fn resync_after_failure(
    client: &reqwest::blocking::Client,
    upload_url: &str,
    file_size: u64,
    start: u64,
) -> ResyncDecision {
    let status = match query_upload_status(client, upload_url, file_size) {
        Ok(status) => status,
        Err(e) if e.permanent => {
            logger::error(&format!(
                "drive_upload: status query returned permanent error: {}; aborting",
                e.message
            ));
            return ResyncDecision::Fatal(e.message);
        }
        Err(e) => {
            logger::error(&format!(
                "drive_upload: status query failed: {}; retrying same chunk",
                e.message
            ));
            return ResyncDecision::Retry {
                query_error: Some(e.message),
            };
        }
    };

    match status {
        UploadStatus::Complete(id) => {
            logger::info(&format!("drive_upload: completed during retry, file_id={id}"));
            ResyncDecision::Stop(UploadOutcome::Completed(UploadFileResult { file_id: id }))
        }
        UploadStatus::Incomplete(pos) if pos != start => {
            logger::info(&format!(
                "drive_upload: resyncing, server has {pos} of {file_size}"
            ));
            ResyncDecision::Stop(UploadOutcome::Advanced(pos))
        }
        UploadStatus::Incomplete(_) => ResyncDecision::Retry { query_error: None },
    }
}

fn finalize_chunk_response(
    res: reqwest::blocking::Response,
    start: u64,
    end: u64,
) -> Result<UploadOutcome, String> {
    let status = res.status().as_u16();
    let range_header = res
        .headers()
        .get("Range")
        .and_then(|h| h.to_str().ok())
        .map(str::to_string);
    let body = res.text().unwrap_or_default();

    match interpret_chunk_response(status, range_header.as_deref(), &body) {
        ChunkResponse::Complete(id) => {
            logger::info(&format!(
                "drive_upload: chunk {start}-{end} finalized upload, file_id={id}"
            ));
            Ok(UploadOutcome::Completed(UploadFileResult { file_id: id }))
        }
        ChunkResponse::Incomplete(next) => {
            logger::info(&format!(
                "drive_upload: chunk {start}-{end} accepted, next={next}"
            ));
            Ok(UploadOutcome::Advanced(next))
        }
        ChunkResponse::Failed(msg) => Err(msg),
    }
}

fn query_upload_status(
    client: &reqwest::blocking::Client,
    upload_url: &str,
    file_size: u64,
) -> Result<UploadStatus, StatusQueryError> {
    let res = client
        .put(upload_url)
        .header("Content-Length", "0")
        .header("Content-Range", format!("bytes */{file_size}"))
        .send()
        .map_err(|e| {
            // Network/connect failures are always transient — retrying
            // the chunk is still the right call.
            StatusQueryError::transient(format!(
                "Status query failed: {}",
                format_error_chain(&e)
            ))
        })?;

    let status = res.status().as_u16();
    let range_header = res
        .headers()
        .get("Range")
        .and_then(|h| h.to_str().ok())
        .map(str::to_string);
    let body = res.text().unwrap_or_default();

    interpret_status_query(status, range_header.as_deref(), &body)
}

fn read_chunk(file: &mut std::fs::File, start: u64, len: u64) -> Result<Vec<u8>, String> {
    file.seek(SeekFrom::Start(start))
        .map_err(|e| format!("Failed to seek to {start}: {e}"))?;
    let mut buf = vec![0u8; len as usize];
    file.read_exact(&mut buf)
        .map_err(|e| format!("Failed to read {len} bytes at {start}: {e}"))?;
    Ok(buf)
}

fn finalize_empty_upload(
    client: &reqwest::blocking::Client,
    upload_url: &str,
    file_path: &str,
) -> Result<UploadFileResult, String> {
    // Drive finalizes a zero-byte resumable session with an explicit
    // `Content-Range: bytes */0`; Content-Length: 0 alone is ambiguous.
    let res = client
        .put(upload_url)
        .header("Content-Length", "0")
        .header("Content-Range", "bytes */0")
        .body(Vec::<u8>::new())
        .send()
        .map_err(|e| format!("Upload failed: {}", format_error_chain(&e)))?;

    let status = res.status();
    if !status.is_success() {
        let body = res.text().unwrap_or_default();
        return Err(format!("Upload failed: {status} {body}"));
    }

    let data: DriveFile = res
        .json()
        .map_err(|e| format!("Failed to parse response: {}", format_error_chain(&e)))?;
    let _ = std::fs::remove_file(file_path);
    logger::info(&format!("drive_upload: success (empty), file_id={}", data.id));
    Ok(UploadFileResult { file_id: data.id })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::drive_common::MAX_BODY_IN_ERROR;

    // --- parse_range_end ---

    #[test]
    fn parse_range_end_valid() {
        assert_eq!(parse_range_end("bytes=0-524287"), Some(524287));
    }

    #[test]
    fn parse_range_end_zero() {
        assert_eq!(parse_range_end("bytes=0-0"), Some(0));
    }

    #[test]
    fn parse_range_end_rejects_missing_prefix() {
        assert_eq!(parse_range_end("0-100"), None);
    }

    #[test]
    fn parse_range_end_rejects_missing_separator() {
        assert_eq!(parse_range_end("bytes=100"), None);
    }

    #[test]
    fn parse_range_end_rejects_non_numeric() {
        assert_eq!(parse_range_end("bytes=0-abc"), None);
    }

    // --- chunk_bounds ---

    #[test]
    fn chunk_bounds_full_chunk_at_start() {
        let (start, end) = chunk_bounds(0, CHUNK_SIZE * 3);
        assert_eq!(start, 0);
        assert_eq!(end, CHUNK_SIZE - 1);
    }

    #[test]
    fn chunk_bounds_last_partial_chunk() {
        let file_size = CHUNK_SIZE + 1000;
        let (start, end) = chunk_bounds(CHUNK_SIZE, file_size);
        assert_eq!(start, CHUNK_SIZE);
        assert_eq!(end, file_size - 1);
    }

    #[test]
    fn chunk_bounds_single_small_chunk_file() {
        let (start, end) = chunk_bounds(0, 1000);
        assert_eq!(start, 0);
        assert_eq!(end, 999);
    }

    #[test]
    fn chunk_bounds_exact_multiple_last_chunk() {
        let file_size = CHUNK_SIZE * 2;
        let (_, end) = chunk_bounds(CHUNK_SIZE, file_size);
        assert_eq!(end, file_size - 1);
    }

    // --- interpret_chunk_response ---

    #[test]
    fn chunk_response_200_parses_file_id() {
        let body = r#"{"id":"abc123"}"#;
        let ChunkResponse::Complete(id) = interpret_chunk_response(200, None, body) else {
            panic!("expected Complete");
        };
        assert_eq!(id, "abc123");
    }

    #[test]
    fn chunk_response_201_parses_file_id() {
        let body = r#"{"id":"xyz789"}"#;
        let ChunkResponse::Complete(id) = interpret_chunk_response(201, None, body) else {
            panic!("expected Complete");
        };
        assert_eq!(id, "xyz789");
    }

    #[test]
    fn chunk_response_308_advances_from_range_header() {
        let ChunkResponse::Incomplete(next) =
            interpret_chunk_response(308, Some("bytes=0-524287"), "")
        else {
            panic!("expected Incomplete");
        };
        assert_eq!(next, 524288);
    }

    #[test]
    fn chunk_response_308_without_range_header_fails_loudly() {
        let ChunkResponse::Failed(msg) = interpret_chunk_response(308, None, "") else {
            panic!("expected Failed");
        };
        assert!(msg.contains("308 without Range"));
    }

    #[test]
    fn chunk_response_308_with_malformed_range_fails() {
        let ChunkResponse::Failed(msg) = interpret_chunk_response(308, Some("not-a-range"), "")
        else {
            panic!("expected Failed");
        };
        assert!(msg.contains("malformed Range"));
    }

    #[test]
    fn chunk_response_4xx_is_failure_with_body() {
        let ChunkResponse::Failed(msg) = interpret_chunk_response(403, None, "forbidden") else {
            panic!("expected Failed");
        };
        assert!(msg.contains("403"));
        assert!(msg.contains("forbidden"));
    }

    #[test]
    fn chunk_response_success_with_malformed_json_fails() {
        let ChunkResponse::Failed(msg) = interpret_chunk_response(200, None, "not json") else {
            panic!("expected Failed");
        };
        assert!(msg.contains("parse"));
    }

    // --- interpret_status_query ---

    #[test]
    fn status_query_complete_parses_id() {
        let body = r#"{"id":"done"}"#;
        let UploadStatus::Complete(id) = interpret_status_query(200, None, body).unwrap() else {
            panic!("expected Complete");
        };
        assert_eq!(id, "done");
    }

    #[test]
    fn status_query_308_with_range_returns_next_byte() {
        let UploadStatus::Incomplete(next) =
            interpret_status_query(308, Some("bytes=0-99"), "").unwrap()
        else {
            panic!("expected Incomplete");
        };
        assert_eq!(next, 100);
    }

    #[test]
    fn status_query_308_without_range_reports_zero_received() {
        let UploadStatus::Incomplete(next) = interpret_status_query(308, None, "").unwrap() else {
            panic!("expected Incomplete");
        };
        assert_eq!(next, 0);
    }

    #[test]
    fn status_query_5xx_is_transient_error() {
        let err = interpret_status_query(500, None, "internal error").unwrap_err();
        assert!(!err.permanent);
        assert!(err.message.contains("500"));
    }

    #[test]
    fn status_query_503_is_transient_error() {
        let err = interpret_status_query(503, None, "busy").unwrap_err();
        assert!(!err.permanent);
    }

    #[test]
    fn status_query_429_is_transient_error() {
        let err = interpret_status_query(429, None, "slow down").unwrap_err();
        assert!(!err.permanent);
    }

    #[test]
    fn status_query_401_is_permanent_error() {
        let err = interpret_status_query(401, None, "unauthorized").unwrap_err();
        assert!(err.permanent);
        assert!(err.message.contains("401"));
    }

    #[test]
    fn status_query_403_is_permanent_error() {
        let err = interpret_status_query(403, None, "forbidden").unwrap_err();
        assert!(err.permanent);
    }

    #[test]
    fn status_query_404_is_permanent_error() {
        let err = interpret_status_query(404, None, "gone").unwrap_err();
        assert!(err.permanent);
    }

    #[test]
    fn status_query_308_malformed_range_is_transient_error() {
        let err = interpret_status_query(308, Some("garbage"), "").unwrap_err();
        // Malformed range is weird but not necessarily fatal — retry may
        // help if the server glitched mid-response.
        assert!(!err.permanent);
    }

    // --- format_retry_exhausted ---

    #[test]
    fn retry_exhausted_without_query_error() {
        let msg = format_retry_exhausted("connection reset", None);
        assert!(msg.contains(&format!("after {MAX_RETRIES} retries")));
        assert!(msg.contains("connection reset"));
        assert!(!msg.contains("status query error"));
    }

    #[test]
    fn retry_exhausted_includes_last_query_error() {
        let msg = format_retry_exhausted(
            "connection reset",
            Some("Status query failed: 401 Unauthorized"),
        );
        assert!(msg.contains("connection reset"));
        assert!(msg.contains("last status query error"));
        assert!(msg.contains("401 Unauthorized"));
    }

    // --- interpret_chunk_response body truncation ---

    #[test]
    fn chunk_response_4xx_truncates_huge_body() {
        let huge_body = "x".repeat(MAX_BODY_IN_ERROR * 4);
        let ChunkResponse::Failed(msg) = interpret_chunk_response(500, None, &huge_body) else {
            panic!("expected Failed");
        };
        assert!(msg.len() < huge_body.len() + 200);
        assert!(msg.contains("bytes total"));
    }

    #[test]
    fn chunk_response_malformed_json_truncates_huge_body() {
        let huge_body = format!("not json: {}", "x".repeat(MAX_BODY_IN_ERROR * 4));
        let ChunkResponse::Failed(msg) = interpret_chunk_response(200, None, &huge_body) else {
            panic!("expected Failed");
        };
        assert!(msg.len() < huge_body.len() + 200);
        assert!(msg.contains("bytes total"));
    }

    #[test]
    fn status_query_unexpected_status_truncates_huge_body() {
        let huge_body = "x".repeat(MAX_BODY_IN_ERROR * 4);
        let err = interpret_status_query(500, None, &huge_body).unwrap_err();
        assert!(err.message.len() < huge_body.len() + 200);
        assert!(err.message.contains("bytes total"));
    }
}
