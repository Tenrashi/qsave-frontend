mod files;
mod manifest;
mod resolve;
mod types;

pub use types::DetectedGame;

use std::collections::HashMap;

use files::scan_candidates;
use manifest::{fetch_manifest, resolve_candidates};
use resolve::{get_home, get_username};
use types::ManifestEntry;

pub fn scan_games_blocking() -> Result<Vec<DetectedGame>, String> {
    let body = fetch_manifest()?;

    let manifest: HashMap<String, ManifestEntry> =
        serde_yaml::from_str(&body).map_err(|e| format!("Failed to parse manifest: {}", e))?;

    let home = get_home()
        .map(|h| h.to_string_lossy().to_string())
        .ok_or("Cannot determine home directory")?;
    let username = get_username();

    let candidates = resolve_candidates(manifest, &home, &username);
    Ok(scan_candidates(candidates))
}
