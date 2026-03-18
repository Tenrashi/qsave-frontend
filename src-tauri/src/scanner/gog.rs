use std::collections::HashMap;
use std::path::PathBuf;

/// Returns a map of `gog_app_id -> game install directory`.
pub fn find_gog_app_roots() -> HashMap<u64, PathBuf> {
    let mut map = HashMap::new();

    #[cfg(target_os = "windows")]
    find_gog_roots_registry(&mut map);

    #[cfg(not(target_os = "windows"))]
    find_gog_roots_filesystem(&mut map);

    map
}

/// Windows: reads GOG game paths from the registry.
/// HKLM\SOFTWARE\WOW6432Node\GOG.com\Games\<id>  →  gameID, path
#[cfg(target_os = "windows")]
fn find_gog_roots_registry(map: &mut HashMap<u64, PathBuf>) {
    use winreg::RegKey;
    use winreg::enums::HKEY_LOCAL_MACHINE;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let Ok(gog_key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\GOG.com\\Games") else {
        return;
    };

    for subkey_name in gog_key.enum_keys().flatten() {
        let Ok(subkey) = gog_key.open_subkey(&subkey_name) else {
            continue;
        };

        let Ok(id_str): Result<String, _> = subkey.get_value("gameID") else {
            continue;
        };
        let Ok(path_str): Result<String, _> = subkey.get_value("path") else {
            continue;
        };
        let Ok(id) = id_str.parse::<u64>() else {
            continue;
        };

        let p = PathBuf::from(path_str);
        if p.exists() {
            map.insert(id, p);
        }
    }
}

/// macOS / Linux: scan default GOG install directories for `goggame-*.info` files.
/// These JSON files contain the `gameId` field.
#[cfg(not(target_os = "windows"))]
fn find_gog_roots_filesystem(map: &mut HashMap<u64, PathBuf>) {
    for base in gog_default_dirs() {
        let Ok(entries) = std::fs::read_dir(&base) else {
            continue;
        };
        for entry in entries.flatten() {
            let game_dir = entry.path();
            if !game_dir.is_dir() {
                continue;
            }
            scan_gog_info_file(&game_dir, map);
        }
    }
}

/// Looks for a `goggame-*.info` JSON file inside `dir` and inserts the game into the map.
#[cfg(not(target_os = "windows"))]
fn scan_gog_info_file(dir: &std::path::Path, map: &mut HashMap<u64, PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.starts_with("goggame-") || !name.ends_with(".info") {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };
        let Some(id) = json["gameId"].as_str().and_then(|s| s.parse::<u64>().ok()) else {
            continue;
        };
        map.insert(id, dir.to_path_buf());
        return;
    }
}

/// Default GOG install directories per platform (macOS / Linux).
#[cfg(not(target_os = "windows"))]
fn gog_default_dirs() -> Vec<PathBuf> {
    let mut candidates = vec![];

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join("Applications"));
        }
        candidates.push(PathBuf::from("/Applications"));
    }

    #[cfg(target_os = "linux")]
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join("GOG Games"));
        candidates.push(home.join("Games").join("GOG"));
    }

    candidates
}

#[cfg(test)]
mod tests {
    #[cfg(not(target_os = "windows"))]
    use super::*;

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn finds_game_from_info_file() {
        use std::fs;
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("My GOG Game");
        fs::create_dir(&game_dir).unwrap();
        fs::write(
            game_dir.join("goggame-1234567890.info"),
            r#"{"gameId":"1234567890","buildId":"abc"}"#,
        )
        .unwrap();

        let mut map = HashMap::new();
        scan_gog_info_file(&game_dir, &mut map);

        assert_eq!(map.get(&1234567890u64), Some(&game_dir));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn ignores_dirs_without_info_file() {
        use std::fs;
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("NotAGogGame");
        fs::create_dir(&game_dir).unwrap();
        fs::write(game_dir.join("readme.txt"), "hello").unwrap();

        let mut map = HashMap::new();
        scan_gog_info_file(&game_dir, &mut map);
        assert!(map.is_empty());
    }
}
