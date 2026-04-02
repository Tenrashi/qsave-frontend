use rayon::prelude::*;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

use super::localized_paths::resolve_localized_paths;
use super::types::{DetectedGame, ResolvedCandidate, SaveFileInfo};

pub fn collect_save_files(dir: &Path, game_name: &str) -> Vec<SaveFileInfo> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };

    entries
        .flatten()
        .flat_map(|entry| {
            let path = entry.path();
            let name = entry.file_name();

            if name == ".DS_Store" {
                return Vec::new();
            }

            if path.is_dir() {
                return collect_save_files(&path, game_name);
            }

            let Ok(meta) = fs::metadata(&path) else {
                return Vec::new();
            };

            let modified = meta
                .modified()
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            vec![SaveFileInfo {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: meta.len(),
                last_modified: modified,
                game_name: game_name.to_string(),
            }]
        })
        .collect()
}

pub fn scan_candidates(candidates: Vec<ResolvedCandidate>) -> Vec<DetectedGame> {
    let mut games: Vec<DetectedGame> = candidates
        .into_par_iter()
        .filter_map(|candidate| {
            let existing: Vec<_> = candidate
                .paths
                .into_iter()
                .flat_map(|path| resolve_localized_paths(&path))
                .collect();

            let save_files: Vec<_> = existing
                .iter()
                .flat_map(|path| collect_save_files(Path::new(path), &candidate.name))
                .collect();

            if save_files.is_empty() {
                return None;
            }

            Some(DetectedGame {
                name: candidate.name,
                steam_id: candidate.steam_id,
                save_paths: existing,
                save_files,
                platform: candidate.platform,
                has_steam_cloud: candidate.has_steam_cloud,
            })
        })
        .collect();

    games.sort_by(|a, b| a.name.cmp(&b.name));
    games
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn finds_files_recursively() {
        let dir = TempDir::new().unwrap();
        let sub = dir.path().join("subdir");
        fs::create_dir(&sub).unwrap();

        File::create(dir.path().join("save1.dat"))
            .unwrap()
            .write_all(b"data1")
            .unwrap();
        File::create(sub.join("save2.dat"))
            .unwrap()
            .write_all(b"data2")
            .unwrap();

        let files = collect_save_files(dir.path(), "TestGame");
        assert_eq!(files.len(), 2);

        let names: Vec<&str> = files.iter().map(|f| f.name.as_str()).collect();
        assert!(names.contains(&"save1.dat"));
        assert!(names.contains(&"save2.dat"));

        for f in &files {
            assert_eq!(f.game_name, "TestGame");
            assert!(f.size_bytes > 0);
            assert!(f.last_modified > 0);
        }
    }

    #[test]
    fn excludes_ds_store_files() {
        let dir = TempDir::new().unwrap();
        let sub = dir.path().join("subdir");
        fs::create_dir(&sub).unwrap();

        File::create(dir.path().join(".DS_Store"))
            .unwrap()
            .write_all(b"junk")
            .unwrap();
        File::create(dir.path().join("save.dat"))
            .unwrap()
            .write_all(b"data")
            .unwrap();
        File::create(sub.join(".DS_Store"))
            .unwrap()
            .write_all(b"junk")
            .unwrap();
        File::create(sub.join("nested.dat"))
            .unwrap()
            .write_all(b"data")
            .unwrap();

        let files = collect_save_files(dir.path(), "TestGame");
        assert_eq!(files.len(), 2);

        let names: Vec<&str> = files.iter().map(|file| file.name.as_str()).collect();
        assert!(names.contains(&"save.dat"));
        assert!(names.contains(&"nested.dat"));
        assert!(!names.contains(&".DS_Store"));
    }

    #[test]
    fn returns_empty_for_missing_dir() {
        let files = collect_save_files(Path::new("/nonexistent/path/unlikely"), "Game");
        assert!(files.is_empty());
    }

    #[test]
    fn detects_existing_paths() {
        let dir = TempDir::new().unwrap();
        File::create(dir.path().join("save.dat"))
            .unwrap()
            .write_all(b"data")
            .unwrap();

        let candidates = vec![ResolvedCandidate {
            name: "TestGame".to_string(),
            steam_id: Some(42u64),
            paths: vec![dir.path().to_string_lossy().to_string()],
            platform: None,
            has_steam_cloud: false,
        }];

        let games = scan_candidates(candidates);
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].name, "TestGame");
        assert_eq!(games[0].steam_id, Some(42));
        assert_eq!(games[0].save_files.len(), 1);
    }

    #[test]
    fn skips_nonexistent_paths() {
        let candidates = vec![ResolvedCandidate {
            name: "MissingGame".to_string(),
            steam_id: None,
            paths: vec!["/nonexistent/path/very/unlikely".to_string()],
            platform: None,
            has_steam_cloud: false,
        }];

        let games = scan_candidates(candidates);
        assert!(games.is_empty());
    }

    #[test]
    fn sorts_by_name() {
        let dir_a = TempDir::new().unwrap();
        let dir_b = TempDir::new().unwrap();
        File::create(dir_a.path().join("a.dat")).unwrap();
        File::create(dir_b.path().join("b.dat")).unwrap();

        let candidates = vec![
            ResolvedCandidate {
                name: "Zelda".to_string(),
                steam_id: None,
                paths: vec![dir_a.path().to_string_lossy().to_string()],
                platform: None,
                has_steam_cloud: false,
            },
            ResolvedCandidate {
                name: "Amnesia".to_string(),
                steam_id: None,
                paths: vec![dir_b.path().to_string_lossy().to_string()],
                platform: None,
                has_steam_cloud: false,
            },
        ];

        let games = scan_candidates(candidates);
        assert_eq!(games.len(), 2);
        assert_eq!(games[0].name, "Amnesia");
        assert_eq!(games[1].name, "Zelda");
    }
}
