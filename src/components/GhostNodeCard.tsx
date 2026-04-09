import { useState, useCallback } from "react";
import { GhostNode } from "../types";
import { useStore } from "../store/useStore";

interface Props {
  ghost: GhostNode;
}

export function GhostNodeCard({ ghost }: Props) {
  const acceptGhostNode = useStore((s) => s.acceptGhostNode);
  const dismissGhostNode = useStore((s) => s.dismissGhostNode);

  const [isHovered, setIsHovered] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [acceptHovered, setAcceptHovered] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);

  const handleAccept = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      acceptGhostNode(ghost.id);
    },
    [ghost.id, acceptGhostNode]
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDismissing(true);
      setTimeout(() => {
        dismissGhostNode(ghost.id);
      }, 200);
    },
    [ghost.id, dismissGhostNode]
  );

  const isQuestion = ghost.type === 'question';
  const borderColor = isQuestion ? '#3A3520' : '#2A2A2A';
  const bottomLabel = isQuestion
    ? `? ${ghost.questionType?.toUpperCase() || 'QUESTION'}`
    : '✦ SUGGESTED';
  const labelColor = isQuestion ? '#CCAA44' : '#444444';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setAcceptHovered(false); setDismissHovered(false); }}
      style={{
        position: "absolute",
        left: ghost.x,
        top: ghost.y,
        minWidth: 180,
        width: 180,
        padding: "12px",
        background: "rgba(10, 10, 10, 0.5)",
        border: `1px dashed ${borderColor}`,
        borderRadius: 0,
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        color: "#888888",
        userSelect: "none",
        opacity: isDismissing ? 0 : 0.65,
        transform: isDismissing ? "scale(0)" : "scale(1)",
        transition: isDismissing
          ? "transform 0.2s ease-in, opacity 0.2s ease-in"
          : "opacity 0.15s ease",
        zIndex: isHovered ? 50 : 5,
        pointerEvents: "auto",
      }}
    >
      {/* Reasoning tooltip above — shown on hover */}
      {isHovered && ghost.reasoning && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 6,
            maxWidth: 240,
            background: "#111111",
            border: "1px solid #1A1A1A",
            padding: "6px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#666666",
            lineHeight: 1.4,
            wordBreak: "break-word",
            whiteSpace: "normal",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          {ghost.reasoning}
        </div>
      )}

      {/* Text */}
      <div
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          lineHeight: 1.4,
          wordBreak: "break-word",
          marginBottom: 8,
        }}
      >
        {ghost.text}
      </div>

      {/* Bottom row: label + buttons on hover */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <span
          style={{
            fontSize: "10px",
            color: labelColor,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {bottomLabel}
        </span>

        <div style={{ display: "flex", gap: 6 }}>
          {/* Accept button */}
          <button
            onMouseEnter={() => setAcceptHovered(true)}
            onMouseLeave={() => setAcceptHovered(false)}
            onClick={handleAccept}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: `1px solid ${acceptHovered ? "#44AA66" : "#2A2A2A"}`,
              color: acceptHovered ? "#44AA66" : "#444444",
              cursor: "pointer",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              padding: 0,
              transition: "border-color 0.15s, color 0.15s",
              flexShrink: 0,
            }}
            title="Accept"
          >
            ✓
          </button>

          {/* Dismiss button */}
          <button
            onMouseEnter={() => setDismissHovered(true)}
            onMouseLeave={() => setDismissHovered(false)}
            onClick={handleDismiss}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: `1px solid ${dismissHovered ? "#CC4444" : "#2A2A2A"}`,
              color: dismissHovered ? "#CC4444" : "#444444",
              cursor: "pointer",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              padding: 0,
              transition: "border-color 0.15s, color 0.15s",
              flexShrink: 0,
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
