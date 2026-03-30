import { useRef, useEffect, useCallback, useState } from "react";
import { Idea, TAG_COLORS } from "../types";
import { useStore, getActiveViewport } from "../store/useStore";

interface Props {
  idea: Idea;
}

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
    [idea.id, idea.x, idea.y, updateIdea, connectingFrom, addConnection, setConnectingFrom]
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
      // Suppress context menu while in connect mode
      if (connectingFrom !== null) return;
      setContextMenu(idea.id, { x: e.clientX, y: e.clientY });
    },
    [idea.id, setContextMenu, connectingFrom]
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
  const nodeWidth = idea.width || undefined;
  const nodeHeight = idea.height || undefined;

  const showFullText = hasCustomSize;
  const displayText = showFullText
    ? idea.text
    : idea.text.length > 120
    ? idea.text.slice(0, 120) + "\u2026"
    : idea.text;

  const tagColors = idea.color ? TAG_COLORS[idea.color as keyof typeof TAG_COLORS] : null;

  // Tag border color for selected left border
  const tagBorderColor =
    idea.color && TAG_COLORS[idea.color as keyof typeof TAG_COLORS]
      ? TAG_COLORS[idea.color as keyof typeof TAG_COLORS].dot
      : "var(--text-secondary)";

  // Border logic
  const borderColor = entering
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
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => { if (!entering && !isDragging && !isDeleting) setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "absolute",
        left: idea.x,
        top: idea.y,
        width: nodeWidth,
        height: nodeHeight,
        minWidth: 200,
        maxWidth: hasCustomSize ? undefined : 340,
        background: "var(--bg-surface)",
        border: `1px solid ${borderColor}`,
        borderLeft: isSelected
          ? `3px solid ${tagBorderColor}`
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
          : "border-color 0.2s ease, transform 0.15s var(--ease-out), opacity 0.15s ease",
        animation: entering
          ? "node-enter 0.45s var(--ease-spring) forwards, creation-glow 2.5s ease-out forwards"
          : undefined,
        willChange: "transform, opacity",
        zIndex: isDragging ? 100 : isSelected ? 10 : 1,
      }}
    >
      {/* Label row: IDEA + description indicator + date */}
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
        }}
      >
        <span>IDEA</span>
        {hasDescription && (
          <span
            style={{
              color: "var(--text-secondary)",
              fontSize: "10px",
              opacity: 0.5,
              lineHeight: 1,
            }}
          >
            ·
          </span>
        )}
        <span>{formatDate(idea.createdAt)}</span>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: "var(--border-subtle)" }} />

      {/* Content */}
      <div
        style={{
          padding: "8px 14px 12px",
          whiteSpace: hasCustomSize ? "normal" : undefined,
          display: hasCustomSize ? undefined : "-webkit-box",
          WebkitLineClamp: hasCustomSize ? undefined : 4,
          WebkitBoxOrient: hasCustomSize ? undefined : "vertical",
          overflow: "hidden",
          textOverflow: hasCustomSize ? undefined : "ellipsis",
          wordBreak: "break-word",
        }}
      >
        {displayText}
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
      {(isSelected || isDragging) && !isDeleting && (
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
