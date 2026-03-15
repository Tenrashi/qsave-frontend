use std::path::PathBuf;

pub fn get_home() -> Option<PathBuf> {
    dirs::home_dir()
}

pub fn get_username() -> String {
    get_home()
        .and_then(|h| h.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_default()
}

pub fn resolve_path(raw: &str, home: &str, username: &str) -> Option<String> {
    let mut resolved = raw.to_string();

    resolved = resolved.replace("<home>", home);
    resolved = resolved.replace("<Home>", home);
    resolved = resolved.replace("<osUserName>", username);
    resolved = resolved.replace("<OsUserName>", username);

    #[cfg(target_os = "windows")]
    {
        let appdata = format!("{}\\AppData\\Roaming", home);
        let local_appdata = format!("{}\\AppData\\Local", home);
        let docs = format!("{}\\Documents", home);
        let public_dir = "C:\\Users\\Public";
        resolved = resolved.replace("<winAppData>", &appdata);
        resolved = resolved.replace("<WinAppData>", &appdata);
        resolved = resolved.replace("<winLocalAppData>", &local_appdata);
        resolved = resolved.replace("<WinLocalAppData>", &local_appdata);
        resolved = resolved.replace("<winDocuments>", &docs);
        resolved = resolved.replace("<WinDocuments>", &docs);
        resolved = resolved.replace("<winPublic>", public_dir);
        resolved = resolved.replace("<WinPublic>", public_dir);
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
        let result = resolve_path("<home>/saves", "/Users/alice", "alice");
        assert_eq!(result, Some("/Users/alice/saves".to_string()));
    }

    #[test]
    fn replaces_username() {
        let result = resolve_path("<home>/<osUserName>/data", "/Users/bob", "bob");
        assert_eq!(result, Some("/Users/bob/bob/data".to_string()));
    }

    #[test]
    fn returns_none_for_unresolved_vars() {
        let result = resolve_path("<storeUserId>/saves", "/home/user", "user");
        assert_eq!(result, None);
    }

    #[test]
    fn strips_trailing_globs() {
        let result = resolve_path("<home>/saves/**", "/home/user", "user");
        assert_eq!(result, Some("/home/user/saves".to_string()));

        let result = resolve_path("<home>/saves/*", "/home/user", "user");
        assert_eq!(result, Some("/home/user/saves".to_string()));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn normalizes_backslashes() {
        let result = resolve_path("<home>\\saves\\game", "/home/user", "user");
        assert_eq!(result, Some("/home/user/saves/game".to_string()));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn replaces_xdg_data_on_macos() {
        let result = resolve_path("<xdgData>/GameName", "/Users/alice", "alice");
        assert_eq!(
            result,
            Some("/Users/alice/Library/Application Support/GameName".to_string())
        );
    }
}
