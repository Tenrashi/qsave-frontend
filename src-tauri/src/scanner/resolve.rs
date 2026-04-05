use std::path::PathBuf;

pub fn get_home() -> Option<PathBuf> {
    dirs::home_dir()
}

pub fn get_username() -> String {
    get_home()
        .and_then(|h| h.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_default()
}

pub struct ResolutionContext<'a> {
    pub home: &'a str,
    pub username: &'a str,
    pub root: Option<&'a str>,
    pub game_name: Option<&'a str>,
    pub store_game_id: Option<&'a str>,
}

pub fn resolve_path(raw: &str, ctx: &ResolutionContext) -> Option<String> {
    let mut resolved = raw.to_string();

    let base = ctx.root.map(|root| {
        let game = ctx.game_name.unwrap_or("");
        if game.is_empty() {
            return root.to_string();
        }
        let root_ends_with_game = std::path::Path::new(root)
            .file_name()
            .map_or(false, |name| name.to_string_lossy().eq_ignore_ascii_case(game));
        if root_ends_with_game {
            return root.to_string();
        }
        format!("{}/{}", root, game)
    });

    if let Some(base) = &base {
        resolved = resolved.replace("<base>", base);
        resolved = resolved.replace("<Base>", base);
    }

    if let Some(root) = ctx.root {
        resolved = resolved.replace("<root>", root);
        resolved = resolved.replace("<Root>", root);
    }

    if let Some(game_name) = ctx.game_name {
        resolved = resolved.replace("<game>", game_name);
        resolved = resolved.replace("<Game>", game_name);
    }

    resolved = resolved.replace("<home>", ctx.home);
    resolved = resolved.replace("<Home>", ctx.home);
    resolved = resolved.replace("<osUserName>", ctx.username);
    resolved = resolved.replace("<OsUserName>", ctx.username);
    resolved = resolved.replace("<storeUserId>", "*");
    resolved = resolved.replace("<StoreUserId>", "*");

    let store_game_id = ctx.store_game_id.unwrap_or("*");
    resolved = resolved.replace("<storeGameId>", store_game_id);
    resolved = resolved.replace("<StoreGameId>", store_game_id);

    #[cfg(target_os = "windows")]
    {
        let appdata = format!("{}\\AppData\\Roaming", ctx.home);
        let local_appdata = format!("{}\\AppData\\Local", ctx.home);
        let local_appdata_low = format!("{}\\AppData\\LocalLow", ctx.home);
        let docs = format!("{}\\Documents", ctx.home);
        let public_dir =
            std::env::var("PUBLIC").unwrap_or_else(|_| "C:\\Users\\Public".to_string());
        let program_data =
            std::env::var("PROGRAMDATA").unwrap_or_else(|_| "C:\\ProgramData".to_string());
        let win_dir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());

        resolved = resolved.replace("<winAppData>", &appdata);
        resolved = resolved.replace("<WinAppData>", &appdata);
        resolved = resolved.replace("<winLocalAppData>", &local_appdata);
        resolved = resolved.replace("<WinLocalAppData>", &local_appdata);
        resolved = resolved.replace("<winLocalAppDataLow>", &local_appdata_low);
        resolved = resolved.replace("<WinLocalAppDataLow>", &local_appdata_low);
        resolved = resolved.replace("<winDocuments>", &docs);
        resolved = resolved.replace("<WinDocuments>", &docs);
        resolved = resolved.replace("<winPublic>", &public_dir);
        resolved = resolved.replace("<WinPublic>", &public_dir);
        resolved = resolved.replace("<winProgramData>", &program_data);
        resolved = resolved.replace("<WinProgramData>", &program_data);
        resolved = resolved.replace("<winDir>", &win_dir);
        resolved = resolved.replace("<WinDir>", &win_dir);
    }

    #[cfg(target_os = "macos")]
    {
        let app_support = format!("{}/Library/Application Support", ctx.home);
        resolved = resolved.replace("<xdgData>", &app_support);
        resolved = resolved.replace("<XdgData>", &app_support);
        resolved = resolved.replace("<xdgConfig>", &app_support);
        resolved = resolved.replace("<XdgConfig>", &app_support);
    }

    #[cfg(target_os = "linux")]
    {
        let xdg_data = format!("{}/.local/share", ctx.home);
        let xdg_config = format!("{}/.config", ctx.home);
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

pub fn current_os() -> &'static str {
    #[cfg(target_os = "windows")]
    return "windows";
    #[cfg(target_os = "macos")]
    return "mac";
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    "linux"
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx<'a>(
        home: &'a str,
        username: &'a str,
        root: Option<&'a str>,
        game_name: Option<&'a str>,
        store_game_id: Option<&'a str>,
    ) -> ResolutionContext<'a> {
        ResolutionContext {
            home,
            username,
            root,
            game_name,
            store_game_id,
        }
    }

    #[test]
    fn replaces_home() {
        let c = ctx("/Users/alice", "alice", None, None, None);
        let result = resolve_path("<home>/saves", &c);
        assert_eq!(result, Some("/Users/alice/saves".to_string()));
    }

    #[test]
    fn replaces_username() {
        let c = ctx("/Users/bob", "bob", None, None, None);
        let result = resolve_path("<home>/<osUserName>/data", &c);
        assert_eq!(result, Some("/Users/bob/bob/data".to_string()));
    }

    #[test]
    fn resolves_store_user_id_to_wildcard() {
        let c = ctx("/home/user", "user", None, None, None);
        let result = resolve_path("<storeUserId>/saves", &c);
        assert_eq!(result, Some("*/saves".to_string()));
    }

    #[test]
    fn store_user_id_with_trailing_glob_strips_correctly() {
        let c = ctx("/home/user", "user", None, None, None);
        let result = resolve_path("<home>/<storeUserId>/saves/**", &c);
        assert_eq!(result, Some("/home/user/*/saves".to_string()));
    }

    #[test]
    fn returns_none_for_unresolved_vars() {
        let c = ctx("/home/user", "user", None, None, None);
        let result = resolve_path("<someUnknownVar>/saves", &c);
        assert_eq!(result, None);
    }

    #[test]
    fn strips_trailing_globs() {
        let c = ctx("/home/user", "user", None, None, None);
        let result = resolve_path("<home>/saves/**", &c);
        assert_eq!(result, Some("/home/user/saves".to_string()));

        let result = resolve_path("<home>/saves/*", &c);
        assert_eq!(result, Some("/home/user/saves".to_string()));
    }

    #[test]
    fn replaces_root() {
        let c = ctx("/home/user", "user", Some("/games/MyGame"), None, None);
        let result = resolve_path("<root>/saves", &c);
        assert_eq!(result, Some("/games/MyGame/saves".to_string()));
    }

    #[test]
    fn root_path_without_root_provided_is_filtered() {
        let c = ctx("/home/user", "user", None, None, None);
        let result = resolve_path("<root>/saves", &c);
        assert_eq!(result, None);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn normalizes_backslashes() {
        let c = ctx("/home/user", "user", None, None, None);
        let result = resolve_path("<home>\\saves\\game", &c);
        assert_eq!(result, Some("/home/user/saves/game".to_string()));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn replaces_xdg_data_on_macos() {
        let c = ctx("/Users/alice", "alice", None, None, None);
        let result = resolve_path("<xdgData>/GameName", &c);
        assert_eq!(
            result,
            Some("/Users/alice/Library/Application Support/GameName".to_string())
        );
    }

    #[test]
    fn replaces_base_with_root_when_game_matches_root_dir() {
        let c = ctx(
            "/home/user",
            "user",
            Some("/games/steamapps/common/Gnorp"),
            Some("Gnorp"),
            None,
        );
        let result = resolve_path("<base>/saves", &c);
        assert_eq!(
            result,
            Some("/games/steamapps/common/Gnorp/saves".to_string())
        );
    }

    #[test]
    fn replaces_base_case_insensitive_match() {
        let c = ctx(
            "/home/user",
            "user",
            Some("/games/steamapps/common/gnorp"),
            Some("Gnorp"),
            None,
        );
        let result = resolve_path("<base>/saves", &c);
        assert_eq!(
            result,
            Some("/games/steamapps/common/gnorp/saves".to_string())
        );
    }

    #[test]
    fn replaces_base_appends_game_when_root_differs() {
        let c = ctx(
            "/home/user",
            "user",
            Some("/games/library"),
            Some("Gnorp"),
            None,
        );
        let result = resolve_path("<base>/saves", &c);
        assert_eq!(result, Some("/games/library/Gnorp/saves".to_string()));
    }

    #[test]
    fn replaces_base_equals_root_when_no_game_name() {
        let c = ctx("/home/user", "user", Some("/games/MyGame"), None, None);
        let result = resolve_path("<base>/saves", &c);
        assert_eq!(result, Some("/games/MyGame/saves".to_string()));
    }

    #[test]
    fn replaces_game_placeholder() {
        let c = ctx("/home/user", "user", None, Some("Gnorp"), None);
        let result = resolve_path("<home>/<game>/saves", &c);
        assert_eq!(result, Some("/home/user/Gnorp/saves".to_string()));
    }

    #[test]
    fn replaces_store_game_id() {
        let c = ctx("/home/user", "user", None, None, Some("12345"));
        let result = resolve_path("<home>/<storeGameId>/data", &c);
        assert_eq!(result, Some("/home/user/12345/data".to_string()));
    }

    #[test]
    fn store_game_id_defaults_to_wildcard() {
        let c = ctx("/home/user", "user", None, None, None);
        let result = resolve_path("<home>/<storeGameId>/data", &c);
        assert_eq!(result, Some("/home/user/*/data".to_string()));
    }

    #[test]
    fn base_without_root_returns_none() {
        let c = ctx("/home/user", "user", None, Some("Gnorp"), None);
        let result = resolve_path("<base>/saves", &c);
        assert_eq!(result, None);
    }
}
