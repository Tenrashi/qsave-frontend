use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

const LOG_FILE: &str = "qsave.log";
const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024; // 2 MB

fn log_path() -> Option<PathBuf> {
    let dir = dirs::data_dir()?.join("QSave");
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join(LOG_FILE))
}

fn truncate_if_needed(path: &PathBuf) {
    let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    if size <= MAX_LOG_BYTES {
        return;
    }
    let _ = fs::write(path, b"[log truncated]\n");
}

fn write_log(path: &PathBuf, level: &str, message: &str) {
    truncate_if_needed(path);

    let timestamp = chrono_lite_now();
    let line = format!("[{timestamp}] [{level}] {message}\n");

    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    let _ = file.write_all(line.as_bytes());
}

pub fn log(level: &str, message: &str) {
    let Some(path) = log_path() else { return };
    write_log(&path, level, message);
}

pub fn info(message: &str) {
    log("INFO", message);
}

pub fn error(message: &str) {
    log("ERROR", message);
}

/// Minimal timestamp without pulling in chrono.
fn chrono_lite_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    let (year, month, day) = days_to_ymd(days);
    format!("{year:04}-{month:02}-{day:02} {hours:02}:{minutes:02}:{seconds:02}Z")
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut year = 1970;
    loop {
        let year_days = if is_leap(year) { 366 } else { 365 };
        if days < year_days {
            break;
        }
        days -= year_days;
        year += 1;
    }
    let leap = is_leap(year);
    let month_days: [u64; 12] = [
        31,
        if leap { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut month = 0;
    for (index, &count) in month_days.iter().enumerate() {
        if days < count {
            month = index as u64 + 1;
            break;
        }
        days -= count;
    }
    (year, month, days + 1)
}

fn is_leap(year: u64) -> bool {
    (year.is_multiple_of(4) && !year.is_multiple_of(100)) || year.is_multiple_of(400)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn test_log_path(dir: &TempDir) -> PathBuf {
        dir.path().join("qsave.log")
    }

    #[test]
    fn writes_log_entry_to_file() {
        let dir = TempDir::new().unwrap();
        let path = test_log_path(&dir);

        write_log(&path, "INFO", "test message");

        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("[INFO] test message"));
    }

    #[test]
    fn appends_multiple_entries() {
        let dir = TempDir::new().unwrap();
        let path = test_log_path(&dir);

        write_log(&path, "INFO", "first");
        write_log(&path, "ERROR", "second");

        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("[INFO] first"));
        assert!(content.contains("[ERROR] second"));
    }

    #[test]
    fn includes_timestamp_in_entry() {
        let dir = TempDir::new().unwrap();
        let path = test_log_path(&dir);

        write_log(&path, "INFO", "timestamped");

        let content = fs::read_to_string(&path).unwrap();
        // Matches pattern like [2026-04-06 ...Z]
        assert!(content.contains("Z] [INFO]"));
    }

    #[test]
    fn truncates_when_over_max_size() {
        let dir = TempDir::new().unwrap();
        let path = test_log_path(&dir);

        // Write more than MAX_LOG_BYTES
        let big_content = "x".repeat(MAX_LOG_BYTES as usize + 1);
        fs::write(&path, &big_content).unwrap();

        write_log(&path, "INFO", "after truncate");

        let content = fs::read_to_string(&path).unwrap();
        assert!(content.starts_with("[log truncated]"));
        assert!(content.contains("[INFO] after truncate"));
        assert!(content.len() < big_content.len());
    }

    #[test]
    fn does_not_truncate_under_max_size() {
        let dir = TempDir::new().unwrap();
        let path = test_log_path(&dir);

        write_log(&path, "INFO", "first entry");
        write_log(&path, "INFO", "second entry");

        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("first entry"));
        assert!(content.contains("second entry"));
        assert!(!content.contains("[log truncated]"));
    }

    #[test]
    fn days_to_ymd_epoch() {
        assert_eq!(days_to_ymd(0), (1970, 1, 1));
    }

    #[test]
    fn days_to_ymd_known_date() {
        // 2024-02-29 (leap day): days since epoch = 19782
        assert_eq!(days_to_ymd(19782), (2024, 2, 29));
    }

    #[test]
    fn days_to_ymd_non_leap() {
        // 2023-03-01: days since epoch = 19417
        assert_eq!(days_to_ymd(19417), (2023, 3, 1));
    }

    #[test]
    fn is_leap_years() {
        assert!(is_leap(2000));
        assert!(is_leap(2024));
        assert!(!is_leap(1900));
        assert!(!is_leap(2023));
    }
}
