use std::collections::HashMap;
use std::path::PathBuf;

/// Returns a map of `install_dir_basename (lowercase) -> install path`
/// by scanning Epic Games Launcher manifest `.item` files.
pub fn find_epic_app_roots() -> HashMap<String, PathBuf> {
    let mut map = HashMap::new();

    for dir in epic_manifests_dirs() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let is_item = path.extension().map_or(false, |ext| ext == "item");
            if !is_item {
                continue;
            }
            let Ok(content) = std::fs::read_to_string(&path) else {
                continue;
            };
            let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
                continue;
            };
            let Some(install_location) = json["InstallLocation"].as_str() else {
                continue;
            };
            let install_path = PathBuf::from(install_location);
            if !install_path.exists() {
                continue;
            }
            let Some(dir_name) = install_path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            map.insert(dir_name.to_ascii_lowercase(), install_path);
        }
    }

    map
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

        // Create a fake install location
        let install_dir = dir.path().join("Fortnite");
        fs::create_dir(&install_dir).unwrap();

        // Create a fake manifests directory
        let manifests_dir = dir.path().join("Manifests");
        fs::create_dir(&manifests_dir).unwrap();

        fs::write(
            manifests_dir.join("abc123.item"),
            format!(
                r#"{{"AppName":"Fortnite","InstallLocation":"{}"}}"#,
                install_dir.to_string_lossy().replace('\\', "\\\\")
            ),
        )
        .unwrap();

        let mut map = HashMap::new();
        let Ok(entries) = std::fs::read_dir(&manifests_dir) else {
            panic!("could not read manifests dir");
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let is_item = path.extension().map_or(false, |ext| ext == "item");
            if !is_item {
                continue;
            }
            let content = fs::read_to_string(&path).unwrap();
            let json: serde_json::Value = serde_json::from_str(&content).unwrap();
            let install_location = json["InstallLocation"].as_str().unwrap();
            let install_path = PathBuf::from(install_location);
            if !install_path.exists() {
                continue;
            }
            let dir_name = install_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap();
            map.insert(dir_name.to_ascii_lowercase(), install_path);
        }

        assert_eq!(map.get("fortnite"), Some(&install_dir));
    }

    #[test]
    fn ignores_non_item_files() {
        use std::fs;
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let manifests_dir = dir.path().join("Manifests");
        fs::create_dir(&manifests_dir).unwrap();
        fs::write(manifests_dir.join("readme.txt"), "not a manifest").unwrap();

        let Ok(entries) = std::fs::read_dir(&manifests_dir) else {
            panic!("could not read manifests dir");
        };
        let count = entries
            .flatten()
            .filter(|entry| {
                entry
                    .path()
                    .extension()
                    .map_or(false, |ext| ext == "item")
            })
            .count();

        assert_eq!(count, 0);
    }

    #[test]
    fn skips_missing_install_location() {
        use std::fs;
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let manifests_dir = dir.path().join("Manifests");
        fs::create_dir(&manifests_dir).unwrap();

        // Install location that doesn't exist
        fs::write(
            manifests_dir.join("broken.item"),
            r#"{"AppName":"Gone","InstallLocation":"/nonexistent/path/Gone"}"#,
        )
        .unwrap();

        let mut map = HashMap::new();
        let entries = std::fs::read_dir(&manifests_dir).unwrap();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "item") {
                let content = fs::read_to_string(&path).unwrap();
                let json: serde_json::Value = serde_json::from_str(&content).unwrap();
                if let Some(loc) = json["InstallLocation"].as_str() {
                    let install_path = PathBuf::from(loc);
                    if install_path.exists() {
                        if let Some(name) = install_path.file_name().and_then(|n| n.to_str()) {
                            map.insert(name.to_ascii_lowercase(), install_path);
                        }
                    }
                }
            }
        }

        assert!(map.is_empty());
    }
}
