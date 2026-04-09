use std::fs::File;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::drive_common::{backoff_for, format_error_chain, is_retryable_status, truncate_body, uuid_v4};
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
    std::env::temp_dir().join(format!("qsave_restore_{}.zip", uuid_v4()))
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Downloads a Drive file by id to a temp path, streaming the response body
/// straight to disk. The frontend passes a freshly refreshed OAuth access
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

    let mut attempt: u32 = 0;
    loop {
        let temp_path = temp_download_path();
        match download_once(&client, &url, access_token, &temp_path) {
            Ok(file_size) => {
                logger::info(&format!(
                    "drive_download: success, {file_size} bytes -> {}",
                    temp_path.display()
                ));
                return Ok(DownloadFileResult {
                    temp_path: temp_path.to_string_lossy().to_string(),
                    file_size,
                });
            }
            Err(DownloadError::Permanent(err)) => {
                let _ = std::fs::remove_file(&temp_path);
                logger::error(&format!(
                    "drive_download: permanent error, not retrying: {err}"
                ));
                return Err(err);
            }
            Err(DownloadError::Retryable(err)) => {
                let _ = std::fs::remove_file(&temp_path);
                attempt += 1;
                if attempt > MAX_RETRIES {
                    return Err(format!(
                        "Download failed after {MAX_RETRIES} retries: {err}"
                    ));
                }
                let backoff = backoff_for(attempt);
                logger::error(&format!(
                    "drive_download: error (attempt {attempt}/{MAX_RETRIES}): {err}; retrying in {}s",
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
) -> Result<u64, DownloadError> {
    logger::info(&format!(
        "drive_download: streaming -> {}",
        temp_path.display()
    ));

    let mut res = client
        .get(url)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        // Network/connect failures are always transient.
        .map_err(|e| {
            DownloadError::Retryable(format!("Request failed: {}", format_error_chain(&e)))
        })?;

    let status = res.status();
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

    // Local disk failures are the user's problem, not Drive's — retrying
    // won't help if the temp dir is unwritable or full.
    let mut file = File::create(temp_path).map_err(|e| {
        DownloadError::Permanent(format!(
            "Failed to create temp file {}: {e}",
            temp_path.display()
        ))
    })?;

    let bytes_copied = res.copy_to(&mut file).map_err(|e| {
        DownloadError::Retryable(format!(
            "Failed to stream body to disk: {}",
            format_error_chain(&e)
        ))
    })?;

    Ok(bytes_copied)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

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
}
