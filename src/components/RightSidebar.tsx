import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "../store/useStore";

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
  const addTag = useStore((s) => s.addTag);
  const removeTag = useStore((s) => s.removeTag);

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  const idea = canvas?.ideas.find((i) => i.id === selectedId);
  const tags = canvas?.tags || [];

  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6b9bff");
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>();

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  useEffect(() => {
    if (idea) {
      setTitleValue(idea.text);
      setDescValue(idea.description);
      setDeleteConfirm(false);
      setClosing(false);
    }
  }, [idea?.id]);

  useEffect(() => {
    autoGrow(titleRef.current);
    autoGrow(descRef.current);
  }, [idea?.id, titleValue, descValue]);

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
      });
    }
  }, [selectedId, titleValue, descValue, updateIdea]);

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

      {/* Title section */}
      <div style={sectionStyle}>
        <div style={labelStyle}>TITLE</div>
        <textarea
          ref={titleRef}
          value={titleValue}
          onChange={(e) => {
            const val = e.target.value;
            setTitleValue(val);
            autoGrow(titleRef.current);
            if (selectedId && val.trim()) {
              updateIdea(selectedId, { text: val.trim(), description: descValue });
            }
          }}
          rows={1}
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
            boxSizing: "border-box",
            resize: "none",
            overflow: "hidden",
            lineHeight: 1.5,
            display: "block",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border-default)";
            handleSave();
          }}
        />
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
        <textarea
          ref={descRef}
          value={descValue}
          onChange={(e) => {
            const val = e.target.value;
            setDescValue(val);
            autoGrow(descRef.current);
            if (selectedId) {
              updateIdea(selectedId, { text: titleValue.trim() || idea.text, description: val });
            }
          }}
          placeholder="add a description..."
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 0,
            color: "var(--text-primary)",
            fontSize: "var(--body-size)",
            fontFamily: "var(--font-mono)",
            padding: "8px 10px",
            resize: "none",
            overflow: "hidden",
            lineHeight: 1.6,
            transition: "border-color 0.15s ease",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border-default)";
            handleSave();
          }}
        />
      </div>

      {/* Tags section */}
      <div style={sectionStyle}>
        <div style={labelStyle}>TAGS</div>
        {tags.length === 0 && !addingTag && (
          <div style={{ ...valueStyle, color: "var(--text-tertiary)", marginBottom: 8 }}>No tags</div>
        )}
        {tags.map((tag) => {
          const isActive = idea.color === tag.id;
          return (
            <div
              key={tag.id}
              onClick={() => {
                if (selectedId) {
                  updateIdea(selectedId, { color: isActive ? undefined : (tag.id as any) });
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                marginBottom: 4,
                cursor: "pointer",
                borderRadius: 0,
                background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
                borderLeft: isActive ? `2px solid ${tag.color}` : "2px solid transparent",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: tag.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ ...valueStyle, flex: 1, fontSize: "var(--label-size)" }}>
                {tag.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag.id);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  padding: "0 2px",
                  fontSize: 12,
                  lineHeight: 1,
                  fontFamily: "var(--font-mono)",
                  transition: "color 0.12s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
              >
                ×
              </button>
            </div>
          );
        })}

        {addingTag ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                border: "1px solid var(--border-default)",
                borderRadius: 0,
                cursor: "pointer",
                background: "transparent",
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="tag name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTagName.trim()) {
                  addTag(newTagName.trim(), newTagColor);
                  setNewTagName("");
                  setNewTagColor("#6b9bff");
                  setAddingTag(false);
                } else if (e.key === "Escape") {
                  setAddingTag(false);
                  setNewTagName("");
                  setNewTagColor("#6b9bff");
                }
              }}
              style={{
                flex: 1,
                fontSize: "var(--label-size)",
                fontFamily: "var(--font-mono)",
                background: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: 0,
                color: "var(--text-primary)",
                padding: "4px 6px",
                minWidth: 0,
              }}
            />
            <button
              onClick={() => {
                if (newTagName.trim()) {
                  addTag(newTagName.trim(), newTagColor);
                  setNewTagName("");
                  setNewTagColor("#6b9bff");
                  setAddingTag(false);
                }
              }}
              style={{
                background: "transparent",
                border: "1px solid var(--accent-blue)",
                borderRadius: 0,
                color: "var(--accent-blue)",
                fontSize: "var(--label-size)",
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
                padding: "4px 8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                flexShrink: 0,
              }}
            >
              ADD
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingTag(true)}
            style={{
              marginTop: tags.length > 0 ? 6 : 0,
              background: "transparent",
              border: "1px dashed var(--border-subtle)",
              borderRadius: 0,
              color: "var(--text-tertiary)",
              fontSize: "var(--label-size)",
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              padding: "4px 10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              transition: "border-color 0.12s ease, color 0.12s ease",
              display: "block",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            + NEW TAG
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ marginTop: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
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
    </div>
  );
}
