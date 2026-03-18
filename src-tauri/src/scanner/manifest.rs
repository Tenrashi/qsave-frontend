use std::collections::HashMap;
use std::path::PathBuf;

use super::resolve::resolve_path;
use super::types::ManifestEntry;

const MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/mtkennerly/ludusavi-manifest/master/data/manifest.yaml";

pub fn fetch_manifest() -> Result<String, String> {
    reqwest::blocking::get(MANIFEST_URL)
        .map_err(|e| format!("Failed to download manifest: {}", e))?
        .text()
        .map_err(|e| format!("Failed to read manifest: {}", e))
}

pub fn resolve_candidates(
    manifest: HashMap<String, ManifestEntry>,
    home: &str,
    username: &str,
    steam_roots: &HashMap<u64, PathBuf>,
    gog_roots: &HashMap<u64, PathBuf>,
) -> Vec<(String, Option<u64>, Vec<String>)> {
    manifest
        .into_iter()
        .filter_map(|(name, entry)| {
            let files = entry.files?;
            let steam_id = entry.steam.and_then(|s| s.id);
            let gog_id = entry.gog.and_then(|g| g.id);
            let root = steam_id
                .and_then(|id| steam_roots.get(&id))
                .or_else(|| gog_id.and_then(|id| gog_roots.get(&id)))
                .map(|p| p.to_string_lossy().into_owned());
            let paths: Vec<String> = files
                .keys()
                .filter_map(|raw| resolve_path(raw, home, username, root.as_deref()))
                .collect::<Vec<_>>();

            let paths: Vec<String> = paths
                .into_iter()
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect();

            if paths.is_empty() {
                return None;
            }

            Some((name, steam_id, paths))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_manifest_entry() {
        let yaml = r#"
TestGame:
  files:
    <home>/saves:
      tags: [save]
  steam:
    id: 12345
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        assert!(manifest.contains_key("TestGame"));
        let entry = &manifest["TestGame"];
        assert_eq!(entry.steam.as_ref().unwrap().id, Some(12345));
        assert!(entry.files.as_ref().unwrap().contains_key("<home>/saves"));
    }

    #[test]
    fn parse_manifest_entry_without_steam() {
        let yaml = r#"
IndieGame:
  files:
    <home>/.indie/saves: {}
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let entry = &manifest["IndieGame"];
        assert!(entry.steam.is_none());
        assert!(entry.files.is_some());
    }

    #[test]
    fn filters_empty_paths() {
        let yaml = r#"
GameA:
  files:
    <home>/saves: {}
GameB:
  files:
    <storeUserId>/unknown: {}
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let candidates = resolve_candidates(manifest, "/home/user", "user", &HashMap::new(), &HashMap::new());

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].0, "GameA");
    }

    #[test]
    fn resolves_root_when_steam_id_matches() {
        let yaml = r#"
SteamGame:
  files:
    <root>/saves: {}
  steam:
    id: 42
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let mut roots = HashMap::new();
        roots.insert(42u64, PathBuf::from("/games/SteamGame"));
        let candidates = resolve_candidates(manifest, "/home/user", "user", &roots, &HashMap::new());

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].2, vec!["/games/SteamGame/saves"]);
    }

    #[test]
    fn resolves_root_when_gog_id_matches() {
        let yaml = r#"
GogGame:
  files:
    <root>/saves: {}
  gog:
    id: 1234567890
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let mut gog_roots = HashMap::new();
        gog_roots.insert(1234567890u64, PathBuf::from("/games/GogGame"));
        let candidates = resolve_candidates(manifest, "/home/user", "user", &HashMap::new(), &gog_roots);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].2, vec!["/games/GogGame/saves"]);
    }

    #[test]
    fn steam_root_takes_priority_over_gog() {
        let yaml = r#"
MultiStoreGame:
  files:
    <root>/saves: {}
  steam:
    id: 10
  gog:
    id: 20
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let mut steam_roots = HashMap::new();
        steam_roots.insert(10u64, PathBuf::from("/steam/MultiStoreGame"));
        let mut gog_roots = HashMap::new();
        gog_roots.insert(20u64, PathBuf::from("/gog/MultiStoreGame"));
        let candidates = resolve_candidates(manifest, "/home/user", "user", &steam_roots, &gog_roots);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].2, vec!["/steam/MultiStoreGame/saves"]);
    }

    #[test]
    fn filters_root_path_when_no_root_available() {
        let yaml = r#"
SteamGame:
  files:
    <root>/saves: {}
  steam:
    id: 99
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let candidates = resolve_candidates(manifest, "/home/user", "user", &HashMap::new(), &HashMap::new());

        assert!(candidates.is_empty());
    }
}
