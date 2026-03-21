use std::path::Path;

use super::localized_names;

/// Expands a path into concrete, existing directory paths.
/// Handles glob wildcards (from `<storeUserId>` → `*`) and tries localized
/// folder name variants (e.g. "The Sims 4" → "Les Sims 4") with both
/// regular and non-breaking spaces (EA uses U+00A0 in some locales).
pub fn resolve_localized_paths(path: &str) -> Vec<String> {
    if let Some(expanded) = expand_if_exists(path) {
        return expanded;
    }

    localized_names::ENTRIES
        .iter()
        .filter(|(english_name, _)| path.contains(english_name.as_str()))
        .find_map(|(english_name, variants)| {
            variants.iter().find_map(|variant| {
                let candidate = path.replace(english_name.as_str(), variant);
                if let Some(expanded) = expand_if_exists(&candidate) {
                    return Some(expanded);
                }
                if !variant.contains(' ') {
                    return None;
                }
                let nbsp_variant = variant.replace(' ', "\u{00a0}");
                let candidate = path.replace(english_name.as_str(), &nbsp_variant);
                expand_if_exists(&candidate)
            })
        })
        .unwrap_or_default()
}

fn expand_if_exists(path: &str) -> Option<Vec<String>> {
    if path.contains('*') {
        let matches: Vec<String> = glob::glob(path)
            .ok()?
            .filter_map(|entry| entry.ok())
            .filter(|matched| matched.is_dir())
            .map(|matched| matched.to_string_lossy().to_string())
            .collect();
        if matches.is_empty() {
            return None;
        }
        return Some(matches);
    }

    if !Path::new(path).exists() {
        return None;
    }

    Some(vec![path.to_string()])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use tempfile::TempDir;

    #[test]
    fn resolves_french_sims_4() {
        let dir = TempDir::new().unwrap();
        let ea = dir.path().join("Electronic Arts");
        let sims_fr = ea.join("Les Sims 4").join("saves");
        fs::create_dir_all(&sims_fr).unwrap();

        let english_path = ea.join("The Sims 4").join("saves");
        let result = resolve_localized_paths(&english_path.to_string_lossy());

        assert_eq!(result.len(), 1);
        assert!(result[0].contains("Les Sims 4"));
    }

    #[test]
    fn resolves_german_sims_4() {
        let dir = TempDir::new().unwrap();
        let ea = dir.path().join("Electronic Arts");
        let sims_de = ea.join("Die Sims 4").join("saves");
        fs::create_dir_all(&sims_de).unwrap();

        let english_path = ea.join("The Sims 4").join("saves");
        let result = resolve_localized_paths(&english_path.to_string_lossy());

        assert_eq!(result.len(), 1);
        assert!(result[0].contains("Die Sims 4"));
    }

    #[test]
    fn returns_empty_when_no_variant_exists() {
        let dir = TempDir::new().unwrap();
        let ea = dir.path().join("Electronic Arts");
        fs::create_dir_all(&ea).unwrap();

        let english_path = ea.join("The Sims 4").join("saves");
        let result = resolve_localized_paths(&english_path.to_string_lossy());

        assert!(result.is_empty());
    }

    #[test]
    fn returns_original_when_english_exists() {
        let dir = TempDir::new().unwrap();
        let ea = dir.path().join("Electronic Arts");
        let sims_en = ea.join("The Sims 4").join("saves");
        fs::create_dir_all(&sims_en).unwrap();

        let result = resolve_localized_paths(&sims_en.to_string_lossy());

        assert_eq!(result.len(), 1);
        assert!(result[0].contains("The Sims 4"));
    }

    #[test]
    fn resolves_french_sims_4_with_nbsp() {
        let dir = TempDir::new().unwrap();
        let ea = dir.path().join("Electronic Arts");
        let sims_fr = ea.join("Les\u{00a0}Sims\u{00a0}4").join("saves");
        fs::create_dir_all(&sims_fr).unwrap();

        let english_path = ea.join("The Sims 4").join("saves");
        let result = resolve_localized_paths(&english_path.to_string_lossy());

        assert_eq!(result.len(), 1);
        assert!(result[0].contains("Les\u{00a0}Sims\u{00a0}4"));
    }

    #[test]
    fn ignores_unrelated_paths() {
        let dir = TempDir::new().unwrap();
        let game_dir = dir.path().join("Undertale");
        fs::create_dir_all(&game_dir).unwrap();

        let result = resolve_localized_paths(&dir.path().join("Minecraft").to_string_lossy());

        assert!(result.is_empty());
    }

    #[test]
    fn expands_glob_to_matching_directories() {
        let dir = TempDir::new().unwrap();
        let user_a = dir.path().join("game").join("user_123");
        let user_b = dir.path().join("game").join("user_456");
        fs::create_dir_all(&user_a).unwrap();
        fs::create_dir_all(&user_b).unwrap();

        let glob_path = format!("{}/game/*", dir.path().to_string_lossy());
        let result = resolve_localized_paths(&glob_path);

        assert_eq!(result.len(), 2);
    }

    #[test]
    fn glob_skips_files() {
        let dir = TempDir::new().unwrap();
        let subdir = dir.path().join("game").join("user_123");
        fs::create_dir_all(&subdir).unwrap();
        File::create(dir.path().join("game").join("config.txt")).unwrap();

        let glob_path = format!("{}/game/*", dir.path().to_string_lossy());
        let result = resolve_localized_paths(&glob_path);

        assert_eq!(result.len(), 1);
        assert!(result[0].contains("user_123"));
    }
}
