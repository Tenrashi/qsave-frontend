use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const SERVICE: &str = "com.qsave.app";
const TOKENS_KEY: &str = "tokens";

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Tokens {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

static CACHE: Mutex<Option<Tokens>> = Mutex::new(None);

fn keychain_error(action: &str, error: keyring::Error) -> String {
    format!(
        "Failed to {} keychain entry: {}. On Linux, ensure a Secret Service provider (e.g. gnome-keyring) is running.",
        action, error
    )
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, TOKENS_KEY).map_err(|e| keychain_error("create", e))
}

fn cache_get() -> Option<Tokens> {
    CACHE.lock().unwrap().clone()
}

fn cache_set(tokens: Tokens) {
    *CACHE.lock().unwrap() = Some(tokens);
}

fn cache_clear() {
    *CACHE.lock().unwrap() = None;
}

pub fn set_tokens(access_token: Option<String>, refresh_token: Option<String>) -> Result<(), String> {
    let tokens = Tokens { access_token, refresh_token };
    let json = serde_json::to_string(&tokens).map_err(|e| format!("Failed to serialize tokens: {}", e))?;
    entry()?.set_password(&json).map_err(|e| keychain_error("set", e))?;
    cache_set(tokens);
    Ok(())
}

pub fn get_tokens() -> Result<Tokens, String> {
    if let Some(cached) = cache_get() {
        return Ok(cached);
    }

    let tokens = match entry()?.get_password() {
        Ok(json) => serde_json::from_str(&json).map_err(|e| format!("Failed to deserialize tokens: {}", e))?,
        Err(keyring::Error::NoEntry) => Tokens::default(),
        Err(e) => return Err(keychain_error("read", e)),
    };

    cache_set(tokens.clone());
    Ok(tokens)
}

pub fn delete_tokens() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain_error("delete", e)),
    }?;
    cache_clear();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::MutexGuard;

    /// All cache tests share the global CACHE static, so we serialize them
    /// by holding this lock for the duration of each test.
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    fn lock_and_reset() -> MutexGuard<'static, ()> {
        let guard = TEST_LOCK.lock().unwrap();
        cache_clear();
        guard
    }

    #[test]
    fn cache_starts_empty() {
        let _guard = lock_and_reset();
        assert!(cache_get().is_none());
    }

    #[test]
    fn cache_set_makes_tokens_retrievable() {
        let _guard = lock_and_reset();

        let tokens = Tokens {
            access_token: Some("at-123".to_string()),
            refresh_token: Some("rt-456".to_string()),
        };
        cache_set(tokens);

        let cached = cache_get().expect("cache should have tokens");
        assert_eq!(cached.access_token.as_deref(), Some("at-123"));
        assert_eq!(cached.refresh_token.as_deref(), Some("rt-456"));
    }

    #[test]
    fn cache_clear_removes_tokens() {
        let _guard = lock_and_reset();

        cache_set(Tokens {
            access_token: Some("at".to_string()),
            refresh_token: None,
        });
        cache_clear();

        assert!(cache_get().is_none());
    }

    #[test]
    fn cache_set_overwrites_previous_value() {
        let _guard = lock_and_reset();

        cache_set(Tokens {
            access_token: Some("old".to_string()),
            refresh_token: None,
        });
        cache_set(Tokens {
            access_token: Some("new".to_string()),
            refresh_token: Some("rt".to_string()),
        });

        let cached = cache_get().expect("cache should have tokens");
        assert_eq!(cached.access_token.as_deref(), Some("new"));
        assert_eq!(cached.refresh_token.as_deref(), Some("rt"));
    }
}
