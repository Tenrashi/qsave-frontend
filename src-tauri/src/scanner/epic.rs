use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Returns a map of `install_dir_basename (lowercase) -> install path`
/// by scanning Epic Games Launcher manifest `.item` files.
/// If two games share a basename (different parent paths), the last one wins.
/// This is acceptable because Epic install basenames are unique in practice.
pub fn find_epic_app_roots() -> HashMap<String, PathBuf> {
    let mut map = HashMap::new();

    for dir in epic_manifests_dirs() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            scan_item_file(&entry.path(), &mut map);
        }
    }

    map
}

/// Parses a single `.item` manifest file and inserts the game into the map
/// keyed by lowercase install directory basename.
fn scan_item_file(path: &Path, map: &mut HashMap<String, PathBuf>) {
    let is_item = path.extension().is_some_and(|ext| ext == "item");
    if !is_item {
        return;
    }
    let Ok(content) = std::fs::read_to_string(path) else {
        return;
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
        return;
    };
    let Some(install_location) = json["InstallLocation"].as_str() else {
        return;
    };
    let install_path = PathBuf::from(install_location);
    if !install_path.exists() {
        return;
    }
    let Some(dir_name) = install_path.file_name().and_then(|n| n.to_str()) else {
        return;
    };
    map.insert(dir_name.to_ascii_lowercase(), install_path);
}

fn epic_manifests_dirs() -> Vec<PathBuf> {
    let mut candidates = vec![];

    #[cfg(target_os = "windows")]
    {
        let program_data =
            std::env::var("PROGRAMDATA").unwrap_or_else(|_| "C:\\ProgramData".to_string());
        candidates.push(
            PathBuf::from(program_data)
                .join("Epic")
                .join("EpicGamesLauncher")
                .join("Data")
                .join("Manifests"),
        );
    }

    #[cfg(target_os = "macos")]
    if let Some(home) = dirs::home_dir() {
        candidates.push(
            home.join("Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests"),
        );
    }

    #[cfg(target_os = "linux")]
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".config/Epic/EpicGamesLauncher/Data/Manifests"));
    }

    candidates
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_game_from_item_file() {
        use std::fs;
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();

        let install_dir = dir.path().join("Fortnite");
        fs::create_dir(&install_dir).unwrap();

        let item_path = dir.path().join("abc123.item");
        fs::write(
            &item_path,
            format!(
                r#"{{"AppName":"Fortnite","InstallLocation":"{}"}}"#,
                install_dir.to_string_lossy().replace('\\', "\\\\")
            ),
        )
        .unwrap();

        let mut map = HashMap::new();
        scan_item_file(&item_path, &mut map);

        assert_eq!(map.get("fortnite"), Some(&install_dir));
    }

    #[test]
    fn ignores_non_item_files() {
        use std::fs;
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let txt_path = dir.path().join("readme.txt");
        fs::write(&txt_path, "not a manifest").unwrap();

        let mut map = HashMap::new();
        scan_item_file(&txt_path, &mut map);

        assert!(map.is_empty());
    }

    #[test]
    fn skips_missing_install_location() {
        use std::fs;
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let item_path = dir.path().join("broken.item");
        fs::write(
            &item_path,
            r#"{"AppName":"Gone","InstallLocation":"/nonexistent/path/Gone"}"#,
        )
        .unwrap();

        let mut map = HashMap::new();
        scan_item_file(&item_path, &mut map);

        assert!(map.is_empty());
    }
}
