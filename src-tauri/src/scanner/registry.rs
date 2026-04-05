use super::types::RegistryEntryMeta;
use std::collections::HashMap;

/// Checks which manifest registry keys actually exist on this system.
/// Returns the list of registry key paths that were found.
/// On non-Windows platforms this always returns an empty vec.
pub fn find_existing_registry_keys(
    entries: &HashMap<String, RegistryEntryMeta>,
    store: Option<&str>,
) -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        find_existing_registry_keys_windows(entries, store)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (entries, store);
        Vec::new()
    }
}

#[cfg(target_os = "windows")]
fn find_existing_registry_keys_windows(
    entries: &HashMap<String, RegistryEntryMeta>,
    store: Option<&str>,
) -> Vec<String> {
    use winreg::RegKey;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};

    entries
        .iter()
        .filter(|(_, meta)| matches_registry_when(meta, store))
        .filter_map(|(key_path, _)| {
            let (hive, subkey) = split_registry_path(key_path)?;
            let root = match hive {
                "HKEY_CURRENT_USER" => RegKey::predef(HKEY_CURRENT_USER),
                "HKEY_LOCAL_MACHINE" => RegKey::predef(HKEY_LOCAL_MACHINE),
                _ => return None,
            };
            root.open_subkey(subkey).ok().map(|_| key_path.clone())
        })
        .collect()
}

#[cfg(any(target_os = "windows", test))]
fn matches_registry_when(meta: &RegistryEntryMeta, store: Option<&str>) -> bool {
    let Some(conditions) = &meta.when else { return true };
    conditions.iter().any(|condition| {
        condition
            .store
            .as_ref()
            .map_or(true, |required| store.map_or(false, |s| s == required))
    })
}

/// Splits "HKEY_CURRENT_USER/Software/GameName" into ("HKEY_CURRENT_USER", "Software\\GameName").
#[cfg(any(target_os = "windows", test))]
fn split_registry_path(path: &str) -> Option<(&str, String)> {
    let slash = path.find('/')?;
    let hive = &path[..slash];
    let subkey = path[slash + 1..].replace('/', "\\");
    Some((hive, subkey))
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::types::RegistryWhenCondition;

    #[test]
    fn split_registry_path_parses_hkcu() {
        let (hive, subkey) = split_registry_path("HKEY_CURRENT_USER/Software/MyGame").unwrap();
        assert_eq!(hive, "HKEY_CURRENT_USER");
        assert_eq!(subkey, "Software\\MyGame");
    }

    #[test]
    fn split_registry_path_parses_nested() {
        let (hive, subkey) =
            split_registry_path("HKEY_LOCAL_MACHINE/SOFTWARE/WOW6432Node/GOG.com").unwrap();
        assert_eq!(hive, "HKEY_LOCAL_MACHINE");
        assert_eq!(subkey, "SOFTWARE\\WOW6432Node\\GOG.com");
    }

    #[test]
    fn split_registry_path_returns_none_for_no_slash() {
        assert!(split_registry_path("HKEY_CURRENT_USER").is_none());
    }

    #[test]
    fn matches_when_no_conditions() {
        let meta = RegistryEntryMeta { when: None };
        assert!(matches_registry_when(&meta, None));
        assert!(matches_registry_when(&meta, Some("steam")));
    }

    #[test]
    fn matches_when_store_matches() {
        let meta = RegistryEntryMeta {
            when: Some(vec![RegistryWhenCondition {
                store: Some("steam".to_string()),
            }]),
        };
        assert!(matches_registry_when(&meta, Some("steam")));
        assert!(!matches_registry_when(&meta, Some("gog")));
        assert!(!matches_registry_when(&meta, None));
    }

    #[test]
    fn matches_when_no_store_constraint() {
        let meta = RegistryEntryMeta {
            when: Some(vec![RegistryWhenCondition { store: None }]),
        };
        assert!(matches_registry_when(&meta, None));
        assert!(matches_registry_when(&meta, Some("steam")));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn non_windows_returns_empty() {
        let mut entries = HashMap::new();
        entries.insert(
            "HKEY_CURRENT_USER/Software/MyGame".to_string(),
            RegistryEntryMeta { when: None },
        );
        let result = find_existing_registry_keys(&entries, None);
        assert!(result.is_empty());
    }
}
