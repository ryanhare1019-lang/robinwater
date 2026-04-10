import { useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import { triggerAutoTag, getHasAiTags } from "../utils/triggerAutoTag";
import { triggerSuggest } from "../utils/suggestions/triggerSuggest";
import { triggerQuestions } from "../utils/triggerQuestions";
import type { SuggestionMode } from "../types";

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

const MENU_ITEMS: Array<{ mode: SuggestionMode; icon: string; label: string; iconColor: string }> = [
  { mode: 'extend',    icon: '✦', label: 'EXTEND',        iconColor: '#444444' },
  { mode: 'synthesize',icon: '◆', label: 'SYNTHESIZE',    iconColor: '#4466AA' },
  { mode: 'wildcard',  icon: '✸', label: 'WILD CARD',     iconColor: '#CC8844' },
  { mode: 'all',       icon: '✦', label: 'ALL (DEFAULT)', iconColor: '#444444' },
];

const LOADING_TEXT: Record<SuggestionMode, string> = {
  extend:    '✦ EXTENDING...',
  synthesize:'◆ SYNTHESIZING...',
  wildcard:  '✸ WILDCARDING...',
  all:       '✦ THINKING...',
};

export function AiControlsBar() {
  const config = useStore((s) => s.config);
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const isAutoTagLoading = useStore((s) => s.isAutoTagLoading);
  const setSettingsModalOpen = useStore((s) => s.setSettingsModalOpen);
  const isSuggestLoading = useStore((s) => s.isSuggestLoading);
  const isQuestionsLoading = useStore((s) => s.isQuestionsLoading);
  const activeSuggestMode = useStore((s) => s.activeSuggestMode);
  const suggestCooldowns = useStore((s) => s.suggestCooldowns);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [autoTagError, setAutoTagError] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [reTagPending, setReTagPending] = useState(false);
  const reTagTimer = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const arrowBtnRef = useRef<HTMLButtonElement>(null);

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
  const ideaCount = activeCanvas?.ideas.length ?? 0;

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function onDown(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        arrowBtnRef.current && !arrowBtnRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [dropdownOpen]);

  useEffect(() => {
    return () => { if (reTagTimer.current) clearTimeout(reTagTimer.current); };
  }, []);

  async function handleSuggestMode(mode: SuggestionMode) {
    setDropdownOpen(false);
    if (!config?.anthropicApiKey) { setSettingsModalOpen(true); return; }
    if (isSuggestLoading || isAutoTagLoading || isQuestionsLoading) return;

    const now = Date.now();
    if (now < suggestCooldowns[mode]) return; // still cooling down

    // Check minimum requirements per mode
    if (mode === 'extend' && ideaCount < 2) {
      setSuggestError('✦ NEED MORE IDEAS');
      setTimeout(() => setSuggestError(null), 2000);
      return;
    }
    if (mode === 'synthesize') {
      const canvas = canvases.find((c) => c.id === activeCanvasId);
      const hasConnections = (canvas?.connections.length ?? 0) > 0;
      const enoughIdeas = ideaCount >= 6;
      if (!hasConnections && !enoughIdeas) {
        setSuggestError('◆ NEED MORE CLUSTERS');
        setTimeout(() => setSuggestError(null), 2000);
        return;
      }
    }
    if ((mode === 'all') && ideaCount < 2) {
      setSuggestError('✦ NEED MORE IDEAS');
      setTimeout(() => setSuggestError(null), 2000);
      return;
    }

    try {
      await triggerSuggest(mode);
    } catch (err) {
      console.error(`[Suggest:${mode}] error:`, err);
      setSuggestError('✦ ERROR');
      setTimeout(() => setSuggestError(null), 3000);
    }
  }

  async function handleAutoTag() {
    if (!config?.anthropicApiKey) { setSettingsModalOpen(true); return; }
    if (isAutoTagLoading) return;
    if (ideaCount < 2) {
      setAutoTagError('◈ NEED MORE IDEAS');
      setTimeout(() => setAutoTagError(null), 2000);
      return;
    }
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
      console.error('[AutoTag] error:', err);
      setAutoTagError('◈ ERROR');
      setTimeout(() => setAutoTagError(null), 3000);
    }
  }

  async function handleQuestions() {
    if (!config?.anthropicApiKey) { setSettingsModalOpen(true); return; }
    if (isSuggestLoading || isAutoTagLoading || isQuestionsLoading) return;
    if (ideaCount < 2) {
      setQuestionsError('? NEED MORE IDEAS');
      setTimeout(() => setQuestionsError(null), 2000);
      return;
    }
    try {
      await triggerQuestions('canvas-wide');
    } catch (err) {
      console.error('[Questions] error:', err);
      setQuestionsError('? ERROR');
      setTimeout(() => setQuestionsError(null), 3000);
    }
  }

  // Suggest button label
  const isErr = suggestError !== null;
  const suggestMainLabel = isSuggestLoading && activeSuggestMode
    ? LOADING_TEXT[activeSuggestMode]
    : isErr
      ? suggestError!
      : '✦ SUGGEST';

  const autoTagLabel = isAutoTagLoading
    ? '◈ ANALYZING...'
    : autoTagError ?? (reTagPending ? '◈ RE-TAG? (CLICK AGAIN)' : '◈ AUTO-TAG');

  function btn(opts: { loading: boolean; loadingText: string; normalText: string; error: string | null; onClick: () => void }) {
    const isE = opts.error !== null;
    const label = opts.loading ? opts.loadingText : isE ? opts.error! : opts.normalText;
    return (
      <button
        style={{
          ...BASE_BUTTON_STYLE,
          color: isE ? '#CC4444' : '#444444',
          cursor: opts.loading ? 'default' : 'pointer',
          animation: opts.loading ? 'ai-btn-pulse 1.5s ease-in-out infinite' : undefined,
        }}
        onClick={opts.onClick}
        disabled={opts.loading}
        onMouseEnter={(e) => { if (!opts.loading && !isE) { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.color = '#888888'; } }}
        onMouseLeave={(e) => { if (!opts.loading && !isE) { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#444444'; } }}
      >{label}</button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}>

      {/* Split suggest button */}
      <div style={{ display: 'flex', position: 'relative' }}>

        {/* Main area → ALL mode */}
        <button
          style={{
            ...BASE_BUTTON_STYLE,
            color: isErr ? '#CC4444' : '#444444',
            borderRight: 'none',
            cursor: isSuggestLoading ? 'default' : 'pointer',
            animation: isSuggestLoading ? 'ai-btn-pulse 1.5s ease-in-out infinite' : undefined,
            paddingRight: 8,
          }}
          onClick={() => handleSuggestMode('all')}
          disabled={isSuggestLoading}
          onMouseEnter={(e) => { if (!isSuggestLoading && !isErr) { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.color = '#888888'; } }}
          onMouseLeave={(e) => { if (!isSuggestLoading && !isErr) { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#444444'; } }}
        >
          {suggestMainLabel}
        </button>

        {/* Arrow → opens dropdown */}
        <button
          ref={arrowBtnRef}
          style={{
            ...BASE_BUTTON_STYLE,
            width: 24,
            padding: 0,
            borderLeft: '1px solid #1A1A1A',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          onClick={() => setDropdownOpen((o) => !o)}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.color = '#888888'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#444444'; }}
        >
          ▾
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              background: '#0E0E0E',
              border: '1px solid #222222',
              borderRadius: 0,
              zIndex: 1000,
              minWidth: 170,
              overflow: 'hidden',
            }}
          >
            {MENU_ITEMS.map((item, i) => (
              <button
                key={item.mode}
                onClick={() => handleSuggestMode(item.mode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderTop: i > 0 ? '1px solid #1A1A1A' : 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  color: '#888888',
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  whiteSpace: 'nowrap' as const,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = '#DDDDDD'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888888'; }}
              >
                <span style={{ color: item.iconColor }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Auto-tag button */}
      {config?.aiFeatures.autoTagging !== false && (
        <button
          style={{
            ...BASE_BUTTON_STYLE,
            color: autoTagError ? '#CC4444' : '#444444',
            cursor: isAutoTagLoading ? 'default' : 'pointer',
            animation: isAutoTagLoading ? 'ai-btn-pulse 1.5s ease-in-out infinite' : undefined,
          }}
          onClick={handleAutoTag}
          disabled={isAutoTagLoading}
          onMouseEnter={(e) => { if (!isAutoTagLoading && !autoTagError) { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.color = '#888888'; } }}
          onMouseLeave={(e) => { if (!isAutoTagLoading && !autoTagError) { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#444444'; } }}
        >
          {autoTagLabel}
        </button>
      )}

      {/* Questions button */}
      {btn({ loading: isQuestionsLoading, loadingText: '? THINKING...', normalText: '? QUESTIONS', error: questionsError, onClick: handleQuestions })}
    </div>
  );
}
