const SERVICE: &str = "com.qsave.app";

fn keychain_error(action: &str, key: &str, error: keyring::Error) -> String {
    format!(
        "Failed to {} keychain entry '{}': {}. On Linux, ensure a Secret Service provider (e.g. gnome-keyring) is running.",
        action, key, error
    )
}

pub fn set(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| keychain_error("create", key, e))?;
    entry.set_password(value).map_err(|e| keychain_error("set", key, e))
}

pub fn get(key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| keychain_error("create", key, e))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(keychain_error("read", key, e)),
    }
}

pub fn delete(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| keychain_error("create", key, e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain_error("delete", key, e)),
    }
}
