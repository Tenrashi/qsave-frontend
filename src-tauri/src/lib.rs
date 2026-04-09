mod archive;
mod drive_download;
mod drive_upload;
mod keychain;
mod logger;
mod oauth;
mod scanner;

use archive::{CreateZipFileResult, CreateZipResult, ExtractResult, ZipMeta};
use drive_download::DownloadFileResult;
use drive_upload::UploadFileResult;
use scanner::{DetectedGame, scan_manual_game_blocking};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[tauri::command]
fn get_cached_games() -> Vec<DetectedGame> {
    scanner::get_cached_games_blocking()
}

#[tauri::command]
async fn scan_games() -> Result<Vec<DetectedGame>, String> {
    tokio::task::spawn_blocking(scanner::scan_games_blocking)
        .await
        .map_err(|e| format!("Scan task failed: {}", e))?
}

#[tauri::command]
async fn create_zip(save_paths: Vec<String>, files: Vec<String>) -> Result<CreateZipResult, String> {
    tokio::task::spawn_blocking(move || archive::create_zip(save_paths, files))
        .await
        .map_err(|e| format!("Zip task failed: {}", e))?
}

#[tauri::command]
async fn create_zip_file(save_paths: Vec<String>, files: Vec<String>) -> Result<CreateZipFileResult, String> {
    let file_count = files.len();
    logger::info(&format!("create_zip_file: {file_count} files, save_paths={save_paths:?}"));
    let result = tokio::task::spawn_blocking(move || archive::create_zip_file(save_paths, files))
        .await
        .map_err(|e| format!("Zip task failed: {}", e))?;
    match &result {
        Ok(r) => logger::info(&format!(
            "create_zip_file: done, size={} bytes, path={}",
            r.file_size, r.temp_path
        )),
        Err(e) => logger::error(&format!("create_zip_file: {e}")),
    }
    result
}

#[tauri::command]
async fn upload_file(file_path: String, upload_url: String) -> Result<UploadFileResult, String> {
    logger::info(&format!("upload_file: streaming {file_path}"));
    let result = tokio::task::spawn_blocking(move || {
        drive_upload::upload_file_resumable(&file_path, &upload_url)
    })
    .await
    .map_err(|e| format!("Upload task failed: {e}"))?;
    if let Err(ref e) = result {
        logger::error(&format!("upload_file: {e}"));
    }
    result
}

#[tauri::command]
fn delete_temp_file(file_path: String) -> Result<(), String> {
    std::fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete temp file: {e}"))
}

#[tauri::command]
async fn compute_save_hash(save_paths: Vec<String>, files: Vec<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || archive::compute_save_hash(save_paths, files))
        .await
        .map_err(|e| format!("Hash task failed: {}", e))?
}

#[tauri::command]
async fn extract_zip_file(
    zip_path: String,
    target_dirs: Vec<String>,
) -> Result<ExtractResult, String> {
    logger::info(&format!(
        "extract_zip_file: path={zip_path}, targets={target_dirs:?}"
    ));
    let result = tokio::task::spawn_blocking(move || archive::extract_zip_file(&zip_path, target_dirs))
        .await
        .map_err(|e| format!("Extract task failed: {}", e))?;
    match &result {
        Ok(r) => logger::info(&format!("extract_zip_file: done, file_count={}", r.file_count)),
        Err(e) => logger::error(&format!("extract_zip_file: {e}")),
    }
    result
}

#[tauri::command]
async fn read_zip_meta_file(zip_path: String) -> Result<Option<ZipMeta>, String> {
    tokio::task::spawn_blocking(move || archive::read_zip_meta_file(&zip_path))
        .await
        .map_err(|e| format!("Read meta task failed: {}", e))?
}

#[tauri::command]
async fn download_drive_file(
    file_id: String,
    access_token: String,
) -> Result<DownloadFileResult, String> {
    logger::info(&format!("download_drive_file: file_id={file_id}"));
    let result = tokio::task::spawn_blocking(move || {
        drive_download::download_drive_file(&file_id, &access_token)
    })
    .await
    .map_err(|e| format!("Download task failed: {e}"))?;
    if let Err(ref e) = result {
        logger::error(&format!("download_drive_file: {e}"));
    }
    result
}

#[tauri::command]
fn send_native_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("Notification error: {}", e))
}

#[tauri::command]
async fn scan_manual_game(name: String, paths: Vec<String>) -> DetectedGame {
    let n = name.clone();
    tokio::task::spawn_blocking(move || scan_manual_game_blocking(n, paths))
        .await
        .unwrap_or_else(|_| DetectedGame {
            name,
            steam_id: None,
            save_paths: vec![],
            save_files: vec![],
            registry_keys: vec![],
            platform: None,
            has_steam_cloud: false,
        })
}

#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });
    let path = rx.await.map_err(|e| e.to_string())?;
    Ok(path.and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn keychain_set_tokens(access_token: Option<String>, refresh_token: Option<String>) -> Result<(), String> {
    keychain::set_tokens(access_token, refresh_token)
}

#[tauri::command]
fn keychain_get_tokens() -> Result<keychain::Tokens, String> {
    keychain::get_tokens()
}

#[tauri::command]
fn keychain_delete_tokens() -> Result<(), String> {
    keychain::delete_tokens()
}

#[tauri::command]
async fn start_oauth(auth_url_base: String, expected_state: Option<String>) -> Result<oauth::OAuthResult, String> {
    tokio::task::spawn_blocking(move || oauth::wait_for_oauth_code(&auth_url_base, expected_state.as_deref()))
        .await
        .map_err(|e| format!("OAuth task failed: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![get_cached_games, scan_games, create_zip, create_zip_file, upload_file, download_drive_file, delete_temp_file, compute_save_hash, extract_zip_file, read_zip_meta_file, start_oauth, send_native_notification, scan_manual_game, pick_folder, keychain_set_tokens, keychain_get_tokens, keychain_delete_tokens])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show QSave", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(false)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        #[cfg(target_os = "macos")]
                        let _ = app.set_dock_visibility(true);
                        let Some(window) = app.get_webview_window("main") else { return };
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event else { return };
                    let app = tray.app_handle();
                    #[cfg(target_os = "macos")]
                    let _ = app.set_dock_visibility(true);
                    let Some(window) = app.get_webview_window("main") else { return };
                    let _ = window.show();
                    let _ = window.set_focus();
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                #[cfg(target_os = "macos")]
                let _ = window.app_handle().set_dock_visibility(false);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            {
                let tauri::RunEvent::Reopen { .. } = _event else { return };
                let _ = _app.set_dock_visibility(true);
                let Some(window) = _app.get_webview_window("main") else { return };
                let _ = window.show();
                let _ = window.set_focus();
            }
        });
}
