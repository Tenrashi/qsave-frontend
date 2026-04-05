use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use super::registry::find_existing_registry_keys;
use super::resolve::{current_os, resolve_path, ResolutionContext};
use super::types::{ManifestEntry, ResolvedCandidate, WhenCondition};

const APP_ID: &str = "com.qsave.app";

struct ManifestSource {
    url: &'static str,
    cache_filename: &'static str,
    bundled: &'static str,
}

const MANIFESTS: &[ManifestSource] = &[
    ManifestSource {
        url: "https://raw.githubusercontent.com/mtkennerly/ludusavi-manifest/master/data/manifest.yaml",
        cache_filename: "manifest.yaml",
        bundled: include_str!("../../resources/manifest.yaml"),
    },
    ManifestSource {
        url: "https://raw.githubusercontent.com/BloodShed-Oni/ludusavi-extra-manifests/main/BS_ex-manifest.yaml",
        cache_filename: "manifest-extra.yaml",
        bundled: include_str!("../../resources/manifest-extra.yaml"),
    },
    ManifestSource {
        url: "https://raw.githubusercontent.com/hvmzx/ludusavi-manifests/main/non-steam-manifest.yml",
        cache_filename: "manifest-hvmzx.yaml",
        bundled: include_str!("../../resources/manifest-hvmzx.yaml"),
    },
];

fn cache_file_path(cache_dir: &Path, filename: &str) -> PathBuf {
    cache_dir.join(APP_ID).join(filename)
}

fn save_to_path(path: &Path, body: &str) {
    let Some(parent) = path.parent() else { return };
    let _ = fs::create_dir_all(parent);
    let _ = fs::write(path, body);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
}

fn load_from_path(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok()
}

fn save_to_cache(filename: &str, body: &str) {
    let Some(cache_dir) = dirs::cache_dir() else { return };
    save_to_path(&cache_file_path(&cache_dir, filename), body);
}

fn load_from_cache(filename: &str) -> Option<String> {
    let cache_dir = dirs::cache_dir()?;
    load_from_path(&cache_file_path(&cache_dir, filename))
}

const MAX_MANIFEST_BYTES: u64 = 10 * 1024 * 1024; // 10 MB

fn download(url: &str, cache_filename: &str) -> Option<String> {
    let etag_filename = format!("{}.etag", cache_filename);
    let stored_etag = load_from_cache(&etag_filename);
    let client = reqwest::blocking::Client::new();

    for _ in 0..2 {
        let mut request = client.get(url);
        if let Some(etag) = &stored_etag {
            request = request.header("If-None-Match", etag.as_str());
        }

        let Ok(response) = request.send() else {
            continue;
        };

        if response.status() == reqwest::StatusCode::NOT_MODIFIED {
            return None;
        }

        let exceeds_limit = response
            .content_length()
            .map_or(false, |len| len > MAX_MANIFEST_BYTES);
        if exceeds_limit {
            return None;
        }

        if let Some(etag_str) = response
            .headers()
            .get("etag")
            .and_then(|val| val.to_str().ok())
        {
            save_to_cache(&etag_filename, etag_str);
        }

        let Ok(body) = response.text() else {
            continue;
        };

        if body.len() as u64 > MAX_MANIFEST_BYTES {
            return None;
        }

        return Some(body);
    }
    None
}

fn resolve_with_fallback(
    downloaded: Option<String>,
    cached: Option<String>,
    bundled: &str,
) -> String {
    downloaded
        .or(cached)
        .unwrap_or_else(|| bundled.to_string())
}

fn fetch_source(source: &ManifestSource) -> String {
    let downloaded = download(source.url, source.cache_filename);
    if let Some(body) = &downloaded {
        save_to_cache(source.cache_filename, body);
    }
    let cached = load_from_cache(source.cache_filename);
    resolve_with_fallback(downloaded, cached, source.bundled)
}

fn merge_manifests(
    base: &mut HashMap<String, ManifestEntry>,
    extra: HashMap<String, ManifestEntry>,
) {
    for (name, entry) in extra {
        let extra_files = match entry.files {
            Some(files) => files,
            None => continue,
        };

        match base.entry(name) {
            std::collections::hash_map::Entry::Occupied(mut occupied) => {
                let existing = occupied.get_mut();
                let existing_files = existing.files.get_or_insert_with(HashMap::new);
                extra_files.into_iter().for_each(|(path, value)| {
                    existing_files.entry(path).or_insert(value);
                });
                if existing.cloud.is_none() {
                    existing.cloud = entry.cloud;
                }
            }
            std::collections::hash_map::Entry::Vacant(vacant) => {
                vacant.insert(ManifestEntry {
                    files: Some(extra_files),
                    registry: entry.registry,
                    install_dir: entry.install_dir,
                    alias: entry.alias,
                    steam: entry.steam,
                    gog: entry.gog,
                    cloud: entry.cloud,
                    _rest: entry._rest,
                });
            }
        }
    }
}

fn fill_option<T>(target: &mut Option<T>, source: Option<T>) {
    if target.is_none() {
        *target = source;
    }
}

fn resolve_aliases(manifest: &mut HashMap<String, ManifestEntry>) {
    let aliases: Vec<(String, String)> = manifest
        .iter()
        .filter_map(|(name, entry)| {
            entry
                .alias
                .as_ref()
                .map(|target| (name.clone(), target.clone()))
        })
        .collect();

    for (alias_name, target_name) in aliases {
        let Some(target) = manifest.get(&target_name) else {
            continue;
        };
        let target_files = target.files.clone();
        let target_steam = target.steam.clone();
        let target_gog = target.gog.clone();
        let target_cloud = target.cloud.clone();
        let target_install_dir = target.install_dir.clone();

        let Some(alias_entry) = manifest.get_mut(&alias_name) else {
            continue;
        };
        fill_option(&mut alias_entry.files, target_files);
        fill_option(&mut alias_entry.steam, target_steam);
        fill_option(&mut alias_entry.gog, target_gog);
        fill_option(&mut alias_entry.cloud, target_cloud);
        fill_option(&mut alias_entry.install_dir, target_install_dir);
    }
}

fn matches_when(when: &Option<Vec<WhenCondition>>, os: &str, store: Option<&str>) -> bool {
    let Some(conditions) = when else { return true };
    conditions.iter().any(|condition| {
        let os_ok = condition
            .os
            .as_ref()
            .map_or(true, |required_os| required_os == os);
        let store_ok = condition
            .store
            .as_ref()
            .map_or(true, |required_store| {
                store.map_or(false, |detected| detected == required_store)
            });
        os_ok && store_ok
    })
}

pub fn fetch_manifest() -> Result<HashMap<String, ManifestEntry>, String> {
    let mut combined: HashMap<String, ManifestEntry> = HashMap::new();

    for source in MANIFESTS {
        let body = fetch_source(source);
        let parsed: HashMap<String, ManifestEntry> = serde_yaml::from_str(&body)
            .map_err(|err| format!("Failed to parse {}: {}", source.cache_filename, err))?;
        merge_manifests(&mut combined, parsed);
    }

    resolve_aliases(&mut combined);

    Ok(combined)
}

use super::types::FileEntryMeta;

fn load_secondary_manifest(path: &Path) -> Option<HashMap<String, FileEntryMeta>> {
    let content = fs::read_to_string(path).ok()?;
    let parsed: HashMap<String, ManifestEntry> = serde_yaml::from_str(&content).ok()?;
    parsed
        .into_values()
        .find_map(|entry| entry.files)
}

pub fn resolve_candidates(
    manifest: HashMap<String, ManifestEntry>,
    home: &str,
    username: &str,
    steam_roots: &HashMap<u64, PathBuf>,
    gog_roots: &HashMap<u64, PathBuf>,
) -> Vec<ResolvedCandidate> {
    let os = current_os();

    manifest
        .into_iter()
        .filter_map(|(name, entry)| {
            let files = entry.files?;
            let steam_id = entry.steam.and_then(|s| s.id);
            let gog_id = entry.gog.and_then(|g| g.id);
            let steam_root = steam_id.and_then(|id| steam_roots.get(&id));
            let gog_root = gog_id.and_then(|id| gog_roots.get(&id));
            let platform = steam_root
                .map(|_| "steam".to_string())
                .or_else(|| gog_root.map(|_| "gog".to_string()));
            let manifest_has_steam_cloud = entry.cloud.map_or(false, |c| c.steam);
            let has_steam_cloud =
                platform.as_deref() == Some("steam") && manifest_has_steam_cloud;
            let root = steam_root
                .or(gog_root)
                .map(|path| path.to_string_lossy().into_owned());

            let game_name = entry
                .install_dir
                .as_ref()
                .and_then(|dirs| dirs.keys().next().cloned())
                .unwrap_or_else(|| name.clone());

            let store_game_id = steam_id.or(gog_id).map(|id| id.to_string());

            let ctx = ResolutionContext {
                home,
                username,
                root: root.as_deref(),
                game_name: Some(game_name.as_str()),
                store_game_id: store_game_id.as_deref(),
            };

            let mut all_paths: HashSet<String> = files
                .iter()
                .filter(|(_, meta)| matches_when(&meta.when, os, platform.as_deref()))
                .filter_map(|(raw, _)| resolve_path(raw, &ctx))
                .collect();

            let secondary_files = root
                .as_deref()
                .and_then(|root| load_secondary_manifest(&Path::new(root).join(".ludusavi.yaml")));

            if let Some(extra_files) = secondary_files {
                extra_files
                    .iter()
                    .filter(|(_, meta)| matches_when(&meta.when, os, platform.as_deref()))
                    .filter_map(|(raw, _)| resolve_path(raw, &ctx))
                    .for_each(|path| { all_paths.insert(path); });
            }

            let paths: Vec<String> = all_paths.into_iter().collect();

            let registry_keys = entry
                .registry
                .as_ref()
                .map(|reg| find_existing_registry_keys(reg, platform.as_deref()))
                .unwrap_or_default();

            if paths.is_empty() && registry_keys.is_empty() {
                return None;
            }

            Some(ResolvedCandidate {
                name,
                steam_id,
                paths,
                registry_keys,
                platform,
                has_steam_cloud,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir(test_name: &str) -> PathBuf {
        let dir = env::temp_dir().join("qsave_test").join(test_name);
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn parse_yaml(yaml: &str) -> HashMap<String, ManifestEntry> {
        serde_yaml::from_str(yaml).unwrap()
    }

    // -- cache tests --

    #[test]
    fn cache_round_trip() {
        let dir = temp_dir("cache_round_trip");
        let path = cache_file_path(&dir, "test.yaml");

        save_to_path(&path, "hello: world");
        let loaded = load_from_path(&path);

        assert_eq!(loaded, Some("hello: world".to_string()));
    }

    #[test]
    fn cache_creates_parent_dirs() {
        let dir = temp_dir("cache_creates_dirs");
        let path = cache_file_path(&dir, "nested.yaml");

        assert!(!path.parent().unwrap().exists());
        save_to_path(&path, "content");
        assert!(path.exists());
    }

    #[test]
    fn load_from_missing_file_returns_none() {
        let path = PathBuf::from("/nonexistent/path/manifest.yaml");
        assert_eq!(load_from_path(&path), None);
    }

    // -- fallback chain tests --

    #[test]
    fn fallback_prefers_download() {
        let result = resolve_with_fallback(
            Some("downloaded".to_string()),
            Some("cached".to_string()),
            "bundled",
        );
        assert_eq!(result, "downloaded");
    }

    #[test]
    fn fallback_uses_cache_when_download_fails() {
        let result =
            resolve_with_fallback(None, Some("cached".to_string()), "bundled");
        assert_eq!(result, "cached");
    }

    #[test]
    fn fallback_uses_bundled_when_both_fail() {
        let result = resolve_with_fallback(None, None, "bundled");
        assert_eq!(result, "bundled");
    }

    // -- merge tests --

    #[test]
    fn merge_adds_new_game() {
        let mut base = parse_yaml(
            r#"
GameA:
  files:
    <home>/saves: {}
"#,
        );
        let extra = parse_yaml(
            r#"
GameB:
  files:
    <home>/other: {}
  steam:
    id: 99
"#,
        );

        merge_manifests(&mut base, extra);

        assert!(base.contains_key("GameA"));
        assert!(base.contains_key("GameB"));
        assert_eq!(base["GameB"].steam.as_ref().unwrap().id, Some(99));
    }

    #[test]
    fn merge_extends_existing_game_paths() {
        let mut base = parse_yaml(
            r#"
GameA:
  files:
    <home>/saves: {}
"#,
        );
        let extra = parse_yaml(
            r#"
GameA:
  files:
    <home>/extra: {}
"#,
        );

        merge_manifests(&mut base, extra);

        let files = base["GameA"].files.as_ref().unwrap();
        assert!(files.contains_key("<home>/saves"));
        assert!(files.contains_key("<home>/extra"));
    }

    #[test]
    fn merge_does_not_overwrite_existing_paths() {
        let mut base = parse_yaml(
            r#"
GameA:
  files:
    <home>/saves:
      when:
        - os: windows
"#,
        );
        let extra = parse_yaml(
            r#"
GameA:
  files:
    <home>/saves:
      when:
        - os: linux
"#,
        );

        merge_manifests(&mut base, extra);

        let files = base["GameA"].files.as_ref().unwrap();
        let meta = &files["<home>/saves"];
        let when = meta.when.as_ref().unwrap();
        assert_eq!(when[0].os.as_deref(), Some("windows"));
    }

    #[test]
    fn merge_skips_entries_without_files() {
        let mut base = parse_yaml(
            r#"
GameA:
  files:
    <home>/saves: {}
"#,
        );
        let extra = parse_yaml(
            r#"
GameB:
  steam:
    id: 50
"#,
        );

        merge_manifests(&mut base, extra);

        assert_eq!(base.len(), 1);
        assert!(!base.contains_key("GameB"));
    }

    #[test]
    fn merge_adds_files_to_existing_game_without_files() {
        let mut base: HashMap<String, ManifestEntry> = HashMap::new();
        base.insert(
            "GameA".to_string(),
            ManifestEntry {
                files: None,
                registry: None,
                install_dir: None,
                alias: None,
                steam: None,
                gog: None,
                cloud: None,
                _rest: HashMap::new(),
            },
        );

        let extra = parse_yaml(
            r#"
GameA:
  files:
    <home>/new_path: {}
"#,
        );

        merge_manifests(&mut base, extra);

        let files = base["GameA"].files.as_ref().unwrap();
        assert!(files.contains_key("<home>/new_path"));
    }

    #[test]
    fn merge_carries_over_cloud_from_extra() {
        let mut base = parse_yaml(
            r#"
GameA:
  files:
    <home>/saves: {}
"#,
        );
        let extra = parse_yaml(
            r#"
GameA:
  cloud:
    steam: true
  files:
    <home>/extra: {}
"#,
        );

        merge_manifests(&mut base, extra);

        assert!(base["GameA"].cloud.as_ref().unwrap().steam);
    }

    #[test]
    fn merge_does_not_overwrite_existing_cloud() {
        let mut base = parse_yaml(
            r#"
GameA:
  cloud:
    steam: true
  files:
    <home>/saves: {}
"#,
        );
        let extra = parse_yaml(
            r#"
GameA:
  cloud:
    steam: false
  files:
    <home>/extra: {}
"#,
        );

        merge_manifests(&mut base, extra);

        assert!(base["GameA"].cloud.as_ref().unwrap().steam);
    }

    // -- parsing tests --

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
    fn parse_install_dir() {
        let yaml = r#"
TestGame:
  files:
    <base>/saves: {}
  installDir:
    TestGameDir: {}
  steam:
    id: 42
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let entry = &manifest["TestGame"];
        let install_dir = entry.install_dir.as_ref().unwrap();
        assert!(install_dir.contains_key("TestGameDir"));
    }

    #[test]
    fn parse_alias() {
        let yaml = r#"
"KLAUS":
  alias: "Klaus"
Klaus:
  files:
    <home>/saves: {}
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(manifest["KLAUS"].alias.as_deref(), Some("Klaus"));
    }

    #[test]
    fn parse_when_conditions() {
        let yaml = r#"
TestGame:
  files:
    <home>/saves:
      when:
        - os: windows
        - os: linux
    <home>/mac_saves:
      when:
        - os: mac
          store: steam
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let files = manifest["TestGame"].files.as_ref().unwrap();

        let saves_when = files["<home>/saves"].when.as_ref().unwrap();
        assert_eq!(saves_when.len(), 2);
        assert_eq!(saves_when[0].os.as_deref(), Some("windows"));
        assert_eq!(saves_when[1].os.as_deref(), Some("linux"));

        let mac_when = files["<home>/mac_saves"].when.as_ref().unwrap();
        assert_eq!(mac_when.len(), 1);
        assert_eq!(mac_when[0].os.as_deref(), Some("mac"));
        assert_eq!(mac_when[0].store.as_deref(), Some("steam"));
    }

    // -- when condition tests --

    #[test]
    fn matches_when_none_returns_true() {
        assert!(matches_when(&None, "mac", None));
    }

    #[test]
    fn matches_when_matching_os() {
        let when = Some(vec![WhenCondition {
            os: Some("mac".to_string()),
            store: None,
        }]);
        assert!(matches_when(&when, "mac", None));
    }

    #[test]
    fn matches_when_non_matching_os() {
        let when = Some(vec![WhenCondition {
            os: Some("windows".to_string()),
            store: None,
        }]);
        assert!(!matches_when(&when, "mac", None));
    }

    #[test]
    fn matches_when_or_logic_across_conditions() {
        let when = Some(vec![
            WhenCondition {
                os: Some("windows".to_string()),
                store: None,
            },
            WhenCondition {
                os: Some("mac".to_string()),
                store: None,
            },
        ]);
        assert!(matches_when(&when, "mac", None));
    }

    #[test]
    fn matches_when_and_logic_within_condition() {
        let when = Some(vec![WhenCondition {
            os: Some("windows".to_string()),
            store: Some("steam".to_string()),
        }]);
        assert!(!matches_when(&when, "mac", Some("steam")));
    }

    #[test]
    fn matches_when_store_only_requires_store() {
        let when = Some(vec![WhenCondition {
            os: None,
            store: Some("steam".to_string()),
        }]);
        assert!(matches_when(&when, "mac", Some("steam")));
        assert!(!matches_when(&when, "mac", None));
        assert!(!matches_when(&when, "mac", Some("gog")));
    }

    // -- alias tests --

    #[test]
    fn alias_copies_files_from_target() {
        let mut manifest = parse_yaml(
            r#"
"KLAUS":
  alias: "Klaus"
Klaus:
  files:
    <home>/saves: {}
  steam:
    id: 42
"#,
        );

        resolve_aliases(&mut manifest);

        assert!(manifest["KLAUS"].files.is_some());
        assert!(manifest["KLAUS"]
            .files
            .as_ref()
            .unwrap()
            .contains_key("<home>/saves"));
        assert_eq!(manifest["KLAUS"].steam.as_ref().unwrap().id, Some(42));
    }

    #[test]
    fn alias_skips_missing_target() {
        let mut manifest = parse_yaml(
            r#"
"Alias":
  alias: "NonExistent"
"#,
        );

        resolve_aliases(&mut manifest);

        assert!(manifest["Alias"].files.is_none());
    }

    #[test]
    fn alias_does_not_overwrite_own_files() {
        let mut manifest = parse_yaml(
            r#"
"AliasGame":
  alias: "Target"
  files:
    <home>/own_saves: {}
Target:
  files:
    <home>/target_saves: {}
"#,
        );

        resolve_aliases(&mut manifest);

        let files = manifest["AliasGame"].files.as_ref().unwrap();
        assert!(files.contains_key("<home>/own_saves"));
        assert!(!files.contains_key("<home>/target_saves"));
    }

    // -- resolve_candidates tests --

    #[test]
    fn resolves_store_user_id_as_wildcard() {
        let yaml = r#"
GameA:
  files:
    <home>/saves: {}
GameB:
  files:
    <home>/<storeUserId>/unknown: {}
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &HashMap::new(),
            &HashMap::new(),
        );

        assert_eq!(candidates.len(), 2);
        let game_b = candidates.iter().find(|c| c.name == "GameB").unwrap();
        assert!(game_b.paths[0].contains('*'));
    }

    #[test]
    fn filters_unknown_placeholders() {
        let yaml = r#"
GameA:
  files:
    <home>/saves: {}
GameB:
  files:
    <someUnknownVar>/unknown: {}
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &HashMap::new(),
            &HashMap::new(),
        );

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].name, "GameA");
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
        let candidates =
            resolve_candidates(manifest, "/home/user", "user", &roots, &HashMap::new());

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].paths, vec!["/games/SteamGame/saves"]);
    }

    #[test]
    fn resolves_base_with_install_dir() {
        let yaml = r#"
TestGame:
  files:
    <base>/saves: {}
  installDir:
    TestGameDir: {}
  steam:
    id: 42
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let mut roots = HashMap::new();
        roots.insert(
            42u64,
            PathBuf::from("/steam/steamapps/common/TestGameDir"),
        );
        let candidates =
            resolve_candidates(manifest, "/home/user", "user", &roots, &HashMap::new());

        assert_eq!(candidates.len(), 1);
        assert_eq!(
            candidates[0].paths,
            vec!["/steam/steamapps/common/TestGameDir/saves"]
        );
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
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &HashMap::new(),
            &gog_roots,
        );

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].paths, vec!["/games/GogGame/saves"]);
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
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &steam_roots,
            &gog_roots,
        );

        assert_eq!(candidates.len(), 1);
        assert_eq!(
            candidates[0].paths,
            vec!["/steam/MultiStoreGame/saves"]
        );
    }

    #[test]
    fn platform_is_steam_when_steam_root_matches() {
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
        let candidates =
            resolve_candidates(manifest, "/home/user", "user", &roots, &HashMap::new());

        assert_eq!(candidates[0].platform.as_deref(), Some("steam"));
    }

    #[test]
    fn platform_is_gog_when_gog_root_matches() {
        let yaml = r#"
GogGame:
  files:
    <root>/saves: {}
  gog:
    id: 123
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let mut gog_roots = HashMap::new();
        gog_roots.insert(123u64, PathBuf::from("/games/GogGame"));
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &HashMap::new(),
            &gog_roots,
        );

        assert_eq!(candidates[0].platform.as_deref(), Some("gog"));
    }

    #[test]
    fn platform_is_none_when_no_root_matches() {
        let yaml = r#"
GenericGame:
  files:
    <home>/saves: {}
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &HashMap::new(),
            &HashMap::new(),
        );

        assert!(candidates[0].platform.is_none());
    }

    #[test]
    fn platform_is_steam_over_gog_when_both_match() {
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
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &steam_roots,
            &gog_roots,
        );

        assert_eq!(candidates[0].platform.as_deref(), Some("steam"));
    }

    #[test]
    fn has_steam_cloud_true_when_steam_platform_and_manifest_cloud() {
        let yaml = r#"
CloudGame:
  files:
    <root>/saves: {}
  steam:
    id: 50
  cloud:
    steam: true
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let mut roots = HashMap::new();
        roots.insert(50u64, PathBuf::from("/games/CloudGame"));
        let candidates =
            resolve_candidates(manifest, "/home/user", "user", &roots, &HashMap::new());

        assert!(candidates[0].has_steam_cloud);
    }

    #[test]
    fn has_steam_cloud_false_when_gog_platform_despite_manifest_cloud() {
        let yaml = r#"
CloudGame:
  files:
    <root>/saves: {}
  steam:
    id: 50
  gog:
    id: 60
  cloud:
    steam: true
"#;
        let manifest: HashMap<String, ManifestEntry> = serde_yaml::from_str(yaml).unwrap();
        let mut gog_roots = HashMap::new();
        gog_roots.insert(60u64, PathBuf::from("/games/CloudGame"));
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &HashMap::new(),
            &gog_roots,
        );

        assert!(!candidates[0].has_steam_cloud);
        assert_eq!(candidates[0].platform.as_deref(), Some("gog"));
    }

    #[test]
    fn has_steam_cloud_false_when_no_manifest_cloud() {
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
        let candidates =
            resolve_candidates(manifest, "/home/user", "user", &roots, &HashMap::new());

        assert!(!candidates[0].has_steam_cloud);
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
        let candidates = resolve_candidates(
            manifest,
            "/home/user",
            "user",
            &HashMap::new(),
            &HashMap::new(),
        );

        assert!(candidates.is_empty());
    }
}
