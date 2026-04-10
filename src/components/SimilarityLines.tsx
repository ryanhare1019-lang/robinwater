import { useMemo } from "react";
import { useStore } from "../store/useStore";

interface SimilarityLinesProps {
  hiddenIds?: Set<string>;
}

export function SimilarityLines({ hiddenIds }: SimilarityLinesProps) {
  const lines = useStore((s) => s.similarityLines);
  const ideas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });
  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });

  const ideasById = useMemo(
    () => new Map(ideas.map((i) => [i.id, i])),
    [ideas]
  );

  // Build batched path strings — one for keyword lines, one for tag lines
  const { keywordPath, tagPath } = useMemo(() => {
    let keyword = "";
    let tag = "";
    for (const line of lines) {
      if (hiddenIds?.has(line.fromId) || hiddenIds?.has(line.toId)) continue;
      const from = ideasById.get(line.fromId);
      const to = ideasById.get(line.toId);
      if (!from || !to) continue;
      const seg = `M${from.x + 100},${from.y + 22}L${to.x + 100},${to.y + 22}`;
      if (line.reason === "tag") tag += seg;
      else keyword += seg;
    }
    return { keywordPath: keyword, tagPath: tag };
  }, [lines, ideasById, hiddenIds]);

  if (lines.length === 0 || zoom < 0.3) return null;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {keywordPath && (
        <path
          d={keywordPath}
          fill="none"
          stroke="var(--line-color)"
          strokeWidth={1}
          opacity={0.07}
        />
      )}
      {tagPath && (
        <path
          d={tagPath}
          fill="none"
          stroke="var(--line-color)"
          strokeWidth={1}
          opacity={0.12}
          strokeDasharray="4 6"
        />
      )}
    </svg>
  );
}
