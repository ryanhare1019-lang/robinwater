import { useRef, useEffect } from "react";
import { useStore } from "../store/useStore";

export function SimilarityLines() {
  const lines = useStore((s) => s.similarityLines);
  const ideas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });
  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const prevKeysRef = useRef<Set<string>>(new Set());

  const currentKeys = new Set(lines.map((l) => `${l.fromId}-${l.toId}`));
  const newKeys = new Set<string>();
  currentKeys.forEach((k) => {
    if (!prevKeysRef.current.has(k)) newKeys.add(k);
  });

  useEffect(() => {
    prevKeysRef.current = currentKeys;
  });

  if (lines.length === 0) return null;

  // Similarity lines are too subtle to be useful at very low zoom
  if (zoom < 0.3) return null;

  const ideasById = new Map(ideas.map((i) => [i.id, i]));

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
      {lines.map((line) => {
        const key = `${line.fromId}-${line.toId}`;
        const isNew = newKeys.has(key);
        const from = ideasById.get(line.fromId);
        const to = ideasById.get(line.toId);
        if (!from || !to) return null;
        const isTagLine = line.reason === 'tag';
        return (
          <line
            key={key}
            x1={from.x + 100}
            y1={from.y + 22}
            x2={to.x + 100}
            y2={to.y + 22}
            stroke="var(--line-color)"
            strokeWidth={1}
            opacity={isTagLine ? 0.12 : 0.07}
            strokeDasharray={isTagLine ? "4 6" : undefined}
            style={
              isNew
                ? {
                    strokeDasharray: isTagLine ? "4 6" : "1000",
                    strokeDashoffset: 1000,
                    animation: "line-draw 0.4s var(--ease-out) forwards",
                  }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}
