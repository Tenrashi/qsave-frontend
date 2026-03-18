use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Returns all Steam library root paths (main Steam dir + any extra libraries).
pub fn find_steam_libraries() -> Vec<PathBuf> {
    let Some(steam_dir) = find_steam_dir() else {
        return vec![];
    };

    let vdf_path = steam_dir.join("steamapps").join("libraryfolders.vdf");
    let mut libraries = vec![steam_dir];

    let Ok(content) = fs::read_to_string(&vdf_path) else {
        return libraries;
    };

    for line in content.lines() {
        let trimmed = line.trim();

        // New format (Steam ~2021+):  "path"   "/some/path"
        if let Some(path) = vdf_string_value(trimmed, "path") {
            let p = PathBuf::from(path);
            if p != libraries[0] && p.exists() && !libraries.contains(&p) {
                libraries.push(p);
            }
        // Old format: numeric key with a path value directly, e.g.  "1"   "D:\\SteamLibrary"
        } else if let Some((key, val)) = vdf_pair(trimmed) {
            if key.parse::<u32>().is_ok() {
                let p = PathBuf::from(val);
                if p.exists() && !libraries.contains(&p) {
                    libraries.push(p);
                }
            }
        }
    }

    libraries
}

/// Returns a map of `steam_app_id -> game install directory`.
pub fn find_steam_app_roots(libraries: &[PathBuf]) -> HashMap<u64, PathBuf> {
    let mut map = HashMap::new();

    for library in libraries {
        let steamapps = library.join("steamapps");
        let Ok(entries) = fs::read_dir(&steamapps) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if !name.starts_with("appmanifest_") || !name.ends_with(".acf") {
                continue;
            }

            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };

            let Some(app_id) = acf_value(&content, "appid").and_then(|v| v.parse::<u64>().ok()) else {
                continue;
            };
            let Some(install_dir) = acf_value(&content, "installdir") else {
                continue;
            };

            let root = steamapps.join("common").join(install_dir);
            if root.exists() {
                map.insert(app_id, root);
            }
        }
    }

    map
}

fn find_steam_dir() -> Option<PathBuf> {
    steam_candidates().into_iter().find(|p| p.exists())
}

fn steam_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![];

    #[cfg(target_os = "windows")]
    {
        if let Ok(pf) = std::env::var("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(pf).join("Steam"));
        }
        if let Ok(pf) = std::env::var("ProgramFiles") {
            candidates.push(PathBuf::from(pf).join("Steam"));
        }
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join("AppData").join("Local").join("Steam"));
        }
    }

    #[cfg(target_os = "macos")]
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join("Library/Application Support/Steam"));
    }

    #[cfg(target_os = "linux")]
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".steam/steam"));
        candidates.push(home.join(".local/share/Steam"));
    }

    candidates
}

/// Extracts value from a VDF line like `"key"\t"value"` for a specific key.
fn vdf_string_value<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let key_token = format!("\"{}\"", key);
    let after_key = line.strip_prefix(&key_token)?.trim();
    if after_key.len() < 2 || !after_key.starts_with('"') || !after_key.ends_with('"') {
        return None;
    }
    Some(&after_key[1..after_key.len() - 1])
}

/// Extracts key and value from any VDF line like `"key"\t"value"`.
fn vdf_pair(line: &str) -> Option<(&str, &str)> {
    let rest = line.strip_prefix('"')?;
    let key_end = rest.find('"')?;
    let key = &rest[..key_end];
    let after = rest[key_end + 1..].trim();
    if after.len() < 2 || !after.starts_with('"') || !after.ends_with('"') {
        return None;
    }
    Some((key, &after[1..after.len() - 1]))
}

/// Searches an ACF file's content for a value by key.
fn acf_value<'a>(content: &'a str, key: &str) -> Option<&'a str> {
    content
        .lines()
        .find_map(|line| vdf_string_value(line.trim(), key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_vdf_string_value() {
        assert_eq!(vdf_string_value(r#""path"	"D:\SteamLibrary""#, "path"), Some(r"D:\SteamLibrary"));
        assert_eq!(vdf_string_value(r#""path"	"/home/user/.steam""#, "path"), Some("/home/user/.steam"));
        assert_eq!(vdf_string_value(r#""other"	"value""#, "path"), None);
    }

    #[test]
    fn parses_old_format_numeric_key() {
        let (key, val) = vdf_pair(r#""1"	"D:\SteamLibrary""#).unwrap();
        assert_eq!(key, "1");
        assert_eq!(val, r"D:\SteamLibrary");
    }

    #[test]
    fn parses_acf_value() {
        let content = "\"AppState\"\n{\n\t\"appid\"\t\"220\"\n\t\"installdir\"\t\"Half-Life 2\"\n}\n";
        assert_eq!(acf_value(content, "appid"), Some("220"));
        assert_eq!(acf_value(content, "installdir"), Some("Half-Life 2"));
        assert_eq!(acf_value(content, "missing"), None);
    }

    #[test]
    fn ignores_block_opening_lines() {
        // Lines like `"apps"\n{` should not be parsed as key-value pairs
        assert_eq!(vdf_string_value("\"apps\"", "apps"), None);
    }
}
