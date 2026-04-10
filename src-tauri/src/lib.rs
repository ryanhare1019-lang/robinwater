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
        .unwrap_or("robinwater-setup")
        .to_string();
    let installer_path = std::env::temp_dir().join(&filename);
    std::fs::write(&installer_path, &bytes).map_err(|e| e.to_string())?;

    let app_exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();

    install_and_relaunch(&installer_path, &app_exe)?;

    // Exit cleanly so the installer can replace files
    app.exit(0);
    Ok(())
}

#[cfg(target_os = "windows")]
fn install_and_relaunch(installer_path: &std::path::Path, app_exe: &str) -> Result<(), String> {
    let ext = installer_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let installer_str = installer_path.to_string_lossy();
    // Escape single quotes for PowerShell string literals
    let installer_ps = installer_str.replace('\'', "''");
    let app_ps = app_exe.replace('\'', "''");

    let install_cmd = if ext == "msi" {
        format!(
            "Start-Process -Wait msiexec -ArgumentList @('/i', '{}', '/quiet', '/norestart')",
            installer_ps
        )
    } else {
        // NSIS installer — /S runs silently
        format!("Start-Process -Wait -FilePath '{}' -ArgumentList '/S'", installer_ps)
    };

    // PowerShell one-liner: wait for this process to exit, run installer silently, relaunch app
    let script = format!(
        "Start-Sleep -Milliseconds 800; {}; Start-Process -FilePath '{}'",
        install_cmd, app_ps
    );

    std::process::Command::new("powershell")
        .args(["-WindowStyle", "Hidden", "-NoProfile", "-Command", &script])
        .spawn()
        .map_err(|e| format!("Failed to launch updater: {}", e))?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn install_and_relaunch(installer_path: &std::path::Path, _app_exe: &str) -> Result<(), String> {
    let dmg = installer_path.to_string_lossy();
    let dmg_sh = dmg.replace('\'', "'\\''");

    // Mount DMG, copy app bundle to /Applications, unmount, relaunch
    let script = format!(
        r#"
        MOUNT=$(hdiutil attach -quiet -nobrowse '{dmg}' | awk '/\/Volumes\//{print $NF}')
        if [ -z "$MOUNT" ]; then exit 1; fi
        cp -R "$MOUNT"/Robinwater.app /Applications/
        hdiutil detach "$MOUNT" -quiet
        open /Applications/Robinwater.app
        "#,
        dmg = dmg_sh
    );

    std::process::Command::new("sh")
        .args(["-c", &script])
        .spawn()
        .map_err(|e| format!("Failed to launch updater: {}", e))?;

    Ok(())
}

#[cfg(target_os = "linux")]
fn install_and_relaunch(installer_path: &std::path::Path, app_exe: &str) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let ext = installer_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "appimage" {
        // Make executable, replace current binary, relaunch
        std::fs::set_permissions(installer_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
        std::fs::copy(installer_path, app_exe).map_err(|e| e.to_string())?;
        std::process::Command::new(app_exe)
            .spawn()
            .map_err(|e| format!("Failed to relaunch: {}", e))?;
    } else {
        // .deb — launch installer (requires pkexec/gksudo for privilege escalation)
        std::process::Command::new(installer_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

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
