use std::error::Error;
use std::io::{Read, Seek, SeekFrom};
use std::time::Duration;

use crate::logger;

// Drive requires chunks to be a multiple of 256 KiB. 8 MiB keeps each PUT
// short enough to retry cheaply while still being big enough to amortize
// TLS/HTTP overhead across a multi-GB upload (Sims saves routinely hit
// several GB).
const CHUNK_SIZE: u64 = 8 * 1024 * 1024;
const MAX_RETRIES: u32 = 5;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
const MAX_ERROR_CHAIN_DEPTH: usize = 16;

#[derive(Debug, serde::Serialize)]
pub struct UploadFileResult {
    pub file_id: String,
}

#[derive(serde::Deserialize)]
struct DriveFile {
    id: String,
}

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

// ---------------------------------------------------------------------------
// Pure helpers (network-free, trivially unit-testable)
// ---------------------------------------------------------------------------

/// Walks `Error::source()` so logs show the underlying hyper/IO cause instead
/// of just the top-level reqwest message. Depth-bounded so a pathological
/// error that lists itself as its own source can't loop forever.
fn format_error_chain(err: &(dyn Error + 'static)) -> String {
    let mut out = err.to_string();
    let mut source = err.source();
    let mut depth = 0;
    while let Some(cause) = source {
        if depth >= MAX_ERROR_CHAIN_DEPTH {
            out.push_str(" -> (chain truncated)");
            break;
        }
        out.push_str(" -> ");
        out.push_str(&cause.to_string());
        source = cause.source();
        depth += 1;
    }
    out
}

/// Inclusive (start, end) bounds of the next chunk. Caller must ensure
/// `start < file_size`.
fn chunk_bounds(start: u64, file_size: u64) -> (u64, u64) {
    let end = std::cmp::min(start + CHUNK_SIZE, file_size) - 1;
    (start, end)
}

/// Exponential backoff capped at 30 s so MAX_RETRIES stays bounded in time.
fn backoff_for(attempt: u32) -> Duration {
    let shifted = 1u64.checked_shl(attempt).unwrap_or(u64::MAX);
    Duration::from_secs(std::cmp::min(shifted, 30))
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
                "Failed to parse completion response body: {body}"
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

    ChunkResponse::Failed(format!("Upload failed: HTTP {status} {body}"))
}

/// Interprets a status query response. Missing `Range` on 308 means Drive
/// has received zero bytes — a valid state, not an error.
fn interpret_status_query(
    status: u16,
    range_header: Option<&str>,
    body: &str,
) -> Result<UploadStatus, String> {
    if (200..300).contains(&status) {
        let data: DriveFile = serde_json::from_str(body)
            .map_err(|e| format!("Failed to parse completion response: {e}"))?;
        return Ok(UploadStatus::Complete(data.id));
    }

    if status != 308 {
        return Err(format!("Unexpected status during status query: HTTP {status} {body}"));
    }

    let Some(header) = range_header else {
        return Ok(UploadStatus::Incomplete(0));
    };
    let Some(last) = parse_range_end(header) else {
        return Err(format!("Malformed Range header from status query: {header}"));
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
            return Err(format!(
                "Upload failed after {MAX_RETRIES} retries: {send_err}"
            ));
        }
        let backoff = backoff_for(attempt);
        logger::error(&format!(
            "drive_upload: chunk {chunk_start}-{chunk_end} error (attempt {attempt}/{MAX_RETRIES}): {send_err}; retrying in {}s",
            backoff.as_secs()
        ));
        std::thread::sleep(backoff);

        if let Some(outcome) = resync_after_failure(client, upload_url, file_size, chunk_start) {
            return Ok(outcome);
        }
        // Server is at the same position; retry the same chunk.
    }
}

/// Queries Drive after a network failure to decide whether to keep retrying
/// this chunk, advance past it, or short-circuit on a completed upload.
/// Returns `Some(outcome)` to stop retrying this chunk, `None` to retry it.
/// A failed status query is logged and converted to a retry.
fn resync_after_failure(
    client: &reqwest::blocking::Client,
    upload_url: &str,
    file_size: u64,
    start: u64,
) -> Option<UploadOutcome> {
    let status = match query_upload_status(client, upload_url, file_size) {
        Ok(status) => status,
        Err(e) => {
            logger::error(&format!(
                "drive_upload: status query failed: {e}; retrying same chunk"
            ));
            return None;
        }
    };

    match status {
        UploadStatus::Complete(id) => {
            logger::info(&format!("drive_upload: completed during retry, file_id={id}"));
            Some(UploadOutcome::Completed(UploadFileResult { file_id: id }))
        }
        UploadStatus::Incomplete(pos) if pos != start => {
            logger::info(&format!(
                "drive_upload: resyncing, server has {pos} of {file_size}"
            ));
            Some(UploadOutcome::Advanced(pos))
        }
        UploadStatus::Incomplete(_) => None,
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
) -> Result<UploadStatus, String> {
    let res = client
        .put(upload_url)
        .header("Content-Length", "0")
        .header("Content-Range", format!("bytes */{file_size}"))
        .send()
        .map_err(|e| format!("Status query failed: {}", format_error_chain(&e)))?;

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
    use std::fmt;

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

    // --- backoff_for ---

    #[test]
    fn backoff_grows_exponentially_until_cap() {
        assert_eq!(backoff_for(1), Duration::from_secs(2));
        assert_eq!(backoff_for(2), Duration::from_secs(4));
        assert_eq!(backoff_for(3), Duration::from_secs(8));
        assert_eq!(backoff_for(4), Duration::from_secs(16));
    }

    #[test]
    fn backoff_is_capped_at_30_seconds() {
        assert_eq!(backoff_for(5), Duration::from_secs(30));
        assert_eq!(backoff_for(10), Duration::from_secs(30));
        assert_eq!(backoff_for(63), Duration::from_secs(30));
    }

    #[test]
    fn backoff_handles_oversized_attempt_without_panic() {
        // 1u64 << 64 would panic; checked_shl saturates to u64::MAX.
        assert_eq!(backoff_for(200), Duration::from_secs(30));
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
    fn status_query_unexpected_status_errors() {
        let result = interpret_status_query(500, None, "internal error");
        assert!(result.is_err());
    }

    #[test]
    fn status_query_308_malformed_range_errors() {
        let result = interpret_status_query(308, Some("garbage"), "");
        assert!(result.is_err());
    }

    // --- format_error_chain ---

    #[derive(Debug)]
    struct ChainErr {
        msg: &'static str,
        source: Option<Box<dyn Error + 'static>>,
    }

    impl fmt::Display for ChainErr {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.msg)
        }
    }

    impl Error for ChainErr {
        fn source(&self) -> Option<&(dyn Error + 'static)> {
            self.source.as_deref()
        }
    }

    #[test]
    fn error_chain_single_error() {
        let err = ChainErr { msg: "top", source: None };
        assert_eq!(format_error_chain(&err), "top");
    }

    #[test]
    fn error_chain_walks_all_sources() {
        let err = ChainErr {
            msg: "top",
            source: Some(Box::new(ChainErr {
                msg: "middle",
                source: Some(Box::new(ChainErr {
                    msg: "bottom",
                    source: None,
                })),
            })),
        };
        assert_eq!(format_error_chain(&err), "top -> middle -> bottom");
    }

    #[test]
    fn error_chain_is_bounded_by_max_depth() {
        let mut err = ChainErr { msg: "leaf", source: None };
        for _ in 0..(MAX_ERROR_CHAIN_DEPTH + 10) {
            err = ChainErr { msg: "link", source: Some(Box::new(err)) };
        }
        let formatted = format_error_chain(&err);
        assert!(formatted.contains("truncated"));
    }
}
