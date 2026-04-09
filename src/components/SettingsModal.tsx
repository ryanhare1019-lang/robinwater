import { useState } from 'react';
import { AppConfig, saveConfig } from '../utils/config';

interface Props {
  onClose: () => void;
  initialConfig: AppConfig;
}

export function SettingsModal({ onClose, initialConfig }: Props) {
  const [apiKey, setApiKey] = useState(initialConfig.anthropicApiKey);
  const [showKey, setShowKey] = useState(false);
  const [features, setFeatures] = useState({ ...initialConfig.aiFeatures });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveConfig({ anthropicApiKey: apiKey, aiFeatures: features });
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
    color: '#666666',
    marginBottom: 6,
    display: 'block',
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#444444',
    marginBottom: 10,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#050505',
    border: '1px solid #1A1A1A',
    borderRadius: 0,
    color: '#888888',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    padding: '7px 36px 7px 10px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    background: '#080808',
    border: '1px solid #1A1A1A',
    borderRadius: 0,
    color: '#444444',
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
          background: '#0A0A0A',
          border: '1px solid #222222',
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
            borderBottom: '1px solid #1A1A1A',
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
              color: '#666666',
              fontFamily: 'var(--font-mono)',
            }}
          >
            API CONFIGURATION
          </span>
          <span
            onClick={onClose}
            style={{
              fontSize: 11,
              color: '#333333',
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
                onFocus={(e) => { e.currentTarget.style.borderColor = '#333333'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#1A1A1A'; }}
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
                  color: '#333333',
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

          {/* Save error */}
          {error && (
            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: '#CC4444',
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
                e.currentTarget.style.borderColor = '#333333';
                e.currentTarget.style.color = '#666666';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#1A1A1A';
                e.currentTarget.style.color = '#444444';
              }}
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                ...btnStyle,
                color: saving ? '#333333' : '#558855',
                borderColor: saving ? '#1A1A1A' : '#2A3A2A',
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.borderColor = '#3A5A3A';
                  e.currentTarget.style.color = '#66AA66';
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.borderColor = '#2A3A2A';
                  e.currentTarget.style.color = '#558855';
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
