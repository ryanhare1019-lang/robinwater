import { useState, useCallback, useRef } from "react";
import { GhostNode } from "../types";
import { useStore } from "../store/useStore";
import { getDetailLevelWithHysteresis, type DetailLevel } from "../utils/zoom";

interface Props {
  ghost: GhostNode;
}

interface GhostStyle {
  border: string;
  background: string;
  textColor: string;
  label: string;
  labelColor: string;
  acceptHoverColor: string;
  pulseAnimation: string;
  tooltipPrefix: string;
}

function getGhostStyle(type: GhostNode['type'], questionType?: string): GhostStyle {
  switch (type) {
    case 'synthesis':
      return {
        border: '1px dashed #2A2A3A',
        background: 'rgba(10,10,14,0.5)',
        textColor: '#8888AA',
        label: '◆ SYNTHESIS',
        labelColor: '#4466AA',
        acceptHoverColor: '#4466AA',
        pulseAnimation: 'ghost-pulse-slow 3s ease-in-out infinite',
        tooltipPrefix: 'BRIDGES',
      };
    case 'wildcard':
      return {
        border: '1px dashed #3A2A1A',
        background: 'rgba(14,10,8,0.5)',
        textColor: '#AAAA77',
        label: '✸ WILD CARD',
        labelColor: '#CC8844',
        acceptHoverColor: '#CC8844',
        pulseAnimation: 'ghost-pulse-fast 2s ease-in-out infinite',
        tooltipPrefix: 'INSPIRED BY',
      };
    case 'question':
      return {
        border: '1px dashed #3A3520',
        background: 'rgba(10,10,10,0.5)',
        textColor: '#888888',
        label: `? ${questionType?.toUpperCase() || 'QUESTION'}`,
        labelColor: '#CCAA44',
        acceptHoverColor: '#CCAA44',
        pulseAnimation: 'ghost-pulse-slow 3s ease-in-out infinite',
        tooltipPrefix: 'QUESTION',
      };
    case 'extension':
    default:
      return {
        border: '1px dashed #2A2A2A',
        background: 'rgba(10,10,10,0.5)',
        textColor: '#888888',
        label: '✦ SUGGESTED',
        labelColor: '#444444',
        acceptHoverColor: '#44AA66',
        pulseAnimation: 'ghost-pulse-slow 3s ease-in-out infinite',
        tooltipPrefix: 'EXTENDS',
      };
  }
}

function buildTooltip(ghost: GhostNode, prefix: string): string {
  switch (ghost.type) {
    case 'synthesis': {
      const themes = (ghost.bridgedClusterIds ?? [])
        .map((ids) => ids[0] ?? '')
        .filter(Boolean)
        .slice(0, 2)
        .join(' × ');
      return themes
        ? `${prefix}: ${themes} — ${ghost.reasoning}`
        : `${prefix}: ${ghost.reasoning}`;
    }
    case 'wildcard':
      return ghost.inspiration
        ? `${prefix}: ${ghost.inspiration} — ${ghost.reasoning}`
        : ghost.reasoning;
    default:
      return `${prefix}: ${ghost.reasoning}`;
  }
}

export function GhostNodeCard({ ghost }: Props) {
  const acceptGhostNode = useStore((s) => s.acceptGhostNode);
  const dismissGhostNode = useStore((s) => s.dismissGhostNode);

  const [isHovered, setIsHovered] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [acceptHovered, setAcceptHovered] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);

  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const detailLevelRef = useRef<DetailLevel>('full');
  const detailLevel = getDetailLevelWithHysteresis(zoom, detailLevelRef.current);
  detailLevelRef.current = detailLevel;

  const style = getGhostStyle(ghost.type, ghost.questionType);

  const handleAccept = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); acceptGhostNode(ghost.id); },
    [ghost.id, acceptGhostNode]
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDismissing(true);
      setTimeout(() => dismissGhostNode(ghost.id), 200);
    },
    [ghost.id, dismissGhostNode]
  );

  const ghostText =
    detailLevel === 'minimal'
      ? ghost.text.length > 25 ? ghost.text.slice(0, 25) + '…' : ghost.text
      : ghost.text;

  const tooltipText = buildTooltip(ghost, style.tooltipPrefix);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setAcceptHovered(false); setDismissHovered(false); }}
      style={{
        position: "absolute",
        left: ghost.x,
        top: ghost.y,
        minWidth: detailLevel === 'minimal' ? 80 : 140,
        width: detailLevel === 'minimal' ? undefined : 180,
        maxWidth: detailLevel === 'minimal' ? 180 : undefined,
        padding: detailLevel === 'full' ? "12px" : detailLevel === 'compact' ? "8px 10px" : "5px 8px",
        background: style.background,
        border: style.border,
        borderRadius: 0,
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        color: style.textColor,
        userSelect: "none",
        opacity: isDismissing ? 0 : undefined,
        transform: isDismissing ? "scale(0)" : "scale(1)",
        animation: isDismissing ? undefined : style.pulseAnimation,
        transition: isDismissing
          ? "transform 0.2s ease-in, opacity 0.2s ease-in"
          : "opacity 0.15s ease, padding 0.15s ease",
        zIndex: isHovered ? 50 : 5,
        pointerEvents: "auto",
        overflow: "hidden",
      }}
    >
      {/* Tooltip */}
      {isHovered && tooltipText && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 6,
            maxWidth: 280,
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
          {tooltipText}
        </div>
      )}

      {/* Text */}
      <div
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          lineHeight: 1.4,
          wordBreak: detailLevel === 'minimal' ? undefined : "break-word",
          whiteSpace: detailLevel === 'minimal' ? 'nowrap' : undefined,
          overflow: "hidden",
          textOverflow: detailLevel === 'minimal' ? 'ellipsis' : undefined,
          marginBottom: detailLevel === 'full' ? 8 : 0,
          display: detailLevel === 'compact' ? '-webkit-box' : undefined,
          WebkitLineClamp: detailLevel === 'compact' ? 2 : undefined,
          WebkitBoxOrient: detailLevel === 'compact' ? 'vertical' : undefined,
          transition: "margin-bottom 0.15s ease",
        }}
      >
        {ghostText}
      </div>

      {/* Bottom row — full level only */}
      <div
        style={{
          maxHeight: detailLevel === 'full' ? '40px' : '0px',
          opacity: detailLevel === 'full' ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.15s ease, opacity 0.12s ease',
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: "10px", color: style.labelColor, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {style.label}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onMouseEnter={() => setAcceptHovered(true)}
              onMouseLeave={() => setAcceptHovered(false)}
              onClick={handleAccept}
              style={{
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                border: `1px solid ${acceptHovered ? style.acceptHoverColor : "#2A2A2A"}`,
                color: acceptHovered ? style.acceptHoverColor : "#444444",
                cursor: "pointer", fontSize: "13px", fontFamily: "var(--font-mono)", padding: 0,
                transition: "border-color 0.15s, color 0.15s", flexShrink: 0,
              }}
              title="Accept"
            >✓</button>
            <button
              onMouseEnter={() => setDismissHovered(true)}
              onMouseLeave={() => setDismissHovered(false)}
              onClick={handleDismiss}
              style={{
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                border: `1px solid ${dismissHovered ? "#CC4444" : "#2A2A2A"}`,
                color: dismissHovered ? "#CC4444" : "#444444",
                cursor: "pointer", fontSize: "13px", fontFamily: "var(--font-mono)", padding: 0,
                transition: "border-color 0.15s, color 0.15s", flexShrink: 0,
              }}
              title="Dismiss"
            >✕</button>
          </div>
        </div>
      </div>
    </div>
  );
}
