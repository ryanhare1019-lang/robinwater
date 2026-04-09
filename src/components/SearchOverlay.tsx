import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";

const EMPTY_TAGS: import("../types").CustomTag[] = [];

export function SearchOverlay() {
  const searchOpen = useStore((s) => s.searchOpen);
  const searchQuery = useStore((s) => s.searchQuery);
  const searchTagFilter = useStore((s) => s.searchTagFilter);
  const searchConnectionFilter = useStore((s) => s.searchConnectionFilter);
  const searchDateFilter = useStore((s) => s.searchDateFilter);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const setSearchTagFilter = useStore((s) => s.setSearchTagFilter);
  const setSearchConnectionFilter = useStore((s) => s.setSearchConnectionFilter);
  const setSearchDateFilter = useStore((s) => s.setSearchDateFilter);
  const resetSearch = useStore((s) => s.resetSearch);

  const canvasTags = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.tags || EMPTY_TAGS;
  });

  // Compute match count
  const matchCount = useStore((s) => {
    if (!s.searchOpen) return 0;
    const q = s.searchQuery.toLowerCase();
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    if (!canvas) return 0;
    const connections = canvas.connections;

    return canvas.ideas.filter((idea) => {
      if (q.length > 0) {
        const textMatch =
          idea.text.toLowerCase().includes(q) ||
          idea.description?.toLowerCase().includes(q);
        if (!textMatch) return false;
      }
      if (s.searchTagFilter) {
        const hasTag =
          (idea.tags || []).includes(s.searchTagFilter) ||
          (idea.aiTags || []).includes(s.searchTagFilter);
        if (!hasTag) return false;
      }
      if (s.searchConnectionFilter !== "any") {
        const isConnected = connections.some(
          (c) => c.sourceId === idea.id || c.targetId === idea.id
        );
        if (s.searchConnectionFilter === "connected" && !isConnected) return false;
        if (s.searchConnectionFilter === "unconnected" && isConnected) return false;
      }
      if (s.searchDateFilter !== "any") {
        const created = new Date(idea.createdAt);
        const now = new Date();
        const dayMs = 86400000;
        if (s.searchDateFilter === "today") {
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (created < startOfDay) return false;
        } else if (s.searchDateFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * dayMs);
          if (created < weekAgo) return false;
        }
      }
      return true;
    }).length;
  });

  const isFilterActive = useStore(
    (s) =>
      s.searchQuery.length > 0 ||
      s.searchTagFilter !== null ||
      s.searchConnectionFilter !== "any" ||
      s.searchDateFilter !== "any"
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [connDropdownOpen, setConnDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  // Focus input when opening
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Ctrl+F to open, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        const open = useStore.getState().searchOpen;
        if (open) {
          useStore.getState().setSearchOpen(false);
          useStore.getState().resetSearch();
        } else {
          useStore.getState().setSearchOpen(true);
        }
      }
      if (e.key === "Escape" && useStore.getState().searchOpen) {
        e.stopPropagation();
        useStore.getState().setSearchOpen(false);
        useStore.getState().resetSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  if (!searchOpen) return null;

  const closeAll = () => {
    setTagDropdownOpen(false);
    setConnDropdownOpen(false);
    setDateDropdownOpen(false);
  };

  const handleClose = () => {
    setSearchOpen(false);
    resetSearch();
  };

  const selectedTagName =
    searchTagFilter && canvasTags.find((t) => t.id === searchTagFilter)?.name;

  const connLabel =
    searchConnectionFilter === "any"
      ? "CONNECTION"
      : searchConnectionFilter === "connected"
      ? "CONNECTED"
      : "UNCONNECTED";

  const dateLabel =
    searchDateFilter === "any"
      ? "DATE"
      : searchDateFilter === "today"
      ? "TODAY"
      : "THIS WEEK";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2000,
        background: "var(--bg-base)",
        border: "1px solid var(--border-default)",
        borderTop: "none",
        borderRadius: 0,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--body-size)",
        minWidth: 540,
        maxWidth: "90vw",
        userSelect: "none",
      }}
      onClick={closeAll}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Search input row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          gap: 8,
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <span
          style={{
            color: "var(--text-tertiary)",
            fontSize: "var(--label-size)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
          }}
        >
          &gt; SEARCH:
        </span>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              handleClose();
            }
          }}
          placeholder="type to search ideas..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--body-size)",
            caretColor: "var(--text-secondary)",
          }}
        />
        <button
          onClick={handleClose}
          style={{
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 0,
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--label-size)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "3px 8px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "border-color 0.15s ease, color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-default)";
            e.currentTarget.style.color = "var(--text-tertiary)";
          }}
        >
          ✕ CLOSE
        </button>
      </div>

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 12px",
          gap: 8,
          borderBottom: isFilterActive ? "1px solid var(--border-default)" : undefined,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            color: "var(--text-tertiary)",
            fontSize: "var(--label-size)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          FILTER:
        </span>

        {/* Tag filter */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTagDropdownOpen(!tagDropdownOpen);
              setConnDropdownOpen(false);
              setDateDropdownOpen(false);
            }}
            style={{
              background: searchTagFilter ? "var(--bg-surface)" : "transparent",
              border: `1px solid ${searchTagFilter ? "var(--border-strong)" : "var(--border-default)"}`,
              borderRadius: 0,
              color: searchTagFilter ? "var(--text-primary)" : "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--label-size)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "3px 8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {selectedTagName ? `TAG: ${selectedTagName.toUpperCase()}` : "TAG ▾"}
          </button>
          {tagDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 2px)",
                left: 0,
                background: "var(--bg-base)",
                border: "1px solid var(--border-default)",
                borderRadius: 0,
                zIndex: 2100,
                minWidth: 160,
                maxHeight: 200,
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownItem
                label="ANY TAG"
                active={searchTagFilter === null}
                onClick={() => { setSearchTagFilter(null); setTagDropdownOpen(false); }}
              />
              {canvasTags.map((tag) => (
                <DropdownItem
                  key={tag.id}
                  label={tag.name.toUpperCase()}
                  active={searchTagFilter === tag.id}
                  dotColor={tag.color}
                  onClick={() => { setSearchTagFilter(tag.id); setTagDropdownOpen(false); }}
                />
              ))}
              {canvasTags.length === 0 && (
                <div style={{ padding: "6px 12px", color: "var(--text-tertiary)", fontSize: "var(--label-size)" }}>
                  NO TAGS
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connection filter */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConnDropdownOpen(!connDropdownOpen);
              setTagDropdownOpen(false);
              setDateDropdownOpen(false);
            }}
            style={{
              background: searchConnectionFilter !== "any" ? "var(--bg-surface)" : "transparent",
              border: `1px solid ${searchConnectionFilter !== "any" ? "var(--border-strong)" : "var(--border-default)"}`,
              borderRadius: 0,
              color: searchConnectionFilter !== "any" ? "var(--text-primary)" : "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--label-size)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "3px 8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {connLabel} ▾
          </button>
          {connDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 2px)",
                left: 0,
                background: "var(--bg-base)",
                border: "1px solid var(--border-default)",
                borderRadius: 0,
                zIndex: 2100,
                minWidth: 160,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownItem label="ANY" active={searchConnectionFilter === "any"} onClick={() => { setSearchConnectionFilter("any"); setConnDropdownOpen(false); }} />
              <DropdownItem label="CONNECTED" active={searchConnectionFilter === "connected"} onClick={() => { setSearchConnectionFilter("connected"); setConnDropdownOpen(false); }} />
              <DropdownItem label="UNCONNECTED" active={searchConnectionFilter === "unconnected"} onClick={() => { setSearchConnectionFilter("unconnected"); setConnDropdownOpen(false); }} />
            </div>
          )}
        </div>

        {/* Date filter */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDateDropdownOpen(!dateDropdownOpen);
              setTagDropdownOpen(false);
              setConnDropdownOpen(false);
            }}
            style={{
              background: searchDateFilter !== "any" ? "var(--bg-surface)" : "transparent",
              border: `1px solid ${searchDateFilter !== "any" ? "var(--border-strong)" : "var(--border-default)"}`,
              borderRadius: 0,
              color: searchDateFilter !== "any" ? "var(--text-primary)" : "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--label-size)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "3px 8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {dateLabel} ▾
          </button>
          {dateDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 2px)",
                left: 0,
                background: "var(--bg-base)",
                border: "1px solid var(--border-default)",
                borderRadius: 0,
                zIndex: 2100,
                minWidth: 140,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownItem label="ANY DATE" active={searchDateFilter === "any"} onClick={() => { setSearchDateFilter("any"); setDateDropdownOpen(false); }} />
              <DropdownItem label="TODAY" active={searchDateFilter === "today"} onClick={() => { setSearchDateFilter("today"); setDateDropdownOpen(false); }} />
              <DropdownItem label="THIS WEEK" active={searchDateFilter === "week"} onClick={() => { setSearchDateFilter("week"); setDateDropdownOpen(false); }} />
            </div>
          )}
        </div>

        {/* Clear filters shortcut */}
        {isFilterActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetSearch();
              setTimeout(() => inputRef.current?.focus(), 10);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--label-size)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "3px 0",
              cursor: "pointer",
              marginLeft: "auto",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
          >
            CLEAR ✕
          </button>
        )}
      </div>

      {/* Match count row */}
      {isFilterActive && (
        <div
          style={{
            padding: "5px 12px",
            color: matchCount > 0 ? "var(--text-secondary)" : "var(--text-tertiary)",
            fontSize: "var(--label-size)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {matchCount === 0 ? "NO MATCHES" : `${matchCount} MATCH${matchCount === 1 ? "" : "ES"}`}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  label,
  active,
  onClick,
  dotColor,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dotColor?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "5px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        background: active ? "var(--bg-surface)" : hovered ? "var(--bg-surface)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontSize: "var(--label-size)",
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        transition: "background 0.1s ease",
      }}
    >
      {dotColor && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {label}
      {active && (
        <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontSize: "10px" }}>✓</span>
      )}
    </div>
  );
}
