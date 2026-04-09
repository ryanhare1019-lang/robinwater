#[tauri::command]
async fn download_and_run_installer(app: tauri::AppHandle, url: String) -> Result<(), String> {
    // Download the installer binary
    let client = reqwest::Client::builder()
        .user_agent("Robinwater-Updater")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    // Save to temp directory using the filename from the URL
    let filename = url
        .split('/')
        .last()
        .unwrap_or("robinwater-setup.exe")
        .to_string();
    let installer_path = std::env::temp_dir().join(&filename);
    std::fs::write(&installer_path, &bytes).map_err(|e| e.to_string())?;

    // Launch the installer
    std::process::Command::new(&installer_path)
        .spawn()
        .map_err(|e| format!("Failed to launch installer: {}", e))?;

    // Exit the app cleanly so the installer can replace files
    app.exit(0);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![download_and_run_installer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
