import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "../store/useStore";
import { TAG_COLORS, TagColor } from "../types";

const TAG_COLOR_KEYS = Object.keys(TAG_COLORS) as TagColor[];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${mm}.${dd}.${yy} ${hh}:${min}:${ss}`;
}

const labelStyle: React.CSSProperties = {
  fontSize: "var(--label-size)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--text-tertiary)",
  fontWeight: 400,
  marginBottom: 6,
};

const sectionStyle: React.CSSProperties = {
  padding: "12px 20px",
  borderBottom: "1px solid var(--border-subtle)",
};

const valueStyle: React.CSSProperties = {
  fontSize: "var(--body-size)",
  color: "var(--text-primary)",
  fontWeight: 400,
  lineHeight: 1.6,
  fontFamily: "var(--font-mono)",
};

export function RightSidebar() {
  const selectedId = useStore((s) => s.selectedId);
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const updateIdea = useStore((s) => s.updateIdea);
  const deleteIdea = useStore((s) => s.deleteIdea);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const setDeletingNodeId = useStore((s) => s.setDeletingNodeId);

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  const idea = canvas?.ideas.find((i) => i.id === selectedId);

  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [colorValue, setColorValue] = useState<TagColor | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (idea) {
      setTitleValue(idea.text);
      setDescValue(idea.description);
      setColorValue(idea.color);
      setEditing(false);
      setDeleteConfirm(false);
      setClosing(false);
    }
  }, [idea?.id]);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleSave = useCallback(() => {
    if (selectedId && titleValue.trim()) {
      updateIdea(selectedId, {
        text: titleValue.trim(),
        description: descValue,
        color: colorValue,
      });
    }
    setEditing(false);
  }, [selectedId, titleValue, descValue, colorValue, updateIdea]);

  const handleDeleteConfirm = useCallback(() => {
    if (selectedId) {
      setDeletingNodeId(selectedId);
      setClosing(true);
      setTimeout(() => {
        deleteIdea(selectedId);
        setSelectedId(null);
      }, 250);
    }
  }, [selectedId, deleteIdea, setSelectedId, setDeletingNodeId]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  const handleDeleteStart = useCallback(() => {
    setDeleteConfirm(true);
    confirmTimer.current = setTimeout(() => setDeleteConfirm(false), 4000);
  }, []);

  if (!idea) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-default)",
        zIndex: 900,
        display: "flex",
        flexDirection: "column",
        animation: closing
          ? "slide-out-right 0.2s var(--ease-out) forwards"
          : "slide-in-right 0.25s var(--ease-out) forwards",
        willChange: "transform",
        overflowY: "auto",
        fontFamily: "var(--font-mono)",
        borderRadius: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: "var(--heading-size)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-primary)",
          fontWeight: 400,
        }}
      >
        NODE DETAILS
      </div>

      {!editing ? (
        <>
          {/* Title section */}
          <div style={sectionStyle}>
            <div style={labelStyle}>TITLE</div>
            <div style={{ ...valueStyle, fontWeight: 500 }}>{idea.text}</div>
          </div>

          {/* Created section */}
          <div style={sectionStyle}>
            <div style={labelStyle}>CREATED</div>
            <div style={{ ...valueStyle, color: "var(--text-secondary)" }}>
              {formatTimestamp(idea.createdAt)}
            </div>
          </div>

          {/* Description section */}
          <div style={sectionStyle}>
            <div style={labelStyle}>DESCRIPTION</div>
            <div style={{ ...valueStyle, color: idea.description ? "var(--text-primary)" : "var(--text-tertiary)" }}>
              {idea.description || "No description"}
            </div>
          </div>

          {/* Tag section */}
          <div style={sectionStyle}>
            <div style={labelStyle}>TAG</div>
            {idea.color ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: TAG_COLORS[idea.color].dot,
                  }}
                />
                <span style={{ ...valueStyle, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "var(--label-size)" }}>
                  {idea.color}
                </span>
              </div>
            ) : (
              <div style={{ ...valueStyle, color: "var(--text-tertiary)" }}>None</div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => setEditing(true)}
              style={{
                width: "100%",
                padding: 10,
                background: "transparent",
                border: "1px solid var(--accent-blue)",
                borderRadius: 0,
                color: "var(--accent-blue)",
                fontSize: "var(--body-size)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(68, 136, 255, 0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              EDIT
            </button>

            {!deleteConfirm ? (
              <button
                onClick={handleDeleteStart}
                style={{
                  width: "100%",
                  padding: 10,
                  background: "transparent",
                  border: "1px solid var(--accent-red)",
                  borderRadius: 0,
                  color: "var(--accent-red)",
                  fontSize: "var(--body-size)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  justifyContent: "center",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 68, 68, 0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                DELETE
              </button>
            ) : (
              <div
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--accent-red)",
                  borderRadius: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  fontSize: "var(--body-size)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--accent-red)",
                }}
              >
                <span>CONFIRM?</span>
                <button
                  onClick={handleDeleteConfirm}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--accent-red)",
                    borderRadius: 0,
                    color: "var(--accent-red)",
                    fontSize: "var(--body-size)",
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                    padding: "2px 8px",
                    letterSpacing: "0.05em",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 68, 68, 0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Y
                </button>
                <button
                  onClick={handleDeleteCancel}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--text-tertiary)",
                    borderRadius: 0,
                    color: "var(--text-tertiary)",
                    fontSize: "var(--body-size)",
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                    padding: "2px 8px",
                    letterSpacing: "0.05em",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(85, 85, 85, 0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  N
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Edit mode */
        <>
          <div style={sectionStyle}>
            <div style={labelStyle}>TITLE</div>
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              style={{
                width: "100%",
                fontSize: "var(--body-size)",
                fontWeight: 400,
                fontFamily: "var(--font-mono)",
                background: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: 0,
                color: "var(--text-primary)",
                padding: "8px 10px",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
            />
          </div>

          <div style={sectionStyle}>
            <div style={labelStyle}>DESCRIPTION</div>
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              placeholder="add a description..."
              style={{
                width: "100%",
                minHeight: 100,
                background: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: 0,
                color: "var(--text-primary)",
                fontSize: "var(--body-size)",
                fontFamily: "var(--font-mono)",
                padding: "8px 10px",
                resize: "vertical",
                lineHeight: 1.6,
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
            />
          </div>

          <div style={sectionStyle}>
            <div style={labelStyle}>COLOR TAG</div>
            <div style={{ display: "flex", gap: 8 }}>
              {TAG_COLOR_KEYS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColorValue(colorValue === c ? undefined : c)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 0,
                    background: colorValue === c ? TAG_COLORS[c].dot : "transparent",
                    border: `1px solid ${colorValue === c ? TAG_COLORS[c].dot : "var(--border-default)"}`,
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, background 0.15s ease",
                    padding: 0,
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (colorValue !== c) e.currentTarget.style.borderColor = TAG_COLORS[c].dot;
                  }}
                  onMouseLeave={(e) => {
                    if (colorValue !== c) e.currentTarget.style.borderColor = "var(--border-default)";
                  }}
                >
                  {/* Inner dot */}
                  {colorValue !== c && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: TAG_COLORS[c].dot,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={handleSave}
              style={{
                width: "100%",
                padding: 10,
                background: "transparent",
                border: "1px solid var(--accent-blue)",
                borderRadius: 0,
                color: "var(--accent-blue)",
                fontSize: "var(--body-size)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(68, 136, 255, 0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              SAVE
            </button>
            <button
              onClick={() => {
                setEditing(false);
                if (idea) {
                  setTitleValue(idea.text);
                  setDescValue(idea.description);
                  setColorValue(idea.color);
                }
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-tertiary)",
                fontSize: "var(--body-size)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                padding: 8,
                textAlign: "center",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
            >
              CANCEL
            </button>
          </div>
        </>
      )}
    </div>
  );
}
