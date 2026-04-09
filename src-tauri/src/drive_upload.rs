use std::error::Error;
use std::io::{Read, Seek, SeekFrom};
use std::time::Duration;

use crate::logger;

// Drive requires chunks to be a multiple of 256 KiB. 8 MiB keeps each PUT short
// enough to retry cheaply while still being big enough to amortize TLS/HTTP
// overhead across a multi-GB upload (Sims saves routinely hit several GB).
const CHUNK_SIZE: u64 = 8 * 1024 * 1024;
const MAX_RETRIES: u32 = 5;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);

// reqwest/hyper errors carry the real cause on `source()`. The default Display
// only prints the top-level message ("error sending request for url ..."),
// which is useless for diagnosis. Walk the chain so logs show the I/O error,
// stream reset, TLS failure, etc. underneath.
fn format_error_chain(err: &(dyn Error + 'static)) -> String {
    let mut out = err.to_string();
    let mut source = err.source();
    while let Some(cause) = source {
        out.push_str(" -> ");
        out.push_str(&cause.to_string());
        source = cause.source();
    }
    out
}

fn format_reqwest_error(err: reqwest::Error) -> String {
    format_error_chain(&err)
}

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
        "upload_file: {file_size} bytes, chunk size {CHUNK_SIZE}"
    ));

    let client = reqwest::blocking::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", format_reqwest_error(e)))?;

    if file_size == 0 {
        return finalize_empty_upload(&client, upload_url, file_path);
    }

    let mut start: u64 = 0;
    while start < file_size {
        let next_start = upload_one_chunk(&client, upload_url, &mut file, start, file_size)?;
        if let UploadOutcome::Completed(result) = next_start {
            let _ = std::fs::remove_file(file_path);
            logger::info(&format!("upload_file: success, file_id={}", result.file_id));
            return Ok(result);
        }
        let UploadOutcome::Advanced(next) = next_start else { unreachable!() };
        start = next;
    }

    Err("Upload loop ended without a completion response".to_string())
}

enum UploadOutcome {
    Advanced(u64),
    Completed(UploadFileResult),
}

fn upload_one_chunk(
    client: &reqwest::blocking::Client,
    upload_url: &str,
    file: &mut std::fs::File,
    start: u64,
    file_size: u64,
) -> Result<UploadOutcome, String> {
    let end = std::cmp::min(start + CHUNK_SIZE, file_size) - 1;
    let chunk_len = end - start + 1;
    let buf = read_chunk(file, start, chunk_len)?;
    let range_header = format!("bytes {start}-{end}/{file_size}");

    let mut attempt: u32 = 0;
    loop {
        let send_result = client
            .put(upload_url)
            .header("Content-Length", chunk_len.to_string())
            .header("Content-Range", &range_header)
            .body(buf.clone())
            .send();

        let send_err = match send_result {
            Ok(res) => return handle_chunk_response(res, start, end),
            Err(e) => format_reqwest_error(e),
        };

        attempt += 1;
        if attempt > MAX_RETRIES {
            return Err(format!(
                "Upload failed after {MAX_RETRIES} retries: {send_err}"
            ));
        }
        let backoff_secs = std::cmp::min(1u64 << attempt, 30);
        logger::error(&format!(
            "upload_file: chunk {start}-{end} error (attempt {attempt}/{MAX_RETRIES}): {send_err}; retrying in {backoff_secs}s"
        ));
        std::thread::sleep(Duration::from_secs(backoff_secs));

        match query_upload_status(client, upload_url, file_size) {
            Ok(UploadStatus::Complete(id)) => {
                logger::info(&format!("upload_file: completed during retry, file_id={id}"));
                return Ok(UploadOutcome::Completed(UploadFileResult { file_id: id }));
            }
            Ok(UploadStatus::Incomplete(pos)) if pos != start => {
                logger::info(&format!(
                    "upload_file: resyncing, server has {pos} of {file_size}"
                ));
                return Ok(UploadOutcome::Advanced(pos));
            }
            Ok(UploadStatus::Incomplete(_)) => {
                // Server is at the same position; retry the same chunk.
            }
            Err(query_err) => {
                logger::error(&format!(
                    "upload_file: status query failed: {query_err}; retrying same chunk"
                ));
            }
        }
    }
}

fn handle_chunk_response(
    res: reqwest::blocking::Response,
    start: u64,
    end: u64,
) -> Result<UploadOutcome, String> {
    let status = res.status();

    if status.is_success() {
        let data: DriveFile = res
            .json()
            .map_err(|e| format!("Failed to parse response: {}", format_reqwest_error(e)))?;
        return Ok(UploadOutcome::Completed(UploadFileResult { file_id: data.id }));
    }

    if status.as_u16() == 308 {
        let next = range_end_from_response(&res)
            .map(|last| last + 1)
            .unwrap_or(end + 1);
        logger::info(&format!(
            "upload_file: chunk {start}-{end} accepted, next={next}"
        ));
        return Ok(UploadOutcome::Advanced(next));
    }

    let body = res.text().unwrap_or_default();
    Err(format!("Upload failed: {status} {body}"))
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
        .map_err(|e| format!("Status query failed: {}", format_reqwest_error(e)))?;

    let status = res.status();
    if status.is_success() {
        let data: DriveFile = res.json().map_err(|e| {
            format!("Failed to parse completion response: {}", format_reqwest_error(e))
        })?;
        return Ok(UploadStatus::Complete(data.id));
    }

    if status.as_u16() != 308 {
        let body = res.text().unwrap_or_default();
        return Err(format!("Unexpected status during status query: {status} {body}"));
    }

    let next = range_end_from_response(&res)
        .map(|last| last + 1)
        .unwrap_or(0);
    Ok(UploadStatus::Incomplete(next))
}

fn range_end_from_response(res: &reqwest::blocking::Response) -> Option<u64> {
    let header = res.headers().get("Range")?;
    let value = header.to_str().ok()?;
    parse_range_end(value)
}

fn parse_range_end(range_header: &str) -> Option<u64> {
    // Google Drive Range header format: "bytes=0-<last>"
    let stripped = range_header.strip_prefix("bytes=")?;
    let (_, end) = stripped.split_once('-')?;
    end.parse().ok()
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
    let res = client
        .put(upload_url)
        .header("Content-Length", "0")
        .body(Vec::<u8>::new())
        .send()
        .map_err(|e| format!("Upload failed: {}", format_reqwest_error(e)))?;

    let status = res.status();
    if !status.is_success() {
        let body = res.text().unwrap_or_default();
        return Err(format!("Upload failed: {status} {body}"));
    }

    let data: DriveFile = res
        .json()
        .map_err(|e| format!("Failed to parse response: {}", format_reqwest_error(e)))?;
    let _ = std::fs::remove_file(file_path);
    logger::info(&format!("upload_file: success (empty), file_id={}", data.id));
    Ok(UploadFileResult { file_id: data.id })
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
