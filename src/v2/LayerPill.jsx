import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const CATEGORY_ICONS = {
  person: '●',
  place: '◆',
  process: '◎',
  product: '■',
  party: '⬡',
}

const CATEGORY_LABELS = {
  person: 'PERSON',
  place: 'PLACE',
  process: 'PROCESS',
  product: 'PRODUCT',
  party: 'PARTY',
}

export default function LayerPill({ layerStack, onSurface }) {
  const depth = layerStack.length - 1
  if (depth === 0) return null

  const current = layerStack[layerStack.length - 1]
  const color = current.color

  return (
    <UpButton color={color} onSurface={onSurface} />
  )
}

function UpButton({ color, onSurface }) {
  const [hovered, setHovered] = useState(false)
  const [phase, setPhase] = useState('button') // 'button' → 'bg'
  const [tooltipPos, setTooltipPos] = useState(null)

  // Two-phase entrance: button fades+slides in (0–200ms), then bg fades in (200–350ms)
  useEffect(() => {
    const timer = setTimeout(() => setPhase('bg'), 200)
    return () => clearTimeout(timer)
  }, [])

  // Portal tooltip positioning
  const handleMouseEnter = (e) => {
    setHovered(true)
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  const handleMouseLeave = () => {
    setHovered(false)
    setTooltipPos(null)
  }

  return (
    <>
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: `translate(-50%, -50%)${hovered ? ' scale(1.08)' : ''}`,
        zIndex: 55,
      }}>
        <style>{`
          @keyframes v2-upbtn-fadein {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes v2-upbtn-bg {
            from { background-color: transparent; border-color: transparent; }
          }
        `}</style>
        <button
          onClick={(e) => { e.stopPropagation(); onSurface?.() }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            width: 36,
            height: 36,
            background: phase === 'bg'
              ? `color-mix(in srgb, ${color} 12%, transparent)`
              : 'transparent',
            border: phase === 'bg'
              ? `1px solid color-mix(in srgb, ${color} 35%, transparent)`
              : '1px solid transparent',
            borderRadius: '50%',
            color: color,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontFamily: 'var(--font-mono)',
            padding: 0,
            lineHeight: 1,
            transition: phase === 'bg' ? 'background 150ms ease, border-color 150ms ease' : 'none',
            animation: 'v2-upbtn-fadein 200ms ease both',
          }}
        >
          ↑
        </button>
      </div>

      {/* Portal tooltip */}
      {hovered && tooltipPos && createPortal(
        <div style={{
          position: 'fixed',
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: 'translate(-50%, -100%)',
          padding: '4px 8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}>
          Back to parent layer
        </div>,
        document.body
      )}
    </>
  )
}
