import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { UpdateInfo } from "../utils/updater";

interface Props {
  update: UpdateInfo;
  onDismiss: () => void;
}

export function UpdateModal({ update, onDismiss }: Props) {
  const [status, setStatus] = useState<"idle" | "downloading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdate = async () => {
    setStatus("downloading");
    setErrorMsg(null);
    try {
      // Rust command: downloads installer to temp dir, launches it, exits app
      await invoke("download_and_run_installer", { url: update.downloadUrl });
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          width: 380,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--body-size)",
          color: "var(--text-primary)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: "var(--label-size)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--text-tertiary)",
            }}
          >
            UPDATE AVAILABLE
          </span>
          {status === "idle" && (
            <span
              onClick={onDismiss}
              style={{
                cursor: "pointer",
                color: "var(--text-tertiary)",
                fontSize: 16,
                lineHeight: 1,
                opacity: 0.6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
            >
              ×
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "16px 14px" }}>
          <div style={{ marginBottom: 12, lineHeight: 1.6 }}>
            <span style={{ color: "var(--text-secondary)" }}>
              Robinwater{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                v{update.version}
              </span>{" "}
              is available.
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--label-size)",
              color: "var(--text-tertiary)",
              marginBottom: 20,
            }}
          >
            You're on v{update.currentVersion}. The app will close, update
            silently, and reopen automatically.
          </div>

          {status === "error" && errorMsg && (
            <div
              style={{
                marginBottom: 14,
                padding: "8px 10px",
                background: "rgba(200,60,60,0.08)",
                border: "1px solid rgba(200,60,60,0.25)",
                color: "#c83c3c",
                fontSize: "var(--label-size)",
                lineHeight: 1.5,
              }}
            >
              {errorMsg}
            </div>
          )}

          {status === "downloading" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--text-secondary)",
                fontSize: "var(--label-size)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  border: "1px solid var(--text-tertiary)",
                  borderTopColor: "var(--text-primary)",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              Downloading update…
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleUpdate}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  background: "var(--text-primary)",
                  color: "var(--bg-surface)",
                  border: "none",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--label-size)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.opacity = "0.85")
                }
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {status === "error" ? "Retry" : "Update Now"}
              </button>
              <button
                onClick={onDismiss}
                style={{
                  padding: "7px 16px",
                  background: "transparent",
                  color: "var(--text-tertiary)",
                  border: "1px solid var(--border-default)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--label-size)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-tertiary)")
                }
              >
                Later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
