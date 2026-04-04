mod cache;
mod files;
mod gog;
mod localized_names;
mod localized_paths;
mod manifest;
mod resolve;
mod steam;
mod types;

pub use types::DetectedGame;

use std::path::Path;

use files::{collect_save_files, scan_candidates};
use gog::find_gog_app_roots;
use manifest::{fetch_manifest, resolve_candidates};
use resolve::{get_home, get_username};
use steam::{find_steam_app_roots, find_steam_libraries};

pub fn scan_manual_game_blocking(name: String, paths: Vec<String>) -> DetectedGame {
    let save_files: Vec<_> = paths
        .iter()
        .flat_map(|p| collect_save_files(Path::new(p), &name))
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

    let candidates = resolve_candidates(manifest, &home, &username, &steam_roots, &gog_roots);
    let games = scan_candidates(candidates);
    cache::save(&games);
    Ok(games)
}
