#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, AppHandle, http::Response};
use tauri_plugin_global_shortcut::{Shortcut, GlobalShortcutExt};
use tauri_plugin_single_instance::SingleInstanceExt;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BrowserSettings {
    homepage: String,
    new_tab_page: String,
    search_engine: String,
    gemini_api_key: String,
    theme: String,
    particle_density: u32,
    reduced_motion: bool,
    hardware_acceleration: bool,
    block_trackers: bool,
    block_ads: bool,
}

impl Default for BrowserSettings {
    fn default() -> Self {
        Self {
            homepage: "https://www.google.com".into(),
            new_tab_page: "nebula://newtab".into(),
            search_engine: "https://www.google.com/search?q=%s".into(),
            gemini_api_key: "".into(),
            theme: "nebula".into(),
            particle_density: 60,
            reduced_motion: false,
            hardware_acceleration: true,
            block_trackers: true,
            block_ads: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct Bookmark {
    id: String,
    url: String,
    title: String,
    created_at: i64,
}

type SettingsState = Arc<Mutex<BrowserSettings>>;
type BookmarksState = Arc<Mutex<Vec<Bookmark>>>;

#[tauri::command]
async fn get_settings(state: tauri::State<'_, SettingsState>) -> Result<String, String> {
    let settings = state.lock().unwrap();
    Ok(serde_json::to_string(&*settings).unwrap())
}

#[tauri::command]
async fn save_settings(state: tauri::State<'_, SettingsState>, settings: String) -> Result<(), String> {
    let parsed: BrowserSettings = serde_json::from_str(&settings).map_err(|e| e.to_string())?;
    *state.lock().unwrap() = parsed;
    Ok(())
}

#[tauri::command]
async fn get_ai_history() -> Result<String, String> {
    Ok("[]".into())
}

#[tauri::command]
async fn save_ai_history(_history: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn save_bookmark(url: String, title: String, state: tauri::State<'_, BookmarksState>) -> Result<(), String> {
    let mut bookmarks = state.lock().unwrap();
    bookmarks.push(Bookmark {
        id: uuid::Uuid::new_v4().to_string(),
        url,
        title,
        created_at: chrono::Utc::now().timestamp(),
    });
    Ok(())
}

#[tauri::command]
async fn get_bookmarks(state: tauri::State<'_, BookmarksState>) -> Result<String, String> {
    let bookmarks = state.lock().unwrap();
    Ok(serde_json::to_string(&*bookmarks).unwrap())
}

#[tauri::command]
async fn clear_browsing_data(_bookmarks: tauri::State<'_, BookmarksState>) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(debug_assertions)]
        window.open_devtools();
    }
    Ok(())
}

#[tauri::command]
async fn toggle_fullscreen(window: tauri::WebviewWindow) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_minimize(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_maximize(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn window_close(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

fn setup_global_shortcuts(app: &AppHandle) {
    let shortcuts = vec![
        "Ctrl+T",
        "Ctrl+W",
        "Ctrl+Shift+T",
        "Ctrl+L",
        "Ctrl+K",
        "Ctrl+P",
        "Ctrl+Comma",
        "F11",
        "F12",
    ];

    for shortcut_str in shortcuts {
        if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("[shortcut] failed to register {shortcut_str}: {e}");
            }
        } else {
            eprintln!("[shortcut] failed to parse {shortcut_str}");
        }
    }
}

fn main() {
    let settings_state: SettingsState = Arc::new(Mutex::new(BrowserSettings::default()));
    let bookmarks_state: BookmarksState = Arc::new(Mutex::new(Vec::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_positioner::init())
        .manage(settings_state)
        .manage(bookmarks_state)
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_ai_history,
            save_ai_history,
            save_bookmark,
            get_bookmarks,
            clear_browsing_data,
            open_devtools,
            toggle_fullscreen,
            window_minimize,
            window_maximize,
            window_close,
        ])
        .setup(|app| {
            // Single instance - focus existing window on second launch
            let _ = app.handle().plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.show();
                    let _ = window.unminimize();
                }
            }));

            let main_window = app.get_webview_window("main").unwrap();
            main_window.show().unwrap();
            main_window.set_focus().unwrap();

            setup_global_shortcuts(app.handle());

            Ok(())
        })
        .register_uri_scheme_protocol("nebula", |_ctx, request| {
            let url = request.uri().to_string();
            let html = if url == "nebula://newtab" || url == "nebula://newtab/" {
                include_str!("../newtab.html")
            } else {
                "Not Found"
            };
            Response::builder()
                .status(if url == "nebula://newtab" || url == "nebula://newtab/" { 200 } else { 404 })
                .header("Content-Type", "text/html")
                .body(html.as_bytes().to_vec())
                .unwrap()
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
