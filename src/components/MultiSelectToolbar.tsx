import { useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";

export function MultiSelectToolbar() {
  const selectedIds = useStore((s) => s.selectedIds);
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const updateIdea = useStore((s) => s.updateIdea);
  const deleteIdeas = useStore((s) => s.deleteIdeas);

  const canvas = canvases.find((c) => c.id === activeCanvasId) || canvases[0];
  const tags = canvas?.tags || [];

  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // close dropdown on outside click
  useEffect(() => {
    if (!tagDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        !tagBtnRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setTagDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [tagDropdownOpen]);

  // reset confirm state when selection changes
  useEffect(() => {
    setDeleteConfirm(false);
    setTagDropdownOpen(false);
  }, [selectedIds.length]);

  if (selectedIds.length <= 1) return null;

  const count = selectedIds.length;

  const handleApplyTag = (tagId: string) => {
    const selectedIds = useStore.getState().selectedIds;
    for (const id of selectedIds) {
      // Read fresh state inside loop to avoid stale closure
      const freshCanvas = useStore.getState().canvases.find(
        c => c.id === useStore.getState().activeCanvasId
      );
      const idea = freshCanvas?.ideas.find(i => i.id === id);
      if (!idea) continue;
      const existingTags = idea.tags || [];
      if (existingTags.includes(tagId)) continue;
      useStore.getState().updateIdea(id, { tags: [...existingTags, tagId] });
    }
    setTagDropdownOpen(false);
  };

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    deleteIdeas(selectedIds);
    setDeleteConfirm(false);
  };

  const btnBase: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    cursor: "pointer",
    padding: "6px 12px",
    transition: "color 0.1s ease, background 0.1s ease",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        background: "var(--bg-raised)",
        border: "1px solid var(--border-default)",
        borderRadius: 0,
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        userSelect: "none",
      }}
    >
      {/* count label */}
      <span
        style={{
          padding: "6px 14px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          borderRight: "1px solid var(--border-subtle)",
          whiteSpace: "nowrap",
        }}
      >
        {count} IDEAS SELECTED
      </span>

      {/* TAG button with dropdown */}
      <div data-tag-dropdown style={{ position: "relative" }}>
        <button
          ref={tagBtnRef}
          style={{
            ...btnBase,
            borderRight: "1px solid var(--border-subtle)",
            color: tagDropdownOpen ? "var(--text-primary)" : "var(--text-secondary)",
          }}
          onClick={() => setTagDropdownOpen((v) => !v)}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-active)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = tagDropdownOpen ? "var(--text-primary)" : "var(--text-secondary)"; e.currentTarget.style.background = "none"; }}
        >
          ◈ TAG ▾
        </button>

        {tagDropdownOpen && (
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              bottom: "calc(100% + 4px)",
              left: 0,
              background: "var(--bg-raised)",
              border: "1px solid var(--border-default)",
              borderRadius: 0,
              minWidth: 160,
              zIndex: 1600,
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}
          >
            {tags.length === 0 ? (
              <div
                style={{
                  padding: "8px 14px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                }}
              >
                NO TAGS
              </div>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleApplyTag(tag.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 14px",
                    background: "none",
                    border: "none",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: tag.color,
                      flexShrink: 0,
                    }}
                  />
                  {tag.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* DELETE button */}
      <button
        style={{
          ...btnBase,
          color: deleteConfirm ? "var(--accent-red, #e05252)" : "var(--text-secondary)",
        }}
        onClick={handleDelete}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--accent-red, #e05252)";
          e.currentTarget.style.background = "var(--bg-active)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = deleteConfirm ? "var(--accent-red, #e05252)" : "var(--text-secondary)";
          e.currentTarget.style.background = "none";
        }}
      >
        {deleteConfirm ? "DELETE? CONFIRM" : "× DELETE"}
      </button>
    </div>
  );
}
