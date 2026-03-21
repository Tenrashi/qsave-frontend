use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub(crate) struct SteamInfo {
    pub id: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct GogInfo {
    pub id: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CloudInfo {
    #[serde(default)]
    pub steam: bool,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ManifestEntry {
    pub files: Option<HashMap<String, serde_yaml::Value>>,
    pub steam: Option<SteamInfo>,
    pub gog: Option<GogInfo>,
    pub cloud: Option<CloudInfo>,
    #[allow(dead_code)]
    #[serde(flatten)]
    pub _rest: HashMap<String, serde_yaml::Value>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedGame {
    pub name: String,
    pub steam_id: Option<u64>,
    pub save_paths: Vec<String>,
    pub save_files: Vec<SaveFileInfo>,
    pub has_steam_cloud: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub last_modified: u64,
    pub game_name: String,
}
