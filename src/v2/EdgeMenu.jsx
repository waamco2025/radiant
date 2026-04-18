// EdgeMenu — small contextual menu anchored at an edge click point. Offers
// "View Disclosure Agreement" and, if a paired Evaluation Agreement exists,
// "View Evaluation Agreement". Per spec §4.3.
//
// Rendered via a portal so it escapes the canvas overlay's stacking context and
// sits above nodes.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function EdgeMenu({
  open,
  anchor,                  // { x, y } screen coords of the click
  hasEvaluationAgreement,  // bool — show the second option when true
  onViewDisclosure,
  onViewEvaluation,
  onClose,
}) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return
      onClose?.()
    }
    const escape = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    // Defer for one tick so the edge click that opened the menu doesn't close it.
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handler)
      document.addEventListener('keydown', escape)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escape)
    }
  }, [open, onClose])

  if (!open || !anchor) return null

  // Keep the menu in-viewport.
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 2000
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 2000
  const MENU_W = 220
  const MENU_H = hasEvaluationAgreement ? 84 : 44
  const PADDING = 12
  const x = Math.min(Math.max(PADDING, anchor.x + 8), viewportW - MENU_W - PADDING)
  const y = Math.min(Math.max(PADDING, anchor.y + 8), viewportH - MENU_H - PADDING)

  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    fontSize: 12,
    fontFamily: 'var(--font-display)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    background: 'transparent',
    transition: 'background 80ms',
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Agreement Edge options"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: MENU_W,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
        zIndex: 6000,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <div
        role="menuitem"
        tabIndex={0}
        style={itemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        onClick={() => {
          onViewDisclosure?.()
          onClose?.()
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: 'var(--accent-indigo)',
            flexShrink: 0,
          }}
        />
        <span>View Disclosure Agreement</span>
      </div>
      {hasEvaluationAgreement && (
        <div
          role="menuitem"
          tabIndex={0}
          style={{ ...itemStyle, borderTop: '1px solid var(--border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          onClick={() => {
            onViewEvaluation?.()
            onClose?.()
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--accent-purple, #a78bfa)',
              flexShrink: 0,
            }}
          />
          <span>View Evaluation Agreement</span>
        </div>
      )}
    </div>,
    document.body,
  )
}
