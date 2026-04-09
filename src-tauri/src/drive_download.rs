use std::error::Error;
use std::fs::File;
use std::path::PathBuf;
use std::time::Duration;

use crate::logger;

// Match the upload path's 5-minute per-request ceiling so stalled reads fail
// fast instead of hanging the UI indefinitely.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
const MAX_RETRIES: u32 = 5;
const MAX_ERROR_CHAIN_DEPTH: usize = 16;
// Response bodies embedded in error messages are capped so a misbehaving
// server returning a huge HTML error page can't blow up logs or UI toasts.
const MAX_BODY_IN_ERROR: usize = 1024;

#[derive(Debug, serde::Serialize)]
pub struct DownloadFileResult {
    pub temp_path: String,
    pub file_size: u64,
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

/// Truncates a response body to `MAX_BODY_IN_ERROR` bytes (respecting UTF-8
/// char boundaries) so hostile or verbose server responses can't inflate
/// error messages and log lines.
fn truncate_body(body: &str) -> String {
    if body.len() <= MAX_BODY_IN_ERROR {
        return body.to_string();
    }
    let mut end = MAX_BODY_IN_ERROR;
    while end > 0 && !body.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}... ({} bytes total)", &body[..end], body.len())
}

/// Exponential backoff capped at 30 s so MAX_RETRIES stays bounded in time.
fn backoff_for(attempt: u32) -> Duration {
    let shifted = 1u64.checked_shl(attempt).unwrap_or(u64::MAX);
    Duration::from_secs(std::cmp::min(shifted, 30))
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let pid = std::process::id();
    format!("{nanos:x}-{pid:x}")
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
            Err(err) => {
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
    temp_path: &PathBuf,
) -> Result<u64, String> {
    logger::info(&format!(
        "drive_download: streaming -> {}",
        temp_path.display()
    ));

    let mut res = client
        .get(url)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .map_err(|e| format!("Request failed: {}", format_error_chain(&e)))?;

    let status = res.status();
    if !status.is_success() {
        let body = res.text().unwrap_or_default();
        return Err(format!(
            "Download failed: HTTP {} {}",
            status.as_u16(),
            truncate_body(&body)
        ));
    }

    let mut file = File::create(temp_path)
        .map_err(|e| format!("Failed to create temp file {}: {e}", temp_path.display()))?;

    let bytes_copied = res
        .copy_to(&mut file)
        .map_err(|e| format!("Failed to stream body to disk: {}", format_error_chain(&e)))?;

    Ok(bytes_copied)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fmt;

    // --- truncate_body ---

    #[test]
    fn truncate_body_passes_short_input_through() {
        let body = "short error";
        assert_eq!(truncate_body(body), body);
    }

    #[test]
    fn truncate_body_passes_exact_limit_through() {
        let body = "a".repeat(MAX_BODY_IN_ERROR);
        assert_eq!(truncate_body(&body), body);
    }

    #[test]
    fn truncate_body_truncates_over_limit() {
        let body = "a".repeat(MAX_BODY_IN_ERROR + 500);
        let result = truncate_body(&body);
        assert!(result.starts_with(&"a".repeat(MAX_BODY_IN_ERROR)));
        assert!(result.contains(&format!("({} bytes total)", MAX_BODY_IN_ERROR + 500)));
    }

    #[test]
    fn truncate_body_respects_utf8_char_boundaries() {
        // "é" is 2 bytes in UTF-8. Place one straddling MAX_BODY_IN_ERROR.
        let mut body = "a".repeat(MAX_BODY_IN_ERROR - 1);
        body.push('é'); // bytes MAX_BODY_IN_ERROR-1, MAX_BODY_IN_ERROR
        body.push_str(&"b".repeat(100));
        let result = truncate_body(&body);
        // Should not panic and should be valid UTF-8 (String guarantees this,
        // but the truncation path must not split the é).
        assert!(result.len() < body.len());
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
    }

    #[test]
    fn backoff_handles_overflow_gracefully() {
        // checked_shl must not panic for oversized attempts.
        let _ = backoff_for(100);
        let _ = backoff_for(u32::MAX);
    }

    // --- format_error_chain ---

    #[derive(Debug)]
    struct ChainErr {
        msg: &'static str,
        source: Option<Box<ChainErr>>,
    }

    impl fmt::Display for ChainErr {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str(self.msg)
        }
    }

    impl Error for ChainErr {
        fn source(&self) -> Option<&(dyn Error + 'static)> {
            self.source.as_deref().map(|s| s as &(dyn Error + 'static))
        }
    }

    #[test]
    fn format_error_chain_walks_sources() {
        let err = ChainErr {
            msg: "outer",
            source: Some(Box::new(ChainErr {
                msg: "middle",
                source: Some(Box::new(ChainErr {
                    msg: "inner",
                    source: None,
                })),
            })),
        };
        assert_eq!(format_error_chain(&err), "outer -> middle -> inner");
    }

    #[test]
    fn format_error_chain_is_bounded_by_max_depth() {
        // Build a chain that is longer than the depth cap.
        let mut node = ChainErr {
            msg: "leaf",
            source: None,
        };
        for _ in 0..(MAX_ERROR_CHAIN_DEPTH + 5) {
            node = ChainErr {
                msg: "node",
                source: Some(Box::new(node)),
            };
        }
        let out = format_error_chain(&node);
        assert!(out.ends_with(" -> (chain truncated)"));
        // Exactly MAX_ERROR_CHAIN_DEPTH arrows before the truncation marker
        // (one per walked source) plus one for the marker itself.
        let arrows = out.matches(" -> ").count();
        assert_eq!(arrows, MAX_ERROR_CHAIN_DEPTH + 1);
    }

    // --- temp_download_path ---

    #[test]
    fn temp_download_paths_are_unique() {
        let a = temp_download_path();
        let b = temp_download_path();
        assert_ne!(a, b);
        assert!(a.to_string_lossy().ends_with(".zip"));
    }
}
