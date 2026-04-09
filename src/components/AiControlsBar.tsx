import { useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import { triggerAutoTag, getHasAiTags } from "../utils/triggerAutoTag";
import { triggerSuggest } from "../utils/triggerSuggest";
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
  const isAutoTagLoading = useStore((s) => s.isAutoTagLoading);
  const setSettingsModalOpen = useStore((s) => s.setSettingsModalOpen);

  const isSuggestLoading = useStore((s) => s.isSuggestLoading);
  const isQuestionsLoading = useStore((s) => s.isQuestionsLoading);

  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [autoTagError, setAutoTagError] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [reTagPending, setReTagPending] = useState(false);
  const reTagTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (reTagTimer.current) clearTimeout(reTagTimer.current);
    };
  }, []);

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
  const ideaCount = activeCanvas?.ideas.length ?? 0;

  async function handleAutoTag() {
    if (!config?.anthropicApiKey) {
      setSettingsModalOpen(true);
      return;
    }
    if (isAutoTagLoading) return;

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
      setReTagPending(false);
      if (reTagTimer.current) clearTimeout(reTagTimer.current);
    }

    try {
      await triggerAutoTag();
    } catch (err) {
      console.error("[AutoTag] error:", err);
      setAutoTagError("◈ ERROR");
      setTimeout(() => setAutoTagError(null), 3000);
    }
  }

  async function handleSuggest() {
    if (!config?.anthropicApiKey) { setSettingsModalOpen(true); return; }
    if (isSuggestLoading || isAutoTagLoading || isQuestionsLoading) return;
    if (ideaCount < 2) {
      setSuggestError("✦ NEED MORE IDEAS");
      setTimeout(() => setSuggestError(null), 2000);
      return;
    }
    try {
      await triggerSuggest("manual");
    } catch (err) {
      console.error("[Suggest] error:", err);
      setSuggestError("✦ ERROR");
      setTimeout(() => setSuggestError(null), 3000);
    }
  }

  async function handleQuestions() {
    if (!config?.anthropicApiKey) { setSettingsModalOpen(true); return; }
    if (isSuggestLoading || isAutoTagLoading || isQuestionsLoading) return;
    if (ideaCount < 2) {
      setQuestionsError("? NEED MORE IDEAS");
      setTimeout(() => setQuestionsError(null), 2000);
      return;
    }
    try {
      await triggerQuestions("canvas-wide");
    } catch (err) {
      console.error("[Questions] error:", err);
      setQuestionsError("? ERROR");
      setTimeout(() => setQuestionsError(null), 3000);
    }
  }

  function btn(opts: {
    loading: boolean; loadingText: string; normalText: string;
    error: string | null; onClick: () => void;
  }) {
    const isErr = opts.error !== null;
    const label = opts.loading ? opts.loadingText : isErr ? opts.error! : opts.normalText;
    return (
      <button
        style={{
          ...BASE_BUTTON_STYLE,
          color: isErr ? "#CC4444" : "#444444",
          cursor: opts.loading ? "default" : "pointer",
          animation: opts.loading ? "ai-btn-pulse 1.5s ease-in-out infinite" : undefined,
        }}
        onClick={opts.onClick}
        disabled={opts.loading}
        onMouseEnter={(e) => { if (!opts.loading && !isErr) { e.currentTarget.style.borderColor = "#333333"; e.currentTarget.style.color = "#888888"; } }}
        onMouseLeave={(e) => { if (!opts.loading && !isErr) { e.currentTarget.style.borderColor = "#1A1A1A"; e.currentTarget.style.color = "#444444"; } }}
      >{label}</button>
    );
  }

  const autoTagLabel = isAutoTagLoading ? "◈ ANALYZING..." : autoTagError ?? (reTagPending ? "◈ RE-TAG? (CLICK AGAIN)" : "◈ AUTO-TAG");

  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 4, alignItems: "center" }}>
      {btn({ loading: isSuggestLoading, loadingText: "✦ THINKING...", normalText: "✦ SUGGEST", error: suggestError, onClick: handleSuggest })}
      {config?.aiFeatures.autoTagging !== false && (
        <button
          style={{ ...BASE_BUTTON_STYLE, color: autoTagError ? "#CC4444" : "#444444", cursor: isAutoTagLoading ? "default" : "pointer", animation: isAutoTagLoading ? "ai-btn-pulse 1.5s ease-in-out infinite" : undefined }}
          onClick={handleAutoTag} disabled={isAutoTagLoading}
          onMouseEnter={(e) => { if (!isAutoTagLoading && !autoTagError) { e.currentTarget.style.borderColor = "#333333"; e.currentTarget.style.color = "#888888"; } }}
          onMouseLeave={(e) => { if (!isAutoTagLoading && !autoTagError) { e.currentTarget.style.borderColor = "#1A1A1A"; e.currentTarget.style.color = "#444444"; } }}
        >{autoTagLabel}</button>
      )}
      {btn({ loading: isQuestionsLoading, loadingText: "? THINKING...", normalText: "? QUESTIONS", error: questionsError, onClick: handleQuestions })}
    </div>
  );
}
