use std::collections::HashMap;

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
) -> Vec<(String, Option<u64>, Vec<String>)> {
    manifest
        .into_iter()
        .filter_map(|(name, entry)| {
            let files = entry.files?;
            let steam_id = entry.steam.and_then(|s| s.id);
            let paths: Vec<String> = files
                .keys()
                .filter_map(|raw| resolve_path(raw, home, username))
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
        let candidates = resolve_candidates(manifest, "/home/user", "user");

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].0, "GameA");
    }
}
