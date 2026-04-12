import type { MonoliteFileCanvas } from '../utils/monoliteFile';

interface ImportModalProps {
  canvas: MonoliteFileCanvas;
  exportedAt: string;
  skippedCount: number;
  versionWarning: boolean;
  largeCanvasWarning: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatExportDate(iso: string): string {
  if (!iso) return 'UNKNOWN DATE';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }).toUpperCase() + ' AT ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    }).toUpperCase();
  } catch {
    return 'UNKNOWN DATE';
  }
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 4000,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 0,
  minWidth: 320,
  maxWidth: 420,
  fontFamily: 'var(--font-mono)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.12em',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase' as const,
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-primary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  marginBottom: 16,
  wordBreak: 'break-word' as const,
};

const warningStyle: React.CSSProperties = {
  margin: '0 20px 12px',
  padding: '8px 10px',
  background: 'rgba(204, 136, 0, 0.08)',
  border: '1px solid rgba(204, 136, 0, 0.25)',
  fontSize: 10,
  letterSpacing: '0.06em',
  color: '#CC8800',
  textTransform: 'uppercase' as const,
  lineHeight: 1.5,
};

const btnRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '16px 20px 20px',
  borderTop: '1px solid var(--border-subtle)',
};

const btnBase: React.CSSProperties = {
  flex: 1,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  padding: '8px 12px',
  borderRadius: 0,
  cursor: 'pointer',
  transition: 'border-color 0.1s ease, color 0.1s ease',
};

export function MonoliteImportModal({
  canvas,
  exportedAt,
  skippedCount,
  versionWarning,
  largeCanvasWarning,
  onConfirm,
  onCancel,
}: ImportModalProps) {
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}>
          IMPORT CANVAS
        </div>

        {/* Data */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={labelStyle}>NAME</div>
          <div style={valueStyle}>{canvas.name}</div>

          <div style={labelStyle}>IDEAS</div>
          <div style={valueStyle}>
            {canvas.ideas.length} {canvas.ideas.length === 1 ? 'IDEA' : 'IDEAS'}
            {canvas.connections.length > 0 && `, ${canvas.connections.length} ${canvas.connections.length === 1 ? 'CONNECTION' : 'CONNECTIONS'}`}
          </div>

          <div style={labelStyle}>EXPORTED</div>
          <div style={{ ...valueStyle, marginBottom: 12 }}>{formatExportDate(exportedAt)}</div>
        </div>

        {/* Warnings */}
        {versionWarning && (
          <div style={warningStyle}>
            THIS FILE WAS CREATED WITH A NEWER VERSION OF MONOLITE. SOME DATA MAY NOT IMPORT CORRECTLY.
          </div>
        )}
        {skippedCount > 0 && (
          <div style={warningStyle}>
            WARNING: {skippedCount} {skippedCount === 1 ? 'IDEA' : 'IDEAS'} SKIPPED (MISSING DATA)
          </div>
        )}
        {largeCanvasWarning && (
          <div style={warningStyle}>
            THIS CANVAS HAS {canvas.ideas.length} IDEAS. IMPORTING MAY BE SLOW.
          </div>
        )}

        {/* Buttons */}
        <div style={btnRowStyle}>
          <button
            style={{
              ...btnBase,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onClick={onConfirm}
          >
            IMPORT
          </button>
          <button
            style={{
              ...btnBase,
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-tertiary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            onClick={onCancel}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

export function MonoliteErrorModal({ message, onClose }: ErrorModalProps) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, minWidth: 280, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: '#CC4444',
          textTransform: 'uppercase',
        }}>
          IMPORT ERROR
        </div>
        <div style={{ padding: '16px 20px', fontSize: 11, color: '#CC4444', letterSpacing: '0.06em', lineHeight: 1.6, textTransform: 'uppercase' }}>
          {message}
        </div>
        <div style={btnRowStyle}>
          <button
            style={{
              ...btnBase,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
