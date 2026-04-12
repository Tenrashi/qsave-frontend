use std::fs::{self, File, OpenOptions};
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::drive_common::{backoff_for, format_error_chain, is_retryable_status, temp_id, truncate_body};
use crate::logger;

// Match the upload path's 5-minute per-request ceiling so stalled reads fail
// fast instead of hanging the UI indefinitely.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
const MAX_RETRIES: u32 = 5;

#[derive(Debug, serde::Serialize)]
pub struct DownloadFileResult {
    pub temp_path: String,
    pub file_size: u64,
}

/// Classifies a single download attempt's failure so the retry loop can
/// skip wasting its budget on permanent errors (revoked token, deleted
/// file, etc.).
#[derive(Debug)]
enum DownloadError {
    Retryable(String),
    Permanent(String),
}

fn temp_download_path() -> PathBuf {
    std::env::temp_dir().join(format!("qsave_restore_{}.zip", temp_id()))
}

/// Returns the byte length already on disk, or 0 if the file doesn't exist.
fn bytes_on_disk(path: &Path) -> u64 {
    fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Downloads a Drive file by id to a temp path, streaming the response body
/// straight to disk. Retries resume from where the previous attempt left off
/// using HTTP Range requests so multi-GB saves don't restart from scratch on
/// flaky connections. The frontend passes a freshly refreshed OAuth access
/// token; Rust never touches the keychain. Returns the temp path and final
/// on-disk size; the caller is responsible for deleting the file when done.
pub fn download_drive_file(
    file_id: &str,
    access_token: &str,
) -> Result<DownloadFileResult, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", format_error_chain(&e)))?;

    let url = format!("https://www.googleapis.com/drive/v3/files/{file_id}?alt=media");
    let temp_path = temp_download_path();

    let mut attempt: u32 = 0;
    loop {
        let resume_from = bytes_on_disk(&temp_path);
        match download_once(&client, &url, access_token, &temp_path, resume_from) {
            Ok(file_size) => {
                logger::info(&format!(
                    "drive_download: file_id={file_id}, {file_size} bytes -> {}",
                    temp_path.display()
                ));
                return Ok(DownloadFileResult {
                    temp_path: temp_path.to_string_lossy().to_string(),
                    file_size,
                });
            }
            Err(DownloadError::Permanent(err)) => {
                let _ = fs::remove_file(&temp_path);
                logger::error(&format!(
                    "drive_download: file_id={file_id}, permanent error, not retrying: {err}"
                ));
                return Err(err);
            }
            Err(DownloadError::Retryable(err)) => {
                attempt += 1;
                if attempt > MAX_RETRIES {
                    let _ = fs::remove_file(&temp_path);
                    return Err(format!(
                        "Download failed after {MAX_RETRIES} retries: {err}"
                    ));
                }
                let backoff = backoff_for(attempt);
                let on_disk = bytes_on_disk(&temp_path);
                logger::error(&format!(
                    "drive_download: file_id={file_id}, error (attempt {attempt}/{MAX_RETRIES}): {err}; \
                     {on_disk} bytes on disk, retrying in {}s",
                    backoff.as_secs()
                ));
                std::thread::sleep(backoff);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Single attempt
// ---------------------------------------------------------------------------

fn download_once(
    client: &reqwest::blocking::Client,
    url: &str,
    access_token: &str,
    temp_path: &Path,
    resume_from: u64,
) -> Result<u64, DownloadError> {
    let label = match resume_from {
        0 => "streaming".to_string(),
        n => format!("resuming from byte {n}"),
    };
    logger::info(&format!(
        "drive_download: {label} -> {}",
        temp_path.display()
    ));

    let mut request = client
        .get(url)
        .header("Authorization", format!("Bearer {access_token}"));

    if resume_from > 0 {
        request = request.header("Range", format!("bytes={resume_from}-"));
    }

    let mut res = request
        .send()
        .map_err(|e| {
            DownloadError::Retryable(format!("Request failed: {}", format_error_chain(&e)))
        })?;

    let status = res.status();

    // 200 and 206 are both success — anything else is an error.
    if !status.is_success() {
        let body = res.text().unwrap_or_default();
        let msg = format!(
            "Download failed: HTTP {} {}",
            status.as_u16(),
            truncate_body(&body)
        );
        return Err(if is_retryable_status(status.as_u16()) {
            DownloadError::Retryable(msg)
        } else {
            DownloadError::Permanent(msg)
        });
    }

    let expected_chunk_size = res.content_length();

    // 200 = server sent the full file (ignored our Range header or first
    // attempt). 206 = server honoured the Range and is sending the tail.
    // On a 200 when we asked for a range, truncate and start over.
    let resuming = resume_from > 0 && status.as_u16() == 206;

    let mut file = open_temp_file(temp_path, resuming)?;

    let bytes_copied = res.copy_to(&mut file).map_err(|e| {
        DownloadError::Retryable(format!(
            "Failed to stream body to disk: {}",
            format_error_chain(&e)
        ))
    })?;

    if let Some(expected) = expected_chunk_size {
        if bytes_copied != expected {
            return Err(DownloadError::Retryable(format!(
                "Truncated download: expected {expected} bytes but received {bytes_copied}"
            )));
        }
    }

    let total = if resuming { resume_from + bytes_copied } else { bytes_copied };
    Ok(total)
}

/// Opens the temp file for writing. When resuming (206), appends to the
/// existing partial download. Otherwise creates/truncates so a fresh
/// download or a server that ignored our Range header starts clean.
fn open_temp_file(temp_path: &Path, append: bool) -> Result<File, DownloadError> {
    if append {
        return OpenOptions::new()
            .append(true)
            .open(temp_path)
            .map_err(|e| {
                DownloadError::Permanent(format!(
                    "Failed to reopen temp file for resume {}: {e}",
                    temp_path.display()
                ))
            });
    }
    File::create(temp_path).map_err(|e| {
        DownloadError::Permanent(format!(
            "Failed to create temp file {}: {e}",
            temp_path.display()
        ))
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn temp_download_paths_are_unique_and_end_in_zip() {
        let a = temp_download_path();
        let b = temp_download_path();
        assert_ne!(a, b);
        assert!(a.to_string_lossy().ends_with(".zip"));
        assert!(b.to_string_lossy().ends_with(".zip"));
    }

    #[test]
    fn temp_download_paths_live_in_temp_dir() {
        let p = temp_download_path();
        assert!(p.starts_with(std::env::temp_dir()));
    }

    #[test]
    fn bytes_on_disk_returns_zero_for_missing_file() {
        let missing = std::env::temp_dir().join("qsave_no_such_file.zip");
        assert_eq!(bytes_on_disk(&missing), 0);
    }

    #[test]
    fn bytes_on_disk_returns_file_length() {
        let path = std::env::temp_dir().join(format!("qsave_bod_test_{}.bin", temp_id()));
        File::create(&path).unwrap().write_all(&[0u8; 42]).unwrap();
        assert_eq!(bytes_on_disk(&path), 42);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn open_temp_file_create_truncates_existing() {
        let path = std::env::temp_dir().join(format!("qsave_otf_trunc_{}.bin", temp_id()));
        File::create(&path).unwrap().write_all(b"old data").unwrap();

        let mut file = open_temp_file(&path, false).unwrap();
        file.write_all(b"new").unwrap();
        drop(file);

        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn open_temp_file_append_preserves_existing() {
        let path = std::env::temp_dir().join(format!("qsave_otf_append_{}.bin", temp_id()));
        File::create(&path).unwrap().write_all(b"start").unwrap();

        let mut file = open_temp_file(&path, true).unwrap();
        file.write_all(b"_end").unwrap();
        drop(file);

        assert_eq!(fs::read_to_string(&path).unwrap(), "start_end");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn open_temp_file_append_errors_for_missing_file() {
        let missing = std::env::temp_dir().join("qsave_otf_missing.bin");
        let result = open_temp_file(&missing, true);
        assert!(matches!(result, Err(DownloadError::Permanent(_))));
    }
}
