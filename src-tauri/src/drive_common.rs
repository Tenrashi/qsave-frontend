use std::error::Error;
use std::time::Duration;

pub const MAX_ERROR_CHAIN_DEPTH: usize = 16;
// Response bodies embedded in error messages are capped so a misbehaving
// server returning a huge HTML error page can't blow up logs or UI toasts.
pub const MAX_BODY_IN_ERROR: usize = 1024;

/// Walks `Error::source()` so logs show the underlying hyper/IO cause instead
/// of just the top-level reqwest message. Depth-bounded so a pathological
/// error that lists itself as its own source can't loop forever.
pub fn format_error_chain(err: &(dyn Error + 'static)) -> String {
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
/// error messages and log lines. Appends a `(N bytes total)` marker when
/// truncation happens so the original size is still visible.
pub fn truncate_body(body: &str) -> String {
    if body.len() <= MAX_BODY_IN_ERROR {
        return body.to_string();
    }
    let mut end = MAX_BODY_IN_ERROR;
    while end > 0 && !body.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}... ({} bytes total)", &body[..end], body.len())
}

/// Exponential backoff capped at 30 s so bounded retry counts stay bounded
/// in time. `checked_shl` saturates instead of panicking on oversized
/// attempts, which matters because the upload loop increments `attempt`
/// unconditionally and would otherwise panic on a pathological run.
pub fn backoff_for(attempt: u32) -> Duration {
    let shifted = 1u64.checked_shl(attempt).unwrap_or(u64::MAX);
    Duration::from_secs(std::cmp::min(shifted, 30))
}

/// Best-effort unique id for temp filenames. Avoids pulling in the `uuid`
/// crate for just this — nanosecond timestamp plus pid is unique enough for
/// cleanup filenames and effectively free at runtime.
pub fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let pid = std::process::id();
    format!("{nanos:x}-{pid:x}")
}

/// HTTP status codes worth retrying: request timeout (408), too many
/// requests (429), and 5xx server errors. Everything else is permanent
/// — retrying a 401 on a revoked token or a 404 on a deleted file just
/// wastes the retry budget before surfacing the real error.
pub fn is_retryable_status(status: u16) -> bool {
    matches!(status, 408 | 429 | 500..=599)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fmt;

    // --- truncate_body ---

    #[test]
    fn truncate_body_short_is_unchanged() {
        assert_eq!(truncate_body("hello"), "hello");
    }

    #[test]
    fn truncate_body_at_limit_is_unchanged() {
        let body = "x".repeat(MAX_BODY_IN_ERROR);
        assert_eq!(truncate_body(&body), body);
    }

    #[test]
    fn truncate_body_over_limit_is_truncated_and_reports_size() {
        let body = "x".repeat(MAX_BODY_IN_ERROR + 500);
        let truncated = truncate_body(&body);
        assert!(truncated.len() < body.len());
        assert!(truncated.starts_with(&"x".repeat(MAX_BODY_IN_ERROR)));
        assert!(truncated.contains(&format!("{} bytes total", body.len())));
    }

    #[test]
    fn truncate_body_respects_utf8_char_boundaries() {
        // "é" is 2 bytes in UTF-8 (0xC3 0xA9). Place one straddling
        // MAX_BODY_IN_ERROR so a naive `&body[..MAX_BODY_IN_ERROR]` slice
        // would split it mid-codepoint.
        let prefix = "a".repeat(MAX_BODY_IN_ERROR - 1);
        let body = format!("{prefix}éééééé");
        let truncated = truncate_body(&body);
        // The kept content (everything before the "... (N bytes total)"
        // marker) must be exactly the intact prefix — no partial é byte,
        // no extra char leaked in, and crucially the é straddling the
        // boundary must have been walked back past entirely.
        let (kept, _) = truncated.split_once("... (").expect("marker present");
        assert_eq!(kept, prefix);
        assert!(truncated.contains(&format!("{} bytes total", body.len())));
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
    fn backoff_handles_overflow_gracefully() {
        // checked_shl saturates to u64::MAX instead of panicking for
        // oversized attempt counts.
        assert_eq!(backoff_for(100), Duration::from_secs(30));
        assert_eq!(backoff_for(u32::MAX), Duration::from_secs(30));
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
        let err = ChainErr {
            msg: "top",
            source: None,
        };
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
        let mut err = ChainErr {
            msg: "leaf",
            source: None,
        };
        for _ in 0..(MAX_ERROR_CHAIN_DEPTH + 10) {
            err = ChainErr {
                msg: "link",
                source: Some(Box::new(err)),
            };
        }
        let formatted = format_error_chain(&err);
        assert!(formatted.ends_with("(chain truncated)"));
        // The walker should produce exactly MAX_ERROR_CHAIN_DEPTH " -> "
        // separators for the walked sources plus one more for the
        // "(chain truncated)" suffix.
        assert_eq!(
            formatted.matches(" -> ").count(),
            MAX_ERROR_CHAIN_DEPTH + 1
        );
    }

    // --- uuid_v4 ---

    #[test]
    fn uuid_v4_is_unique_across_calls() {
        let a = uuid_v4();
        let b = uuid_v4();
        assert_ne!(a, b);
    }

    // --- is_retryable_status ---

    #[test]
    fn is_retryable_status_retries_transient_errors() {
        assert!(is_retryable_status(408));
        assert!(is_retryable_status(429));
        assert!(is_retryable_status(500));
        assert!(is_retryable_status(502));
        assert!(is_retryable_status(503));
        assert!(is_retryable_status(504));
        assert!(is_retryable_status(599));
    }

    #[test]
    fn is_retryable_status_does_not_retry_client_errors() {
        assert!(!is_retryable_status(400));
        assert!(!is_retryable_status(401));
        assert!(!is_retryable_status(403));
        assert!(!is_retryable_status(404));
        assert!(!is_retryable_status(409));
        assert!(!is_retryable_status(200));
        assert!(!is_retryable_status(308));
    }
}
