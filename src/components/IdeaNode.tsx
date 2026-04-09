import { useRef, useEffect, useCallback, useState } from "react";
import { Idea } from "../types";
import { useStore, getActiveViewport } from "../store/useStore";
import { getDetailLevelWithHysteresis, type DetailLevel } from "../utils/zoom";

interface Props {
  idea: Idea;
}

const EMPTY_TAGS: import("../types").CustomTag[] = [];
const EMPTY_AI_TAG_DEFS: import("../types").AITagDefinition[] = [];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

export function IdeaNode({ idea }: Props) {
  const selectedId = useStore((s) => s.selectedId);
  const newNodeId = useStore((s) => s.newNodeId);
  const deletingNodeId = useStore((s) => s.deletingNodeId);
  const connectingFrom = useStore((s) => s.connectingFrom);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const updateIdea = useStore((s) => s.updateIdea);
  const clearNewNode = useStore((s) => s.clearNewNode);
  const setContextMenu = useStore((s) => s.setContextMenu);
  const addConnection = useStore((s) => s.addConnection);
  const setConnectingFrom = useStore((s) => s.setConnectingFrom);
  const setHoverPreview = useStore((s) => s.setHoverPreview);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasTags = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.tags || EMPTY_TAGS;
  });

  const canvasAiTagDefs = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.aiTagDefinitions || EMPTY_AI_TAG_DEFS;
  });
  const removeAiTagFromIdea = useStore((s) => s.removeAiTagFromIdea);
  const isFlashing = useStore((s) => s.tagJustTagged.includes(idea.id));

  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const detailLevelRef = useRef<DetailLevel>('full');
  const detailLevel = getDetailLevelWithHysteresis(zoom, detailLevelRef.current);
  detailLevelRef.current = detailLevel;

  const isSelected = selectedId === idea.id;
  const isNew = newNodeId === idea.id;
  const isDeleting = deletingNodeId === idea.id;
  const isConnecting = connectingFrom !== null;
  const [entering, setEntering] = useState(isNew);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragging = useRef(false);
  const didMove = useRef(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isNew) {
      setEntering(true);
      const timer = setTimeout(() => {
        setEntering(false);
        clearNewNode();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isNew, clearNewNode]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Handle right-click: start connect mode
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        setConnectingFrom(idea.id);
        return;
      }

      if (e.button !== 0) return;
      e.stopPropagation();

      if (connectingFrom && connectingFrom !== idea.id) {
        addConnection(connectingFrom, idea.id);
        return;
      }

      dragging.current = true;
      didMove.current = false;
      setIsDragging(true);
      setHoverPreview(null);
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
      const startX = e.clientX;
      const startY = e.clientY;
      const ideaX = idea.x;
      const ideaY = idea.y;
      const zoom = getActiveViewport().zoom;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didMove.current = true;
        updateIdea(idea.id, { x: ideaX + dx, y: ideaY + dy });
      };

      const onUp = () => {
        dragging.current = false;
        setIsDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [idea.id, idea.x, idea.y, updateIdea, connectingFrom, addConnection, setConnectingFrom, setHoverPreview]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 2) return;
      e.stopPropagation();
      e.preventDefault();
      if (connectingFrom && connectingFrom !== idea.id) {
        addConnection(connectingFrom, idea.id);
      }
    },
    [connectingFrom, idea.id, addConnection]
  );

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!didMove.current && !connectingFrom) {
        setSelectedId(idea.id);
      }
    },
    [idea.id, setSelectedId, connectingFrom]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Read from store directly to avoid stale closure (connectingFrom may have just been set)
      if (useStore.getState().connectingFrom !== null) return;
      setContextMenu(idea.id, { x: e.clientX, y: e.clientY });
    },
    [idea.id, setContextMenu]
  );

  // Resize handle
  const onResizeDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = idea.width || 200;
      const startH = idea.height || 80;
      const zoom = getActiveViewport().zoom;

      const onMove = (ev: MouseEvent) => {
        const dw = (ev.clientX - startX) / zoom;
        const dh = (ev.clientY - startY) / zoom;
        updateIdea(idea.id, {
          width: Math.max(160, Math.min(500, startW + dw)),
          height: Math.max(60, Math.min(400, startH + dh)),
        });
      };

      const onUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [idea.id, idea.width, idea.height, updateIdea]
  );

  const hasCustomSize = idea.width !== undefined || idea.height !== undefined;

  const contentText =
    detailLevel === 'minimal'
      ? (idea.text.length > 25 ? idea.text.slice(0, 25) + '…' : idea.text)
      : hasCustomSize
      ? idea.text
      : idea.text.length > 120
      ? idea.text.slice(0, 120) + '\u2026'
      : idea.text;

  const ideaTags = (idea.tags || [])
    .map((id) => canvasTags.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  const ideaAiTags = (idea.aiTags || [])
    .map((id) => canvasAiTagDefs.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  // Border logic — flash uses first AI tag color if available
  const flashColor = isFlashing && ideaAiTags.length > 0
    ? ideaAiTags[0].color
    : undefined;

  const borderColor = isFlashing && flashColor
    ? flashColor
    : entering
    ? "var(--border-strong)"
    : isSelected
    ? "var(--border-focus)"
    : isDeleting
    ? "transparent"
    : isHovered
    ? "var(--border-strong)"
    : "var(--border-default)";

  const hasDescription = Boolean(idea.description && idea.description.trim().length > 0);

  return (
    <div
      ref={nodeRef}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => {
          if (entering || isDragging || isDeleting) return;
          setIsHovered(true);
          // Schedule hover preview — only at compact/minimal zoom, not in connect mode
          if (detailLevelRef.current !== 'full' && !connectingFrom && nodeRef.current) {
            const capturedRef = nodeRef.current;
            hoverTimer.current = setTimeout(() => {
              const rect = capturedRef.getBoundingClientRect();
              setHoverPreview({
                nodeId: idea.id,
                rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
              });
            }, 300);
          }
        }}
      onMouseLeave={() => {
          setIsHovered(false);
          if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
          }
          setHoverPreview(null);
        }}
      style={{
        position: "absolute",
        left: idea.x,
        top: idea.y,
        width: idea.width || undefined,
        height: idea.height || undefined,
        minWidth: detailLevel === 'full' ? 200 : detailLevel === 'compact' ? 140 : 100,
        maxWidth: (idea.width !== undefined || idea.height !== undefined)
          ? undefined
          : detailLevel === 'full' ? 340 : detailLevel === 'compact' ? 280 : 200,
        background: "var(--bg-surface)",
        border: `1px solid ${borderColor}`,
        borderLeft: isSelected
          ? `3px solid var(--text-secondary)`
          : `1px solid ${borderColor}`,
        borderRadius: 0,
        color: "var(--text-primary)",
        fontSize: "var(--body-size)",
        lineHeight: 1.5,
        fontWeight: 400,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.01em",
        cursor: isConnecting ? "crosshair" : "default",
        userSelect: "none",
        overflow: "hidden",
        transform: isDeleting
          ? "scale(0)"
          : isDragging
          ? "scale(1.03)"
          : "scale(1)",
        opacity: isDeleting ? 0 : 1,
        transition: isDeleting
          ? "transform 0.25s ease-in, opacity 0.25s ease-in"
          : isDragging
          ? "transform 0.15s ease"
          : "border-color 0.2s ease, transform 0.15s var(--ease-out), opacity 0.15s ease, min-width 0.15s ease, max-width 0.15s ease",
        animation: entering
          ? "node-enter 0.45s var(--ease-spring) forwards, creation-glow 2.5s ease-out forwards"
          : undefined,
        willChange: "transform, opacity",
        zIndex: isDragging ? 100 : isSelected ? 10 : 1,
      }}
    >
      {/* Tag color bar — splits vertically per tag */}
      {ideaTags.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            display: "flex",
            flexDirection: "column",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {ideaTags.map((tag) => (
            <div
              key={tag.id}
              style={{
                flex: 1,
                background: tag.color,
              }}
            />
          ))}
        </div>
      )}

      {/* Label row — full level only */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          fontSize: "var(--label-size)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-tertiary)",
          fontWeight: 400,
          maxHeight: detailLevel === 'full' ? '40px' : '0px',
          opacity: detailLevel === 'full' ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.15s ease, opacity 0.12s ease",
        }}
      >
        <span>IDEA</span>
        {hasDescription && (
          <svg
            width="10"
            height="8"
            viewBox="0 0 10 8"
            style={{ opacity: 0.45, flexShrink: 0 }}
            aria-label="has description"
          >
            <rect x="0" y="0" width="10" height="1.5" fill="var(--text-secondary)" />
            <rect x="0" y="3.25" width="8" height="1.5" fill="var(--text-secondary)" />
            <rect x="0" y="6.5" width="6" height="1.5" fill="var(--text-secondary)" />
          </svg>
        )}
        <span>{formatDate(idea.createdAt)}</span>
      </div>

      {/* Separator — full level only */}
      <div
        style={{
          maxHeight: detailLevel === 'full' ? '1px' : '0px',
          opacity: detailLevel === 'full' ? 1 : 0,
          overflow: "hidden",
          background: "var(--border-subtle)",
          transition: "max-height 0.15s ease, opacity 0.12s ease",
        }}
      />

      {/* AI Tags — full level only */}
      {ideaAiTags.length > 0 && (
        <div
          style={{
            padding: "4px 14px 8px",
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            maxHeight: detailLevel === 'full' ? '120px' : '0px',
            opacity: detailLevel === 'full' ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.15s ease, opacity 0.12s ease",
          }}
        >
          {ideaAiTags.map((tagDef) => (
            <span
              key={tagDef.id}
              style={{
                fontSize: "9px",
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "2px 4px 2px 6px",
                border: `1px solid ${tagDef.color}40`,
                background: `${tagDef.color}1F`,
                color: `${tagDef.color}B3`,
                borderRadius: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {tagDef.label}
              {isHovered && (
                <span
                  onMouseDown={(e) => { e.stopPropagation(); removeAiTagFromIdea(tagDef.id, idea.id); }}
                  style={{ cursor: "pointer", opacity: 0.5, lineHeight: 1, fontSize: "10px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
                >
                  ×
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          padding: detailLevel === 'full'
            ? "8px 14px 12px"
            : detailLevel === 'compact'
            ? "8px 12px"
            : "6px 10px",
          whiteSpace: detailLevel === 'minimal' ? 'nowrap' : hasCustomSize ? 'normal' : undefined,
          display: detailLevel === 'minimal' ? 'block' : hasCustomSize ? undefined : '-webkit-box',
          WebkitLineClamp: detailLevel === 'compact' ? 2 : hasCustomSize ? undefined : 4,
          WebkitBoxOrient: detailLevel === 'minimal' || hasCustomSize ? undefined : 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: detailLevel === 'minimal' ? undefined : 'break-word',
          transition: "padding 0.15s ease",
        }}
      >
        {contentText}
      </div>

      {/* Plop ripple — square for grid aesthetic */}
      {entering && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 120,
            height: 120,
            border: "1px solid rgba(224, 224, 224, 0.08)",
            pointerEvents: "none",
            animation: "plop-ripple 0.6s var(--ease-out) forwards",
            willChange: "transform, opacity",
          }}
        />
      )}

      {/* Resize handle */}
      {(isSelected || isDragging) && !isDeleting && detailLevel === 'full' && (
        <div
          onMouseDown={onResizeDown}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 12,
            height: 12,
            cursor: "nwse-resize",
            opacity: 0.3,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="10" y1="2" x2="2" y2="10" stroke="var(--text-tertiary)" strokeWidth="1" />
            <line x1="10" y1="6" x2="6" y2="10" stroke="var(--text-tertiary)" strokeWidth="1" />
            <line x1="10" y1="10" x2="10" y2="10" stroke="var(--text-tertiary)" strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  );
}
