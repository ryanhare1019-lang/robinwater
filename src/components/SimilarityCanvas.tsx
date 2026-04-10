import { useRef, useEffect, useCallback } from "react";
import { useStore } from "../store/useStore";
import { getViewportBounds, lineIntersectsViewport } from "../utils/viewportCulling";

interface SimilarityCanvasProps {
  hiddenIds?: Set<string>;
}

export function SimilarityCanvas({ hiddenIds }: SimilarityCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const lines = useStore((s) => s.similarityLines);
  const ideas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });
  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const viewport = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport ?? { x: 0, y: 0, zoom: 1 };
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Resize canvas if needed
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (lines.length === 0 || zoom < 0.3) return;

    const ideasById = new Map(ideas.map((i) => [i.id, i]));
    const vpBounds = getViewportBounds(viewport, w, h);

    ctx.save();
    ctx.scale(dpr, dpr);
    // Apply viewport transform — we draw in screen space since canvas is fixed-position
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Read CSS variable for line color
    const lineColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--line-color")
      .trim() || "rgba(255,255,255,0.07)";

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1 / viewport.zoom; // Keep 1px apparent width

    // First pass: solid keyword lines
    ctx.globalAlpha = 0.07;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const line of lines) {
      if (line.reason === "tag") continue;
      if (hiddenIds?.has(line.fromId) || hiddenIds?.has(line.toId)) continue;
      const from = ideasById.get(line.fromId);
      const to = ideasById.get(line.toId);
      if (!from || !to) continue;

      const x1 = from.x + 100;
      const y1 = from.y + 22;
      const x2 = to.x + 100;
      const y2 = to.y + 22;

      if (!lineIntersectsViewport(x1, y1, x2, y2, vpBounds)) continue;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Second pass: dashed tag lines
    ctx.globalAlpha = 0.12;
    ctx.setLineDash([4 / viewport.zoom, 6 / viewport.zoom]);
    ctx.beginPath();
    for (const line of lines) {
      if (line.reason !== "tag") continue;
      if (hiddenIds?.has(line.fromId) || hiddenIds?.has(line.toId)) continue;
      const from = ideasById.get(line.fromId);
      const to = ideasById.get(line.toId);
      if (!from || !to) continue;

      const x1 = from.x + 100;
      const y1 = from.y + 22;
      const x2 = to.x + 100;
      const y2 = to.y + 22;

      if (!lineIntersectsViewport(x1, y1, x2, y2, vpBounds)) continue;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    ctx.restore();
  }, [lines, ideas, zoom, viewport, hiddenIds]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Also redraw on window resize
  useEffect(() => {
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  if (lines.length === 0 || zoom < 0.3) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
