import { useRef, useEffect, useCallback, useState } from "react";
import { useStore } from "../store/useStore";

export function InputBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const addIdea = useStore((s) => s.addIdea);
  const selectedId = useStore((s) => s.selectedId);
  const [pulsing, setPulsing] = useState(false);
  const [focused, setFocused] = useState(false);

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        useStore.getState().setSelectedId(null);
        useStore.getState().setConnectingFrom(null);
        useStore.getState().setContextMenu(null, null);
        useStore.getState().setLeftSidebarOpen(false);
        focus();
      }
    };

    const unsub = useStore.subscribe((state, prev) => {
      if (prev.selectedId && !state.selectedId) {
        setTimeout(focus, 50);
      }
    });

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unsub();
    };
  }, [focus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const text = (e.target as HTMLInputElement).value.trim();
        if (text) {
          addIdea(text);
          (e.target as HTMLInputElement).value = "";
          setPulsing(true);
          setTimeout(() => setPulsing(false), 200);
        }
      }
    },
    [addIdea]
  );

  const rightOffset = selectedId ? 320 + 24 : 24;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: rightOffset,
        zIndex: 1000,
        transition: "right 0.25s var(--ease-out)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: `1px solid ${pulsing ? "var(--border-focus)" : focused ? "var(--border-strong)" : "var(--border-default)"}`,
          borderRadius: 0,
          background: "var(--bg-base)",
          transition: "border-color 0.2s ease",
          animation: pulsing ? "input-pulse 0.2s ease forwards" : undefined,
        }}
      >
        {/* Terminal prompt character */}
        <span
          style={{
            padding: "8px 0 8px 12px",
            color: focused ? "var(--text-secondary)" : "var(--text-tertiary)",
            fontSize: "var(--body-size)",
            fontFamily: "var(--font-mono)",
            fontWeight: 400,
            transition: "color 0.2s ease",
            userSelect: "none",
          }}
        >
          &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="plop an idea..."
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: 260,
            padding: "8px 12px 8px 8px",
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            fontSize: "var(--body-size)",
            fontFamily: "var(--font-mono)",
          }}
        />
      </div>
    </div>
  );
}
