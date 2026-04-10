import { useEffect } from "react";
import { useStore } from "../store/useStore";

const DIRECTION_ARROW: Record<string, string> = {
  N: '↑', S: '↓', E: '→', W: '←',
};

export function GhostOffScreenBanner() {
  const offScreenGhosts = useStore((s) => s.offScreenGhosts);
  const clearOffScreenGhosts = useStore((s) => s.clearOffScreenGhosts);
  const setViewport = useStore((s) => s.setViewport);
  const ghostNodes = useStore((s) => s.ghostNodes);
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);

  // Auto-clear after 5 seconds
  useEffect(() => {
    if (!offScreenGhosts) return;
    const timer = setTimeout(() => clearOffScreenGhosts(), 5000);
    return () => clearTimeout(timer);
  }, [offScreenGhosts, clearOffScreenGhosts]);

  if (!offScreenGhosts) return null;

  const icon = offScreenGhosts.type === 'wildcard' ? '✸' : '◆';
  const label = offScreenGhosts.type === 'wildcard' ? 'WILD CARD' : 'SYNTHESIS';
  const arrow = offScreenGhosts.direction ? DIRECTION_ARROW[offScreenGhosts.direction] : '→';
  const count = offScreenGhosts.count;

  function handleClick() {
    const targetGhosts = ghostNodes.filter((g) => offScreenGhosts!.ids.includes(g.id));
    if (targetGhosts.length === 0) { clearOffScreenGhosts(); return; }

    const avgX = targetGhosts.reduce((s, g) => s + g.x, 0) / targetGhosts.length;
    const avgY = targetGhosts.reduce((s, g) => s + g.y, 0) / targetGhosts.length;

    const canvas = canvases.find((c) => c.id === activeCanvasId);
    const vp = canvas?.viewport ?? { x: 0, y: 0, zoom: 1 };

    setViewport({
      x: -avgX * vp.zoom + window.innerWidth / 2,
      y: -avgY * vp.zoom + window.innerHeight / 2,
    });

    clearOffScreenGhosts();
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: '#0E0E0E',
        border: '1px solid #222222',
        borderRadius: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: offScreenGhosts.type === 'wildcard' ? '#CC8844' : '#4466AA',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      {icon} {count} {label}{count !== 1 ? 'S' : ''} {arrow}
    </div>
  );
}
