// src/components/NodeHoverPreview.tsx
import { useStore } from "../store/useStore";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

const EMPTY_AI_DEFS: import("../types").AITagDefinition[] = [];

export function NodeHoverPreview() {
  const hoverPreview = useStore((s) => s.hoverPreview);
  const idea = useStore((s) => {
    if (!s.hoverPreview) return null;
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas.find((i) => i.id === s.hoverPreview!.nodeId) ?? null;
  });
  const allIdeas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });
  const connections = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.connections ?? [];
  });
  const aiTagDefs = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.aiTagDefinitions ?? EMPTY_AI_DEFS;
  });

  if (!hoverPreview || !idea) return null;

  const { rect } = hoverPreview;
  const PREVIEW_WIDTH = 320;
  const MARGIN = 12;

  // Prefer right side; flip to left if it would overflow screen
  const rightSide = rect.right + MARGIN + PREVIEW_WIDTH <= window.innerWidth - 16;
  const left = rightSide
    ? rect.right + MARGIN
    : rect.left - PREVIEW_WIDTH - MARGIN;

  // Vertically center with the node, clamped to viewport
  const nodeCenter = (rect.top + rect.bottom) / 2;
  const top = Math.max(16, Math.min(window.innerHeight - 200, nodeCenter - 80));

  // Resolve connected ideas
  const connectedIds = connections
    .filter((c) => c.sourceId === idea.id || c.targetId === idea.id)
    .map((c) => (c.sourceId === idea.id ? c.targetId : c.sourceId));
  const connectedIdeas = allIdeas.filter((i) => connectedIds.includes(i.id));

  // Resolve AI tags
  const ideaAiTags = (idea.aiTags || [])
    .map((id) => aiTagDefs.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  const dividerStyle = {
    height: 1,
    background: "var(--border-subtle)",
    margin: "12px 0",
  };

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: PREVIEW_WIDTH,
        maxHeight: "80vh",
        overflowY: "auto",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        zIndex: 3000,
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        color: "var(--text-primary)",
        pointerEvents: "none",
        padding: "14px 16px",
        animation: `${rightSide ? 'preview-enter' : 'preview-enter-left'} 0.15s ease forwards`,
      }}
    >
      {/* Header: IDEA label + date */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "10px",
        }}
      >
        <span>IDEA</span>
        <span>{formatDate(idea.createdAt)}</span>
      </div>

      <div style={dividerStyle} />

      {/* Full idea text */}
      <div
        style={{
          fontSize: "12px",
          lineHeight: 1.55,
          color: "var(--text-primary)",
          wordBreak: "break-word",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          marginBottom: "12px",
        }}
      >
        {idea.text}
      </div>

      <div style={dividerStyle} />

      {/* Description */}
      <div style={{ marginBottom: "12px" }}>
        <div
          style={{
            fontSize: "9px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text-tertiary)",
            marginBottom: 6,
          }}
        >
          DESCRIPTION
        </div>
        <div
          style={{
            fontSize: "12px",
            lineHeight: 1.55,
            color: idea.description?.trim() ? "var(--text-secondary)" : "var(--text-muted)",
            wordBreak: "break-word",
          }}
        >
          {idea.description?.trim() || "NO DESCRIPTION"}
        </div>
      </div>

      {/* AI Tags (if any) */}
      {ideaAiTags.length > 0 && (
        <>
          <div style={dividerStyle} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: "12px" }}>
            {ideaAiTags.map((tagDef) => (
              <span
                key={tagDef.id}
                style={{
                  fontSize: "9px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 6px",
                  border: `1px solid ${tagDef.color}40`,
                  background: `${tagDef.color}1F`,
                  color: `${tagDef.color}B3`,
                }}
              >
                {tagDef.label}
              </span>
            ))}
          </div>
        </>
      )}

      <div style={dividerStyle} />

      {/* Connections */}
      <div>
        <div
          style={{
            fontSize: "9px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text-tertiary)",
            marginBottom: 6,
          }}
        >
          CONNECTIONS
        </div>
        {connectedIdeas.length > 0 ? (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              wordBreak: "break-word",
            }}
          >
            {connectedIdeas.map((ci, idx) => (
              <span key={ci.id}>
                {idx > 0 && <span style={{ color: "var(--text-muted)" }}>,&nbsp;</span>}
                {ci.text.length > 40 ? ci.text.slice(0, 40) + '…' : ci.text}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>NO CONNECTIONS</div>
        )}
      </div>
    </div>
  );
}
