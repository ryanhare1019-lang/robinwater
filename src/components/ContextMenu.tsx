import { useEffect } from "react";
import { useStore } from "../store/useStore";

export function ContextMenu() {
  const nodeId = useStore((s) => s.contextMenuNodeId);
  const pos = useStore((s) => s.contextMenuPos);
  const setContextMenu = useStore((s) => s.setContextMenu);
  const setConnectingFrom = useStore((s) => s.setConnectingFrom);
  const deleteIdea = useStore((s) => s.deleteIdea);
  const setSelectedId = useStore((s) => s.setSelectedId);

  useEffect(() => {
    if (!nodeId) return;
    const close = () => setContextMenu(null, null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [nodeId, setContextMenu]);

  if (!nodeId || !pos) return null;

  const menuItemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "8px 14px",
    background: "none",
    border: "none",
    color: "var(--text-primary)",
    fontSize: "var(--body-size)",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    textAlign: "left",
    cursor: "pointer",
    transition: "background 0.1s ease",
  };

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 3000,
        background: "var(--bg-raised)",
        border: "1px solid var(--border-default)",
        borderRadius: 0,
        padding: 0,
        minWidth: 160,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => {
          setConnectingFrom(nodeId);
        }}
        style={menuItemStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
      >
        CONNECT TO...
      </button>

      <div style={{ height: 1, background: "var(--border-subtle)" }} />

      <button
        onClick={() => {
          setSelectedId(nodeId);
        }}
        style={menuItemStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
      >
        EDIT
      </button>

      <div style={{ height: 1, background: "var(--border-subtle)" }} />

      <button
        onClick={() => {
          deleteIdea(nodeId);
          setContextMenu(null, null);
        }}
        style={{ ...menuItemStyle, color: "var(--accent-red)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
      >
        DELETE
      </button>
    </div>
  );
}
