import { useState } from 'react';
import { AppConfig, saveConfig } from '../utils/config';
import { useStore } from '../store/useStore';

interface Props {
  onClose: () => void;
  initialConfig: AppConfig;
}

export function SettingsModal({ onClose, initialConfig }: Props) {
  const [apiKey, setApiKey] = useState(initialConfig.anthropicApiKey);
  const [showKey, setShowKey] = useState(false);
  const [features, setFeatures] = useState({ ...initialConfig.aiFeatures });
  const [theme, setTheme] = useState<'auto' | 'dark' | 'light'>(initialConfig.theme ?? 'auto');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleThemeSelect = (t: 'auto' | 'dark' | 'light') => {
    setTheme(t);
    // Apply immediately so user sees the effect before saving
    if (t === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveConfig({ anthropicApiKey: apiKey, theme, aiFeatures: features });
      setSaving(false);
      onClose();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleFeature = (key: keyof typeof features) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-secondary)',
    marginBottom: 6,
    display: 'block',
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-tertiary)',
    marginBottom: 10,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-base)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 0,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    padding: '7px 36px 7px 10px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 0,
    color: 'var(--text-tertiary)',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '6px 14px',
    cursor: 'pointer',
    transition: 'border-color 0.1s ease, color 0.1s ease',
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 0,
          minWidth: 400,
          zIndex: 5001,
          padding: 0,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            API CONFIGURATION
          </span>
          <span
            onClick={onClose}
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            [×]
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 18px 14px' }}>
          {/* API Key section */}
          <div style={{ marginBottom: 22 }}>
            <span style={labelStyle}>ANTHROPIC API KEY</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? 'Hide key' : 'Show key'}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  lineHeight: 1,
                }}
              >
                {showKey ? '●' : '○'}
              </button>
            </div>
          </div>

          {/* AI Features section */}
          <div style={{ marginBottom: 22 }}>
            <span style={sectionLabelStyle}>AI FEATURES</span>
            {(
              [
                ['ghostNodes', 'GHOST NODES'],
                ['autoTagging', 'AUTO-TAGGING'],
                ['questionGeneration', 'QUESTION GENERATION'],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                  cursor: 'pointer',
                }}
                onClick={() => toggleFeature(key)}
              >
                {/* Toggle switch */}
                <div
                  style={{
                    width: 28,
                    height: 14,
                    background: features[key] ? '#2A3A2A' : '#141414',
                    border: `1px solid ${features[key] ? '#3A5A3A' : '#1A1A1A'}`,
                    borderRadius: 0,
                    position: 'relative',
                    flexShrink: 0,
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: features[key] ? 14 : 2,
                      width: 8,
                      height: 8,
                      background: features[key] ? '#44AA66' : '#333333',
                      borderRadius: 0,
                      transition: 'left 0.15s ease, background 0.15s ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: features[key] ? '#666666' : '#333333',
                    transition: 'color 0.15s ease',
                    userSelect: 'none',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Theme section */}
          <div style={{ marginBottom: 22 }}>
            <span style={sectionLabelStyle}>THEME</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['auto', 'dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleThemeSelect(t)}
                  style={{
                    ...btnStyle,
                    borderColor: theme === t ? 'var(--border-focus)' : 'var(--border-default)',
                    color: theme === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    flex: 1,
                  }}
                  onMouseEnter={(e) => {
                    if (theme !== t) {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (theme !== t) {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.color = 'var(--text-tertiary)';
                    }
                  }}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Shortcuts / Commands */}
          <div style={{ marginBottom: 22 }}>
            <span style={sectionLabelStyle}>SHORTCUTS</span>
            <button
              onClick={() => {
                useStore.getState().setShortcutsOpen(true);
                onClose();
              }}
              style={{
                ...btnStyle,
                width: '100%',
                textAlign: 'left' as const,
                padding: '6px 10px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              VIEW COMMANDS
            </button>
          </div>

          {/* Save error */}
          {error && (
            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-red)',
                }}
              >
                {error}
              </span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={btnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                ...btnStyle,
                color: saving ? 'var(--text-muted)' : 'var(--accent-green)',
                borderColor: saving ? 'var(--border-default)' : 'rgba(68, 255, 136, 0.2)',
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.borderColor = 'rgba(68, 255, 136, 0.3)';
                  e.currentTarget.style.color = 'var(--accent-green)';
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.borderColor = 'rgba(68, 255, 136, 0.2)';
                  e.currentTarget.style.color = 'var(--accent-green)';
                }
              }}
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
