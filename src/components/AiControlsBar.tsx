import { useState, useRef } from "react";
import { useStore } from "../store/useStore";
import { triggerSuggest } from "../utils/triggerSuggest";
import { triggerAutoTag, getHasAiTags } from "../utils/triggerAutoTag";
import { triggerQuestions } from "../utils/triggerQuestions";

const BASE_BUTTON_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#444444",
  border: "1px solid #1A1A1A",
  background: "#080808",
  padding: "6px 10px",
  borderRadius: 0,
  cursor: "pointer",
  transition: "border-color 0.1s ease, color 0.1s ease, opacity 0.1s ease",
  whiteSpace: "nowrap" as const,
};

export function AiControlsBar() {
  const config = useStore((s) => s.config);
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const isSuggestLoading = useStore((s) => s.isSuggestLoading);
  const isAutoTagLoading = useStore((s) => s.isAutoTagLoading);
  const isQuestionsLoading = useStore((s) => s.isQuestionsLoading);
  const setSettingsModalOpen = useStore((s) => s.setSettingsModalOpen);
  const suggestCooldownUntil = useStore((s) => s.suggestCooldownUntil);
  const setSuggestCooldownUntil = useStore((s) => s.setSuggestCooldownUntil);

  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [autoTagError, setAutoTagError] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  // Re-tag warning state
  const [reTagPending, setReTagPending] = useState(false);
  const reTagTimer = useRef<ReturnType<typeof setTimeout>>();

  const anyLoading = isSuggestLoading || isAutoTagLoading || isQuestionsLoading;

  // Feature toggles
  const showSuggest = config?.aiFeatures.ghostNodes !== false;
  const showAutoTag = config?.aiFeatures.autoTagging !== false;
  const showQuestions = config?.aiFeatures.questionGeneration !== false;

  // If all disabled, render nothing
  if (!showSuggest && !showAutoTag && !showQuestions) return null;

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
  const ideaCount = activeCanvas?.ideas.length ?? 0;

  const isSuggestOnCooldown = Date.now() < suggestCooldownUntil;

  async function handleSuggest() {
    if (!config?.anthropicApiKey) {
      setSettingsModalOpen(true);
      return;
    }
    if (anyLoading || isSuggestOnCooldown) return;

    if (ideaCount < 2) {
      setSuggestError("✦ NEED MORE IDEAS");
      setTimeout(() => setSuggestError(null), 2000);
      return;
    }

    try {
      await triggerSuggest("manual");
      setSuggestCooldownUntil(Date.now() + 10_000);
    } catch {
      setSuggestError("✦ ERROR");
      setTimeout(() => setSuggestError(null), 3000);
    }
  }

  async function handleAutoTag() {
    if (!config?.anthropicApiKey) {
      setSettingsModalOpen(true);
      return;
    }
    if (anyLoading) return;

    if (ideaCount < 2) {
      setAutoTagError("◈ NEED MORE IDEAS");
      setTimeout(() => setAutoTagError(null), 2000);
      return;
    }

    // Re-tag confirmation flow
    if (getHasAiTags()) {
      if (!reTagPending) {
        setReTagPending(true);
        if (reTagTimer.current) clearTimeout(reTagTimer.current);
        reTagTimer.current = setTimeout(() => setReTagPending(false), 3000);
        return;
      }
      // Second click within 3s — proceed
      setReTagPending(false);
      if (reTagTimer.current) clearTimeout(reTagTimer.current);
    }

    try {
      await triggerAutoTag();
    } catch {
      setAutoTagError("◈ ERROR");
      setTimeout(() => setAutoTagError(null), 3000);
    }
  }

  async function handleQuestions() {
    if (!config?.anthropicApiKey) {
      setSettingsModalOpen(true);
      return;
    }
    if (anyLoading) return;

    if (ideaCount < 2) {
      setQuestionsError("? NEED MORE IDEAS");
      setTimeout(() => setQuestionsError(null), 2000);
      return;
    }

    try {
      await triggerQuestions("canvas-wide");
    } catch {
      setQuestionsError("? ERROR");
      setTimeout(() => setQuestionsError(null), 3000);
    }
  }

  function renderButton(opts: {
    show: boolean;
    loading: boolean;
    loadingText: string;
    normalText: string;
    error: string | null;
    disabled: boolean;
    onClick: () => void;
  }) {
    if (!opts.show) return null;

    const isError = opts.error !== null;
    const isLoading = opts.loading;
    const isDisabled = opts.disabled || isLoading;

    let label = opts.normalText;
    if (isLoading) label = opts.loadingText;
    else if (isError) label = opts.error!;

    const style: React.CSSProperties = {
      ...BASE_BUTTON_STYLE,
      color: isError ? "#CC4444" : "#444444",
      cursor: isDisabled ? "default" : "pointer",
      animation: isLoading ? "ai-btn-pulse 1.5s ease-in-out infinite" : undefined,
    };

    return (
      <button
        style={style}
        onClick={opts.onClick}
        disabled={isDisabled}
        onMouseEnter={(e) => {
          if (!isDisabled && !isError) {
            e.currentTarget.style.borderColor = "#333333";
            e.currentTarget.style.color = "#888888";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && !isError) {
            e.currentTarget.style.borderColor = "#1A1A1A";
            e.currentTarget.style.color = "#444444";
          }
        }}
      >
        {label}
      </button>
    );
  }

  // Determine auto-tag button text (re-tag warning)
  const autoTagNormalText = reTagPending ? "◈ RE-TAG? (CLICK AGAIN)" : "◈ AUTO-TAG";

  return (
    <>
      <style>{`
        @keyframes ai-btn-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 6,
          alignItems: "center",
        }}
      >
        {renderButton({
          show: showSuggest,
          loading: isSuggestLoading,
          loadingText: "✦ THINKING...",
          normalText: "✦ SUGGEST",
          error: suggestError,
          disabled: anyLoading || isSuggestOnCooldown,
          onClick: handleSuggest,
        })}
        {renderButton({
          show: showAutoTag,
          loading: isAutoTagLoading,
          loadingText: "◈ ANALYZING...",
          normalText: autoTagNormalText,
          error: autoTagError,
          disabled: anyLoading,
          onClick: handleAutoTag,
        })}
        {renderButton({
          show: showQuestions,
          loading: isQuestionsLoading,
          loadingText: "? THINKING...",
          normalText: "? QUESTIONS",
          error: questionsError,
          disabled: anyLoading,
          onClick: handleQuestions,
        })}
      </div>
    </>
  );
}
