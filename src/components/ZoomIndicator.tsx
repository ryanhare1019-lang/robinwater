import { useStore } from "../store/useStore";

export function ZoomIndicator() {
  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const setViewport = useStore((s) => s.setViewport);
  const ideas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });

  const handleClick = () => {
    if (ideas.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
    } else {
      const midX = ideas.reduce((sum, i) => sum + i.x, 0) / ideas.length;
      const midY = ideas.reduce((sum, i) => sum + i.y, 0) / ideas.length;
      setViewport({
        x: window.innerWidth / 2 - midX,
        y: window.innerHeight / 2 - midY,
        zoom: 1,
      });
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 600,
        fontSize: "10px",
        fontFamily: "var(--font-mono)",
        color: "#333333",
        cursor: "pointer",
        userSelect: "none",
        letterSpacing: "0.04em",
        transition: "color 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#666666")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#333333")}
      title="Click to reset zoom (Ctrl+0)"
    >
      {zoom.toFixed(2)}x
    </div>
  );
}
