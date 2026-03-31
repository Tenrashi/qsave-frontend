use std::path::PathBuf;

pub fn get_home() -> Option<PathBuf> {
    dirs::home_dir()
}

pub fn get_username() -> String {
    get_home()
        .and_then(|h| h.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_default()
}

pub fn resolve_path(raw: &str, home: &str, username: &str, root: Option<&str>) -> Option<String> {
    let mut resolved = raw.to_string();

    if let Some(root) = root {
        resolved = resolved.replace("<root>", root);
        resolved = resolved.replace("<Root>", root);
    }

    resolved = resolved.replace("<home>", home);
    resolved = resolved.replace("<Home>", home);
    resolved = resolved.replace("<osUserName>", username);
    resolved = resolved.replace("<OsUserName>", username);
    resolved = resolved.replace("<storeUserId>", "*");
    resolved = resolved.replace("<StoreUserId>", "*");

    #[cfg(target_os = "windows")]
    {
        let appdata = format!("{}\\AppData\\Roaming", home);
        let local_appdata = format!("{}\\AppData\\Local", home);
        let docs = format!("{}\\Documents", home);
        let public_dir = std::env::var("PUBLIC")
            .unwrap_or_else(|_| "C:\\Users\\Public".to_string());
        resolved = resolved.replace("<winAppData>", &appdata);
        resolved = resolved.replace("<WinAppData>", &appdata);
        resolved = resolved.replace("<winLocalAppData>", &local_appdata);
        resolved = resolved.replace("<WinLocalAppData>", &local_appdata);
        resolved = resolved.replace("<winDocuments>", &docs);
        resolved = resolved.replace("<WinDocuments>", &docs);
        resolved = resolved.replace("<winPublic>", &public_dir);
        resolved = resolved.replace("<WinPublic>", &public_dir);
    }

    #[cfg(target_os = "macos")]
    {
        let app_support = format!("{}/Library/Application Support", home);
        resolved = resolved.replace("<xdgData>", &app_support);
        resolved = resolved.replace("<XdgData>", &app_support);
        resolved = resolved.replace("<xdgConfig>", &app_support);
        resolved = resolved.replace("<XdgConfig>", &app_support);
    }

    #[cfg(target_os = "linux")]
    {
        let xdg_data = format!("{}/.local/share", home);
        let xdg_config = format!("{}/.config", home);
        resolved = resolved.replace("<xdgData>", &xdg_data);
        resolved = resolved.replace("<XdgData>", &xdg_data);
        resolved = resolved.replace("<xdgConfig>", &xdg_config);
        resolved = resolved.replace("<XdgConfig>", &xdg_config);
    }

    if resolved.contains('<') && resolved.contains('>') {
        return None;
    }

    #[cfg(not(target_os = "windows"))]
    {
        resolved = resolved.replace('\\', "/");
    }

    resolved = resolved
        .trim_end_matches("/**")
        .trim_end_matches("/*")
        .to_string();

    Some(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_home() {
        let result = resolve_path("<home>/saves", "/Users/alice", "alice", None);
        assert_eq!(result, Some("/Users/alice/saves".to_string()));
    }

    #[test]
    fn replaces_username() {
        let result = resolve_path("<home>/<osUserName>/data", "/Users/bob", "bob", None);
        assert_eq!(result, Some("/Users/bob/bob/data".to_string()));
    }

    #[test]
    fn resolves_store_user_id_to_wildcard() {
        let result = resolve_path("<storeUserId>/saves", "/home/user", "user", None);
        assert_eq!(result, Some("*/saves".to_string()));
    }

    #[test]
    fn store_user_id_with_trailing_glob_strips_correctly() {
        let result = resolve_path("<home>/<storeUserId>/saves/**", "/home/user", "user", None);
        assert_eq!(result, Some("/home/user/*/saves".to_string()));
    }

    #[test]
    fn returns_none_for_unresolved_vars() {
        let result = resolve_path("<someUnknownVar>/saves", "/home/user", "user", None);
        assert_eq!(result, None);
    }

    #[test]
    fn strips_trailing_globs() {
        let result = resolve_path("<home>/saves/**", "/home/user", "user", None);
        assert_eq!(result, Some("/home/user/saves".to_string()));

        let result = resolve_path("<home>/saves/*", "/home/user", "user", None);
        assert_eq!(result, Some("/home/user/saves".to_string()));
    }

    #[test]
    fn replaces_root() {
        let result = resolve_path("<root>/saves", "/home/user", "user", Some("/games/MyGame"));
        assert_eq!(result, Some("/games/MyGame/saves".to_string()));
    }

    #[test]
    fn root_path_without_root_provided_is_filtered() {
        let result = resolve_path("<root>/saves", "/home/user", "user", None);
        assert_eq!(result, None);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn normalizes_backslashes() {
        let result = resolve_path("<home>\\saves\\game", "/home/user", "user", None);
        assert_eq!(result, Some("/home/user/saves/game".to_string()));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn replaces_xdg_data_on_macos() {
        let result = resolve_path("<xdgData>/GameName", "/Users/alice", "alice", None);
        assert_eq!(
            result,
            Some("/Users/alice/Library/Application Support/GameName".to_string())
        );
    }
}
