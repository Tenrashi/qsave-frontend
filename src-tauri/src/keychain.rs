use serde::{Deserialize, Serialize};

const SERVICE: &str = "com.qsave.app";
const TOKENS_KEY: &str = "tokens";

#[derive(Serialize, Deserialize, Default)]
pub struct Tokens {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

fn keychain_error(action: &str, error: keyring::Error) -> String {
    format!(
        "Failed to {} keychain entry: {}. On Linux, ensure a Secret Service provider (e.g. gnome-keyring) is running.",
        action, error
    )
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, TOKENS_KEY).map_err(|e| keychain_error("create", e))
}

pub fn set_tokens(access_token: Option<String>, refresh_token: Option<String>) -> Result<(), String> {
    let tokens = Tokens { access_token, refresh_token };
    let json = serde_json::to_string(&tokens).map_err(|e| format!("Failed to serialize tokens: {}", e))?;
    entry()?.set_password(&json).map_err(|e| keychain_error("set", e))
}

pub fn get_tokens() -> Result<Tokens, String> {
    match entry()?.get_password() {
        Ok(json) => serde_json::from_str(&json).map_err(|e| format!("Failed to deserialize tokens: {}", e)),
        Err(keyring::Error::NoEntry) => Ok(Tokens::default()),
        Err(e) => Err(keychain_error("read", e)),
    }
}

pub fn delete_tokens() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain_error("delete", e)),
    }
}
