mod cache;
mod epic;
mod files;
mod gog;
mod localized_names;
mod localized_paths;
mod manifest;
mod registry;
mod resolve;
mod steam;
mod types;

pub use types::DetectedGame;

use std::path::Path;

use epic::find_epic_app_roots;
use files::{collect_save_files, scan_candidates};
use gog::find_gog_app_roots;
use manifest::{fetch_manifest, resolve_candidates};
use resolve::{get_home, get_username};
use steam::{find_steam_app_roots, find_steam_libraries};

pub fn scan_manual_game_blocking(name: String, paths: Vec<String>) -> DetectedGame {
    let mut seen = std::collections::HashSet::new();
    let save_files: Vec<_> = paths
        .iter()
        .flat_map(|path| collect_save_files(Path::new(path), &name))
        .filter(|file| seen.insert(file.path.clone()))
        .collect();

    let existing_paths = paths
        .into_iter()
        .filter(|p| Path::new(p).exists())
        .collect();

    DetectedGame {
        name,
        steam_id: None,
        save_paths: existing_paths,
        save_files,
        registry_keys: Vec::new(),
        platform: None,
        has_steam_cloud: false,
    }
}

pub fn get_cached_games_blocking() -> Vec<DetectedGame> {
    cache::load()
}

pub fn scan_games_blocking() -> Result<Vec<DetectedGame>, String> {
    let manifest = fetch_manifest()?;

    let home = get_home()
        .map(|h| h.to_string_lossy().to_string())
        .ok_or("Cannot determine home directory")?;
    let username = get_username();

    let steam_libraries = find_steam_libraries();
    let steam_roots = find_steam_app_roots(&steam_libraries);
    let gog_roots = find_gog_app_roots();
    let epic_roots = find_epic_app_roots();

    let candidates = resolve_candidates(manifest, &home, &username, &steam_roots, &gog_roots, &epic_roots);
    let games = scan_candidates(candidates);
    cache::save(&games);
    Ok(games)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn manual_scan_deduplicates_files_from_nested_paths() {
        let dir = TempDir::new().unwrap();
        let parent = dir.path().join("profiles").join("user1");
        let child = parent.join("Savegames");
        fs::create_dir_all(&child).unwrap();

        File::create(parent.join("config.ini"))
            .unwrap()
            .write_all(b"cfg")
            .unwrap();
        File::create(child.join("slot1.dat"))
            .unwrap()
            .write_all(b"save")
            .unwrap();

        let game = scan_manual_game_blocking(
            "TestGame".to_string(),
            vec![
                parent.to_string_lossy().to_string(),
                child.to_string_lossy().to_string(),
            ],
        );

        assert_eq!(game.save_files.len(), 2);
    }
}
