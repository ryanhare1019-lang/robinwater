import { useState, useRef, useCallback, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../store/useStore";
import { buildDefaultFilename, buildExportText, buildDefaultMarkdownFilename, buildExportMarkdown } from "../utils/export";
import { SettingsModal } from "./SettingsModal";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { serializeCanvas, buildMonoliteFilename, parseMonoliteFile } from "../utils/monoliteFile";
import type { MonoliteFileCanvas } from "../utils/monoliteFile";
import { MonoliteImportModal, MonoliteErrorModal } from "./MonoliteImportModal";

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
  const settingsOpen = useStore((s) => s.settingsModalOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsModalOpen);

  // Folder state from store
  const folders = useStore((s) => s.folders);
  const addFolder = useStore((s) => s.addFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const renameFolder = useStore((s) => s.renameFolder);
  const toggleFolderCollapse = useStore((s) => s.toggleFolderCollapse);
  const moveCanvasToFolder = useStore((s) => s.moveCanvasToFolder);

  // Canvas editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ canvasId: string; x: number; y: number } | null>(null);
  const [exportedId, setExportedId] = useState<string | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  // Folder editing state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  const importCanvas = useStore((s) => s.importCanvas);

  const [importPending, setImportPending] = useState<{
    canvas: MonoliteFileCanvas;
    exportedAt: string;
    skippedCount: number;
    versionWarning: boolean;
    largeCanvasWarning: boolean;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importToast, setImportToast] = useState<string | null>(null);
  const importToastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [sharedId, setSharedId] = useState<string | null>(null);
  const sharedTimer = useRef<ReturnType<typeof setTimeout>>();

  const deleteTimer = useRef<ReturnType<typeof setTimeout>>();
  const exportTimer = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const finishRename = useCallback(() => {
    if (editingId && editName.trim()) renameCanvas(editingId, editName.trim());
    setEditingId(null);
  }, [editingId, editName, renameCanvas]);

  const startFolderRename = useCallback((id: string, name: string) => {
    setEditingFolderId(id);
    setEditFolderName(name);
    setTimeout(() => folderInputRef.current?.select(), 0);
  }, []);

  const finishFolderRename = useCallback(() => {
    if (editingFolderId && editFolderName.trim()) renameFolder(editingFolderId, editFolderName.trim());
    setEditingFolderId(null);
  }, [editingFolderId, editFolderName, renameFolder]);

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

  const handleExportMarkdown = useCallback(async (canvasId: string) => {
    setCtxMenu(null);
    const canvas = canvases.find((c) => c.id === canvasId);
    if (!canvas) return;

    try {
      const filePath = await save({
        defaultPath: buildDefaultMarkdownFilename(canvas.name, new Date()),
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });

      if (!filePath) return;

      await writeTextFile(filePath, buildExportMarkdown(canvas));

      setExportedId(canvasId);
      if (exportTimer.current) clearTimeout(exportTimer.current);
      exportTimer.current = setTimeout(() => setExportedId(null), 2000);
    } catch (err) {
      console.error("Markdown export failed:", err);
    }
  }, [canvases]);

  const handleShareMonolite = useCallback(async (canvasId: string) => {
    setCtxMenu(null);
    const canvas = canvases.find((c) => c.id === canvasId);
    if (!canvas) return;

    try {
      const filePath = await save({
        defaultPath: buildMonoliteFilename(canvas.name),
        filters: [{ name: 'Monolite Canvas', extensions: ['monolite'] }],
      });
      if (!filePath) return;

      await writeTextFile(filePath, serializeCanvas(canvas));

      setSharedId(canvasId);
      if (sharedTimer.current) clearTimeout(sharedTimer.current);
      sharedTimer.current = setTimeout(() => setSharedId(null), 2000);
    } catch (err) {
      console.error('Monolite export failed:', err);
    }
  }, [canvases]);

  const handleImportMonolite = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Monolite Canvas', extensions: ['monolite'] }],
      });
      if (!selected || typeof selected !== 'string') return;

      const raw = await readTextFile(selected);
      const result = parseMonoliteFile(raw);

      if (!result.ok) {
        setImportError(result.error);
        return;
      }

      setImportPending({
        canvas: result.canvas,
        exportedAt: result.exportedAt,
        skippedCount: result.skippedCount,
        versionWarning: result.versionWarning,
        largeCanvasWarning: result.largeCanvasWarning,
      });
    } catch (err) {
      console.error('Monolite import failed:', err);
      setImportError('IMPORT FAILED: COULD NOT READ FILE');
    }
  }, []);

  const confirmImport = useCallback(() => {
    if (!importPending) return;
    importCanvas(importPending.canvas);
    const name = importPending.canvas.name.toUpperCase();
    const count = importPending.canvas.ideas.length;
    setImportPending(null);
    setImportToast(`✓ IMPORTED: ${name} (${count} ${count === 1 ? 'IDEA' : 'IDEAS'})`);
    if (importToastTimer.current) clearTimeout(importToastTimer.current);
    importToastTimer.current = setTimeout(() => setImportToast(null), 3000);
  }, [importPending, importCanvas]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(deleteTimer.current);
      clearTimeout(exportTimer.current);
      clearTimeout(sharedTimer.current);
      clearTimeout(importToastTimer.current);
    };
  }, []);

  // Close context menu on click-outside or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-canvas-ctx-menu]")) {
        setCtxMenu(null);
        setShowMoveMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCtxMenu(null);
        setShowMoveMenu(false);
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ctxMenu]);

  // Compute which canvases are in folders (for rendering root canvases)
  const canvasIdsInFolders = new Set(folders.flatMap((f) => f.canvasIds));
  const rootCanvases = canvases.filter((c) => !canvasIdsInFolders.has(c.id));

  // Helper: render a single canvas row
  const renderCanvasRow = (c: typeof canvases[0], indented = false) => {
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
          const x = Math.min(e.clientX, window.innerWidth - 200);
          const y = Math.min(e.clientY, window.innerHeight - 120);
          setCtxMenu({ canvasId: c.id, x, y });
          setShowMoveMenu(false);
        }}
        style={{
          padding: "8px 16px",
          paddingLeft: indented ? 28 : 16,
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
  };

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
            {/* Folders */}
            {folders.map((folder) => {
              const isEditingFolder = editingFolderId === folder.id;
              const folderCanvases = folder.canvasIds
                .map((id) => canvases.find((c) => c.id === id))
                .filter(Boolean) as typeof canvases;

              return (
                <div key={folder.id}>
                  {/* Folder header row */}
                  <div
                    style={{
                      padding: "6px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      borderLeft: "3px solid transparent",
                      userSelect: "none",
                    }}
                    onClick={() => {
                      if (!isEditingFolder) toggleFolderCollapse(folder.id);
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: "var(--label-size)", color: "var(--text-tertiary)", width: 10, flexShrink: 0 }}>
                      {folder.collapsed ? "\u25B8" : "\u25BE"}
                    </span>
                    {isEditingFolder ? (
                      <input
                        ref={folderInputRef}
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        onBlur={finishFolderRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") finishFolderRename();
                          if (e.key === "Escape") setEditingFolderId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "1px solid var(--border-focus)",
                          borderRadius: 0,
                          color: "var(--text-primary)",
                          fontSize: "var(--label-size)",
                          fontFamily: "var(--font-mono)",
                          padding: "2px 6px",
                        }}
                      />
                    ) : (
                      <>
                        <span
                          style={{
                            flex: 1,
                            fontSize: "var(--label-size)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startFolderRename(folder.id, folder.name);
                          }}
                        >
                          {folder.name}
                        </span>
                        <span style={{ fontSize: "var(--label-size)", color: "var(--text-tertiary)", marginRight: 4 }}>
                          {folderCanvases.length}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFolder(folder.id);
                          }}
                          title="Delete folder (canvases return to root)"
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
                            lineHeight: 1,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
                        >
                          x
                        </button>
                      </>
                    )}
                  </div>

                  {/* Canvases inside folder (when expanded) */}
                  {!folder.collapsed && folderCanvases.map((c) => renderCanvasRow(c, true))}
                </div>
              );
            })}

            {/* Root canvases (not in any folder) */}
            {rootCanvases.map((c) => renderCanvasRow(c, false))}
          </div>

          {/* Bottom buttons */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 2 }}>
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
                padding: "6px 0",
                width: "100%",
                textAlign: "left",
                transition: "color 0.1s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
            >
              + NEW CANVAS
            </button>
            <button
              onClick={() => addFolder()}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-tertiary)",
                fontSize: "var(--label-size)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                padding: "6px 0",
                width: "100%",
                textAlign: "left",
                transition: "color 0.1s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
            >
              + NEW FOLDER
            </button>
          </div>

          {/* Import button */}
          <div style={{ padding: "4px 16px 0" }}>
            <button
              onClick={handleImportMonolite}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                padding: "0 0 8px",
                textAlign: "left",
                transition: "color 0.1s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              ↓ IMPORT .MONOLITE
            </button>
          </div>

          {/* Settings button */}
          <div style={{ padding: "8px 16px 14px", borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 6,
              userSelect: "none",
            }}>
              MONOLITE v2.3.0
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 0,
                color: "var(--text-tertiary)",
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
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
                e.currentTarget.style.color = "var(--text-tertiary)";
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
            minWidth: 160,
          }}
        >
          <button
            onClick={() => handleExport(ctxMenu.canvasId)}
            style={menuItemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            ↗ EXPORT .TXT
          </button>
          <button
            onClick={() => handleExportMarkdown(ctxMenu.canvasId)}
            style={menuItemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            ↗ EXPORT .MD
          </button>
          <button
            onClick={() => handleShareMonolite(ctxMenu.canvasId)}
            style={{
              ...menuItemStyle,
              color: sharedId === ctxMenu.canvasId ? '#44AA66' : 'var(--text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            {sharedId === ctxMenu.canvasId ? '✓ SHARED' : '↗ SHARE AS .MONOLITE'}
          </button>

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "2px 0" }} />

          {/* Move to folder section */}
          {(() => {
            const currentFolder = folders.find((f) => f.canvasIds.includes(ctxMenu.canvasId));
            if (folders.length === 0) {
              return (
                <div
                  style={{
                    padding: "8px 14px",
                    fontSize: "var(--label-size)",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  NO FOLDERS
                </div>
              );
            }
            return (
              <>
                <button
                  onClick={() => setShowMoveMenu((v) => !v)}
                  style={{
                    ...menuItemStyle,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  <span>MOVE TO FOLDER</span>
                  <span style={{ opacity: 0.5 }}>{showMoveMenu ? "▴" : "▾"}</span>
                </button>
                {showMoveMenu && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    {currentFolder && (
                      <button
                        onClick={() => {
                          moveCanvasToFolder(ctxMenu.canvasId, null);
                          setCtxMenu(null);
                          setShowMoveMenu(false);
                        }}
                        style={{
                          ...menuItemStyle,
                          paddingLeft: 22,
                          color: "var(--accent-red)",
                          opacity: 0.85,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      >
                        ✕ REMOVE FROM FOLDER
                      </button>
                    )}
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          moveCanvasToFolder(ctxMenu.canvasId, f.id);
                          setCtxMenu(null);
                          setShowMoveMenu(false);
                        }}
                        style={{
                          ...menuItemStyle,
                          paddingLeft: 22,
                          color: f.id === currentFolder?.id ? "var(--text-tertiary)" : "var(--text-primary)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      >
                        {f.id === currentFolder?.id ? "▸ " : ""}{f.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
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

      {/* Monolite import confirmation modal */}
      {importPending && (
        <MonoliteImportModal
          canvas={importPending.canvas}
          exportedAt={importPending.exportedAt}
          skippedCount={importPending.skippedCount}
          versionWarning={importPending.versionWarning}
          largeCanvasWarning={importPending.largeCanvasWarning}
          onConfirm={confirmImport}
          onCancel={() => setImportPending(null)}
        />
      )}

      {/* Monolite import error modal */}
      {importError && (
        <MonoliteErrorModal
          message={importError}
          onClose={() => setImportError(null)}
        />
      )}

      {/* Import success toast */}
      {importToast && (
        <div style={{
          position: 'fixed',
          bottom: 56,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-default)',
          padding: '8px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          color: '#44AA66',
          textTransform: 'uppercase',
          zIndex: 3500,
          pointerEvents: 'none',
          animation: 'chip-enter 0.2s ease forwards',
        }}>
          {importToast}
        </div>
      )}
    </>
  );
}
