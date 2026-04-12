use super::types::DetectedGame;
use std::fs;
use std::path::{Path, PathBuf};

fn cache_path() -> Option<PathBuf> {
    dirs::cache_dir().map(|dir| dir.join("com.qsave.app").join("scan_cache.json"))
}

fn save_to(path: &Path, games: &[DetectedGame]) {
    let Some(parent) = path.parent() else { return };
    let _ = fs::create_dir_all(parent);
    let Ok(json) = serde_json::to_vec(games) else { return };
    let _ = fs::write(path, json);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
}

fn load_from(path: &Path) -> Vec<DetectedGame> {
    let Ok(bytes) = fs::read(path) else {
        return vec![];
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

pub fn save(games: &[DetectedGame]) {
    let Some(path) = cache_path() else { return };
    save_to(&path, games);
}

pub fn load() -> Vec<DetectedGame> {
    let Some(path) = cache_path() else {
        return vec![];
    };
    load_from(&path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scanner::types::SaveFileInfo;
    use tempfile::TempDir;

    fn sample_games() -> Vec<DetectedGame> {
        vec![
            DetectedGame {
                name: "Elden Ring".to_string(),
                steam_id: Some(1245620),
                save_paths: vec!["/saves/elden".to_string()],
                save_files: vec![SaveFileInfo {
                    name: "save.dat".to_string(),
                    path: "/saves/elden/save.dat".to_string(),
                    size_bytes: 2048,
                    last_modified: 1710417600000,
                    game_name: "Elden Ring".to_string(),
                }],

                platform: Some("steam".to_string()),
                has_steam_cloud: true,
            },
            DetectedGame {
                name: "Hollow Knight".to_string(),
                steam_id: None,
                save_paths: vec!["/saves/hollow".to_string()],
                save_files: vec![],

                platform: None,
                has_steam_cloud: false,
            },
        ]
    }

    #[test]
    fn round_trips_through_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("cache.json");
        let games = sample_games();

        save_to(&path, &games);
        let loaded = load_from(&path);

        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].name, "Elden Ring");
        assert_eq!(loaded[0].steam_id, Some(1245620));
        assert_eq!(loaded[0].save_files.len(), 1);
        assert_eq!(loaded[0].save_files[0].size_bytes, 2048);
        assert_eq!(loaded[0].platform, Some("steam".to_string()));
        assert!(loaded[0].has_steam_cloud);
        assert_eq!(loaded[1].name, "Hollow Knight");
        assert_eq!(loaded[1].steam_id, None);
        assert!(!loaded[1].has_steam_cloud);
    }

    #[test]
    fn returns_empty_for_missing_file() {
        let loaded = load_from(Path::new("/nonexistent/unlikely/cache.json"));
        assert!(loaded.is_empty());
    }

    #[test]
    fn returns_empty_for_corrupt_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("cache.json");
        fs::write(&path, b"not valid json").unwrap();

        let loaded = load_from(&path);
        assert!(loaded.is_empty());
    }

    #[test]
    fn overwrites_existing_cache() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("cache.json");

        save_to(&path, &sample_games());
        assert_eq!(load_from(&path).len(), 2);

        save_to(&path, &sample_games()[..1]);
        assert_eq!(load_from(&path).len(), 1);
    }

    #[test]
    fn creates_parent_directories() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("nested").join("dir").join("cache.json");

        save_to(&path, &sample_games());
        let loaded = load_from(&path);
        assert_eq!(loaded.len(), 2);
    }
}
