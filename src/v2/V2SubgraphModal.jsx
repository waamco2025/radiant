import { useEffect, useCallback } from 'react'

export default function V2SubgraphModal({ node, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!node) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        animation: 'v2-modal-fade 200ms ease',
      }}
    >
      <style>{`
        @keyframes v2-modal-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '85%',
          height: '85%',
          background: 'var(--bg-deep)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            letterSpacing: '0.05em',
          }}>
            CHAIN: {node.name}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-display)',
          fontSize: 14,
        }}>
          Subgraph view for {node.name} — coming soon
        </div>
      </div>
    </div>
  )
}
