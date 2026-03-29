import { useState, useEffect } from "react";
import { useStore } from "../store/useStore";

export function ConnectingLine() {
  const connectingFrom = useStore((s) => s.connectingFrom);
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const setConnectingFrom = useStore((s) => s.setConnectingFrom);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  const sourceIdea = canvas?.ideas.find((i) => i.id === connectingFrom);

  useEffect(() => {
    if (!connectingFrom) return;

    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConnectingFrom(null);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setConnectingFrom(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [connectingFrom, setConnectingFrom]);

  if (!connectingFrom || !sourceIdea) return null;

  const viewport = canvas!.viewport;
  const sx = sourceIdea.x * viewport.zoom + viewport.x + ((sourceIdea.width || 200) / 2) * viewport.zoom;
  const sy = sourceIdea.y * viewport.zoom + viewport.y + 22 * viewport.zoom;

  return (
    <>
      {/* Connection mode status bar */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2000,
          padding: "6px 16px",
          border: "1px solid var(--border-default)",
          background: "var(--bg-surface)",
          fontSize: "var(--label-size)",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-secondary)",
          pointerEvents: "none",
          animation: "status-fade-in 0.15s ease forwards",
          whiteSpace: "nowrap",
        }}
      >
        MODE: CONNECTING {"\u00B7"} ESC TO CANCEL
      </div>

      {/* Connection preview line */}
      <svg
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 800,
        }}
      >
        <line
          x1={sx}
          y1={sy}
          x2={mousePos.x}
          y2={mousePos.y}
          stroke="var(--text-primary)"
          strokeWidth={1}
          opacity={0.2}
          strokeDasharray="6 4"
        />
      </svg>
    </>
  );
}
