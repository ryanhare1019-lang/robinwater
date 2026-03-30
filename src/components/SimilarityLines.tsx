import { useRef, useEffect } from "react";
import { useStore } from "../store/useStore";

export function SimilarityLines() {
  const lines = useStore((s) => s.similarityLines);
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
        return (
          <line
            key={key}
            x1={line.fromX + 100}
            y1={line.fromY + 22}
            x2={line.toX + 100}
            y2={line.toY + 22}
            stroke="var(--line-color)"
            strokeWidth={1}
            opacity={0.07}
            style={
              isNew
                ? {
                    strokeDasharray: 1000,
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
