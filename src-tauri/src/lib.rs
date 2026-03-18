mod archive;
mod oauth;
mod scanner;

use scanner::{DetectedGame, scan_manual_game_blocking};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[tauri::command]
async fn scan_games() -> Result<Vec<DetectedGame>, String> {
    tokio::task::spawn_blocking(scanner::scan_games_blocking)
        .await
        .map_err(|e| format!("Scan task failed: {}", e))?
}

#[tauri::command]
async fn create_zip(files: Vec<String>) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || archive::create_zip(files))
        .await
        .map_err(|e| format!("Zip task failed: {}", e))?
}

#[tauri::command]
fn send_native_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    let result = app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show();

    if result.is_err() || cfg!(debug_assertions) {
        // Fallback to osascript in dev mode where Tauri notifications may not display
        let script = format!(
            "display notification \"{}\" with title \"{}\"",
            body.replace('\\', "\\\\").replace('"', "\\\""),
            title.replace('\\', "\\\\").replace('"', "\\\""),
        );
        let _ = std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();
    }

    result.map_err(|e| format!("Notification error: {}", e))
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
fn get_oauth_redirect_uri() -> String {
    oauth::get_redirect_uri()
}

#[tauri::command]
async fn start_oauth(auth_url: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || oauth::wait_for_oauth_code(&auth_url))
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
        .invoke_handler(tauri::generate_handler![scan_games, create_zip, get_oauth_redirect_uri, start_oauth, send_native_notification, scan_manual_game, pick_folder])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show QSave", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
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
                    let tauri::tray::TrayIconEvent::Click { .. } = event else { return };
                    let Some(window) = tray.app_handle().get_webview_window("main") else { return };
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
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            let tauri::RunEvent::Reopen { .. } = event else { return };
            let Some(window) = app.get_webview_window("main") else { return };
            let _ = window.show();
            let _ = window.set_focus();
        });
}
