import { useMemo, memo } from "react";
import { useStore } from "../store/useStore";
import { getViewportBounds, lineIntersectsViewport } from "../utils/viewportCulling";

interface ConnectionLinesProps {
  hiddenIds?: Set<string>;
}

function getCurveControlPoints(
  x1: number, y1: number, x2: number, y2: number
): { cpx: number; cpy: number } {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { cpx: mx, cpy: my };
  const offset = Math.min(60, dist * 0.2);
  const nx = -dy / dist;
  const ny = dx / dist;
  return { cpx: mx + nx * offset, cpy: my + ny * offset };
}

interface PathData {
  id: string;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sourceId: string;
  targetId: string;
}

function ConnectionLinesInner({ hiddenIds }: ConnectionLinesProps) {
  // Granular selectors — only subscribe to what we need
  const ideas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });
  const connections = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.connections ?? [];
  });
  const removeConnection = useStore((s) => s.removeConnection);
  const viewport = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport ?? { x: 0, y: 0, zoom: 1 };
  });

  // Memoize ideasById map — only rebuilds when ideas array ref changes
  const ideasById = useMemo(
    () => new Map(ideas.map((i) => [i.id, i])),
    [ideas]
  );

  // Memoize all path data — only recalculates when connections or idea positions change
  const paths = useMemo((): PathData[] => {
    const result: PathData[] = [];
    for (const conn of connections) {
      const source = ideasById.get(conn.sourceId);
      const target = ideasById.get(conn.targetId);
      if (!source || !target) continue;

      const x1 = source.x + (source.width || 200) / 2;
      const y1 = source.y + 22;
      const x2 = target.x + (target.width || 200) / 2;
      const y2 = target.y + 22;
      const { cpx, cpy } = getCurveControlPoints(x1, y1, x2, y2);

      result.push({
        id: conn.id,
        d: `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`,
        x1, y1, x2, y2,
        sourceId: conn.sourceId,
        targetId: conn.targetId,
      });
    }
    return result;
  }, [connections, ideasById]);

  // Viewport culling
  const vpBounds = useMemo(
    () => getViewportBounds(viewport, window.innerWidth, window.innerHeight),
    [viewport]
  );

  if (paths.length === 0) return null;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 20000,
        height: 20000,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {paths.map((p) => {
        // Skip hidden connections
        if (hiddenIds?.has(p.sourceId) || hiddenIds?.has(p.targetId)) return null;

        // Viewport culling — skip if both endpoints are offscreen
        if (!lineIntersectsViewport(p.x1, p.y1, p.x2, p.y2, vpBounds)) return null;

        return (
          <g key={p.id}>
            <path
              d={p.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={() => removeConnection(p.id)}
            />
            <path
              d={p.d}
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth={viewport.zoom < 0.2 ? 1.5 : 1}
              opacity={viewport.zoom < 0.5 ? 0.6 : 0.45}
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

export const ConnectionLines = memo(ConnectionLinesInner);
