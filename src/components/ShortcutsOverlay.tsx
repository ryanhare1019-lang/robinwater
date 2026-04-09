import { useEffect } from "react";
import { useStore } from "../store/useStore";

const SECTIONS = [
  {
    title: "NAVIGATION",
    shortcuts: [
      { keys: ["Ctrl+0"], description: "Center / reset view" },
      { keys: ["Ctrl+=", "Ctrl++"], description: "Zoom in" },
      { keys: ["Ctrl+-"], description: "Zoom out" },
      { keys: ["← ↑ → ↓"], description: "Select next / previous idea" },
    ],
  },
  {
    title: "IDEAS",
    shortcuts: [
      { keys: ["Enter"], description: "Add idea (in text input)" },
      { keys: ["Delete", "Backspace"], description: "Delete selected idea (2× confirm)" },
      { keys: ["Escape"], description: "Deselect / cancel" },
      { keys: ["Ctrl+Z"], description: "Undo" },
      { keys: ["Ctrl+Shift+Z", "Ctrl+Y"], description: "Redo" },
    ],
  },
  {
    title: "SELECTION",
    shortcuts: [
      { keys: ["Shift+Click"], description: "Add / remove from multi-selection" },
      { keys: ["Shift+Drag"], description: "Drag-select multiple ideas" },
    ],
  },
  {
    title: "CONNECTIONS",
    shortcuts: [
      { keys: ["Right-click"], description: "Start connection from idea" },
    ],
  },
  {
    title: "VIEW",
    shortcuts: [
      { keys: ["Ctrl+F"], description: "Toggle search bar" },
      { keys: ["Ctrl+."], description: "Toggle AI panel" },
      { keys: ["?", "Ctrl+/"], description: "Toggle this help overlay" },
    ],
  },
];

export function ShortcutsOverlay() {
  const shortcutsOpen = useStore((s) => s.shortcutsOpen);
  const setShortcutsOpen = useStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isEditable =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);

      if (e.key === "?" && !isEditable) {
        e.preventDefault();
        setShortcutsOpen(!shortcutsOpen);
      } else if (e.key === "Escape" && shortcutsOpen) {
        e.stopPropagation();
        setShortcutsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcutsOpen, setShortcutsOpen]);

  if (!shortcutsOpen) return null;

  return (
    <div
      onClick={() => setShortcutsOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 0,
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          fontFamily: "var(--font-mono)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <span
            style={{
              fontSize: "var(--label-size, 11px)",
              color: "var(--text-primary)",
              letterSpacing: "0.1em",
              fontWeight: 600,
            }}
          >
            KEYBOARD SHORTCUTS
          </span>
          <button
            onClick={() => setShortcutsOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: "2px 4px",
              fontFamily: "var(--font-mono)",
            }}
            aria-label="Close shortcuts overlay"
          >
            ✕
          </button>
        </div>

        {/* Sections */}
        <div style={{ padding: "8px 0 16px" }}>
          {SECTIONS.map((section, si) => (
            <div key={section.title}>
              {si > 0 && (
                <div
                  style={{
                    height: 1,
                    background: "var(--border-subtle)",
                    margin: "8px 20px",
                  }}
                />
              )}
              <div
                style={{
                  padding: "10px 20px 4px",
                  fontSize: "var(--label-size, 11px)",
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                {section.title}
              </div>
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.keys.join("+")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 20px",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {shortcut.keys.map((k, ki) => (
                      <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {ki > 0 && (
                          <span style={{ color: "var(--text-tertiary)", fontSize: "var(--label-size, 11px)" }}>
                            /
                          </span>
                        )}
                        <kbd
                          style={{
                            display: "inline-block",
                            padding: "2px 7px",
                            background: "var(--bg-base)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 0,
                            fontSize: "var(--label-size, 11px)",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-mono)",
                            letterSpacing: "0.02em",
                            lineHeight: "1.5",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </div>
                  <span
                    style={{
                      fontSize: "var(--body-size, 12px)",
                      color: "var(--text-secondary)",
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {shortcut.description}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
