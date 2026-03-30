import { useState } from "react";
import { useStore } from "../store/useStore";

function getCurveControlPoints(
  x1: number, y1: number, x2: number, y2: number
): { cpx1: number; cpy1: number; cpx2: number; cpy2: number } {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.min(60, dist * 0.2);

  const nx = -dy / dist;
  const ny = dx / dist;

  return {
    cpx1: mx + nx * offset,
    cpy1: my + ny * offset,
    cpx2: mx + nx * offset,
    cpy2: my + ny * offset,
  };
}

export function ConnectionLines() {
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const removeConnection = useStore((s) => s.removeConnection);

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  const ideas = canvas?.ideas || [];
  const connections = canvas?.connections || [];

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const ideasById = new Map(ideas.map((i) => [i.id, i]));

  if (connections.length === 0) return null;

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
      {connections.map((conn) => {
        const source = ideasById.get(conn.sourceId);
        const target = ideasById.get(conn.targetId);
        if (!source || !target) return null;

        const x1 = source.x + (source.width || 200) / 2;
        const y1 = source.y + 22;
        const x2 = target.x + (target.width || 200) / 2;
        const y2 = target.y + 22;

        const { cpx1, cpy1 } = getCurveControlPoints(x1, y1, x2, y2);
        const d = `M ${x1} ${y1} Q ${cpx1} ${cpy1} ${x2} ${y2}`;
        const isHovered = hoveredId === conn.id;
        const mx = (x1 + x2) / 2 + (cpx1 - (x1 + x2) / 2) * 0.5;
        const my = (y1 + y2) / 2 + (cpy1 - (y1 + y2) / 2) * 0.5;

        return (
          <g key={conn.id}>
            {/* Invisible wider hit area */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onMouseEnter={() => setHoveredId(conn.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
            {/* Visible line */}
            <path
              d={d}
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth={1}
              opacity={isHovered ? 0.85 : 0.45}
              style={{ transition: "opacity 0.15s ease", pointerEvents: "none" }}
            />
            {/* Delete button on hover */}
            {isHovered && (
              <g
                onClick={() => removeConnection(conn.id)}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onMouseEnter={() => setHoveredId(conn.id)}
              >
                <rect
                  x={mx - 8}
                  y={my - 8}
                  width={16}
                  height={16}
                  fill="var(--bg-raised)"
                  stroke="var(--accent-red)"
                  strokeWidth={1}
                  opacity={0.9}
                />
                <text
                  x={mx}
                  y={my + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--accent-red)"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                >
                  x
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
