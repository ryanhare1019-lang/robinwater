import { useState, useRef, useCallback, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../store/useStore";
import { buildDefaultFilename, buildExportText } from "../utils/export";
import { SettingsModal } from "./SettingsModal";

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 14px",
  background: "none",
  border: "none",
  color: "var(--text-primary)",
  fontSize: "var(--label-size)",
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  textAlign: "left",
  cursor: "pointer",
  transition: "background 0.1s ease",
  borderRadius: 0,
};

export function CanvasList() {
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
  const setLeftSidebarOpen = useStore((s) => s.setLeftSidebarOpen);
  const switchCanvas = useStore((s) => s.switchCanvas);
  const addCanvas = useStore((s) => s.addCanvas);
  const renameCanvas = useStore((s) => s.renameCanvas);
  const deleteCanvas = useStore((s) => s.deleteCanvas);
  const config = useStore((s) => s.config);
  const reloadConfig = useStore((s) => s.reloadConfig);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ canvasId: string; x: number; y: number } | null>(null);
  const [exportedId, setExportedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const deleteTimer = useRef<ReturnType<typeof setTimeout>>();
  const exportTimer = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const finishRename = useCallback(() => {
    if (editingId && editName.trim()) renameCanvas(editingId, editName.trim());
    setEditingId(null);
  }, [editingId, editName, renameCanvas]);

  const handleDelete = useCallback(
    (id: string) => {
      if (deletingId === id) {
        deleteCanvas(id);
        setDeletingId(null);
      } else {
        setDeletingId(id);
        if (deleteTimer.current) clearTimeout(deleteTimer.current);
        deleteTimer.current = setTimeout(() => setDeletingId(null), 3000);
      }
    },
    [deletingId, deleteCanvas]
  );

  const handleExport = useCallback(async (canvasId: string) => {
    setCtxMenu(null);
    const canvas = canvases.find((c) => c.id === canvasId);
    if (!canvas) return;

    try {
      const filePath = await save({
        defaultPath: buildDefaultFilename(canvas.name, new Date()),
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      });

      if (!filePath) return;

      await writeTextFile(filePath, buildExportText(canvas));

      setExportedId(canvasId);
      if (exportTimer.current) clearTimeout(exportTimer.current);
      exportTimer.current = setTimeout(() => setExportedId(null), 2000);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [canvases]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(deleteTimer.current);
      clearTimeout(exportTimer.current);
    };
  }, []);

  // Close context menu on click-outside or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-canvas-ctx-menu]")) {
        setCtxMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ctxMenu]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
        style={{
          position: "fixed",
          top: 14,
          left: 14,
          zIndex: 1001,
          background: "none",
          border: "1px solid var(--border-default)",
          borderRadius: 0,
          color: "var(--text-secondary)",
          fontSize: "var(--label-size)",
          fontFamily: "var(--font-mono)",
          width: 28,
          height: 28,
          cursor: "pointer",
          display: leftSidebarOpen ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          transition: "border-color 0.15s ease, color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-default)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
      >
        {leftSidebarOpen ? "\u2212" : "+"}
      </button>

      {/* Sidebar panel */}
      {leftSidebarOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: 220,
            background: "var(--bg-surface)",
            borderRight: "1px solid var(--border-default)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            animation: "slide-in-left 0.25s var(--ease-out) forwards",
            willChange: "transform",
            fontFamily: "var(--font-mono)",
            borderRadius: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 16px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <span
              style={{
                fontSize: "var(--label-size)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--text-tertiary)",
                fontWeight: 400,
              }}
            >
              CANVASES
            </span>
            <span
              onClick={() => setLeftSidebarOpen(false)}
              style={{
                fontSize: "var(--label-size)",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              [{"\u2212"}]
            </span>
          </div>

          {/* Canvas list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {canvases.map((c) => {
              const isActive = c.id === activeCanvasId;
              const isEditing = editingId === c.id;
              const isConfirmDelete = deletingId === c.id;
              const isExported = exportedId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (!isEditing && !isConfirmDelete) switchCanvas(c.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const x = Math.min(e.clientX, window.innerWidth - 148);
                    const y = Math.min(e.clientY, window.innerHeight - 44);
                    setCtxMenu({ canvasId: c.id, x, y });
                  }}
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderLeft: isActive
                      ? "3px solid var(--text-secondary)"
                      : "3px solid transparent",
                    background: isActive ? "var(--bg-active)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: "var(--body-size)",
                    transition: "background 0.1s ease",
                    borderRadius: 0,
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {isConfirmDelete ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        fontSize: "var(--label-size)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "var(--accent-red)" }}>DELETE?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        style={{
                          background: "none",
                          border: "1px solid var(--accent-red)",
                          borderRadius: 0,
                          color: "var(--accent-red)",
                          cursor: "pointer",
                          fontSize: "var(--label-size)",
                          fontFamily: "var(--font-mono)",
                          padding: "1px 6px",
                        }}
                      >
                        Y
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                        style={{
                          background: "none",
                          border: "1px solid var(--text-tertiary)",
                          borderRadius: 0,
                          color: "var(--text-tertiary)",
                          cursor: "pointer",
                          fontSize: "var(--label-size)",
                          fontFamily: "var(--font-mono)",
                          padding: "1px 6px",
                        }}
                      >
                        N
                      </button>
                    </div>
                  ) : isEditing ? (
                    <input
                      ref={inputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={finishRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") finishRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "1px solid var(--border-focus)",
                        borderRadius: 0,
                        color: "var(--text-primary)",
                        fontSize: "var(--body-size)",
                        fontFamily: "var(--font-mono)",
                        padding: "2px 6px",
                      }}
                    />
                  ) : (
                    <>
                      {isActive && (
                        <span style={{ color: "var(--text-secondary)", fontSize: "var(--body-size)" }}>
                          {"\u25B8"}
                        </span>
                      )}
                      <span
                        style={{
                          flex: 1,
                          fontSize: "var(--body-size)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: isExported ? "#44AA66" : undefined,
                          transition: "color 0.15s ease",
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRename(c.id, c.name);
                        }}
                      >
                        {isExported ? "✓ EXPORTED" : c.name}
                      </span>
                      <span style={{ fontSize: "var(--label-size)", color: "var(--text-tertiary)" }}>
                        {c.ideas.length}
                      </span>
                      {canvases.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-tertiary)",
                            fontSize: "var(--body-size)",
                            fontFamily: "var(--font-mono)",
                            cursor: "pointer",
                            padding: "0 2px",
                            opacity: 0.5,
                            transition: "opacity 0.1s ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
                        >
                          x
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* New canvas button */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => addCanvas()}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-tertiary)",
                fontSize: "var(--label-size)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                padding: "8px 0",
                width: "100%",
                textAlign: "left",
                transition: "color 0.1s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
            >
              + NEW CANVAS
            </button>
          </div>

          {/* Settings button */}
          <div style={{ padding: "8px 16px 14px", borderTop: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                background: "#080808",
                border: "1px solid #1A1A1A",
                borderRadius: 0,
                color: "#444444",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                padding: "6px 10px",
                width: "100%",
                textAlign: "left",
                transition: "border-color 0.1s ease, color 0.1s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#333333";
                e.currentTarget.style.color = "#666666";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1A1A1A";
                e.currentTarget.style.color = "#444444";
              }}
            >
              ⚙ SETTINGS
            </button>
          </div>
        </div>
      )}

      {/* Canvas right-click context menu */}
      {ctxMenu && (
        <div
          data-canvas-ctx-menu=""
          style={{
            position: "fixed",
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 3000,
            background: "var(--bg-raised)",
            border: "1px solid var(--border-default)",
            borderRadius: 0,
            padding: 0,
            minWidth: 140,
          }}
        >
          <button
            onClick={() => handleExport(ctxMenu.canvasId)}
            style={menuItemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            ↗ EXPORT
          </button>
        </div>
      )}

      {/* Settings modal */}
      {settingsOpen && config && (
        <SettingsModal
          initialConfig={config}
          onClose={() => {
            setSettingsOpen(false);
            reloadConfig();
          }}
        />
      )}
    </>
  );
}
