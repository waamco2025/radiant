// Tooltip — custom hover tooltip primitive.
//
// Phase 9A.2 item 4: zero-delay portal-rendered tooltip to replace native
// `title=` attributes (which have ~500ms delay) and ad-hoc floating-div
// tooltip patterns scattered through the app.
//
// Usage:
//   <Tooltip content="Human-edited from AI's original extraction">
//     <PencilIcon />
//   </Tooltip>
//
// Positioning defaults to 'auto' (above the anchor; flips to below if the
// tooltip would overflow the viewport top). String or JSX content accepted.
// Renders to document.body via createPortal with `pointer-events: none` so
// it never blocks interaction with underlying elements.

import { useState, useRef, useEffect, forwardRef } from 'react'
import { createPortal } from 'react-dom'

const ARROW_SIZE = 6
const GAP = 8 // distance between anchor edge and tooltip edge (leaves room for the arrow)

export default function Tooltip({
  content,
  children,
  position = 'auto',  // 'top' | 'bottom' | 'auto'
  mono = false,
  width,              // override max-width
  disabled = false,
  wrapperStyle,       // extra styles on the wrapper span (e.g., `{ flex: 1 }`
                      // when Tooltip is a flex child and needs to grow).
}) {
  const [visible, setVisible] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const [resolvedPosition, setResolvedPosition] = useState('top')
  const anchorRef = useRef(null)
  const tooltipRef = useRef(null)

  // No-op rule: empty / null / undefined content → render children as-is.
  const hasContent = content != null && content !== ''
  const shouldRender = hasContent && !disabled

  // Recompute on scroll/resize while visible so tooltip tracks the anchor.
  useEffect(() => {
    if (!visible) return
    const recompute = () => {
      if (anchorRef.current) {
        setAnchorRect(anchorRef.current.getBoundingClientRect())
      }
    }
    window.addEventListener('scroll', recompute, true)
    window.addEventListener('resize', recompute)
    return () => {
      window.removeEventListener('scroll', recompute, true)
      window.removeEventListener('resize', recompute)
    }
  }, [visible])

  // Decide final position once we know anchor + tooltip sizes.
  useEffect(() => {
    if (!visible || !anchorRect) return
    if (position !== 'auto') {
      setResolvedPosition(position)
      return
    }
    const tooltipH = tooltipRef.current ? tooltipRef.current.offsetHeight : 32
    const wouldOverflowTop = anchorRect.top - GAP - ARROW_SIZE - tooltipH < 8
    setResolvedPosition(wouldOverflowTop ? 'bottom' : 'top')
  }, [visible, anchorRect, position])

  if (!shouldRender) {
    return children
  }

  const handleMouseEnter = (e) => {
    setAnchorRect(e.currentTarget.getBoundingClientRect())
    setVisible(true)
  }
  const handleMouseLeave = () => setVisible(false)

  // Wrap children in an inline-block span. Avoids the fragility of
  // cloneElement+forwardRef (some existing components don't forward refs)
  // and keeps layout stable since span inherits parent styles. The span
  // catches enter/leave and owns the ref used for scroll/resize recompute.
  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-flex', alignItems: 'center', ...(wrapperStyle || null) }}
      >
        {children}
      </span>
      {visible && anchorRect && typeof document !== 'undefined' && createPortal(
        <TooltipBody
          ref={tooltipRef}
          content={content}
          anchorRect={anchorRect}
          position={resolvedPosition}
          mono={mono}
          width={width}
        />,
        document.body,
      )}
    </>
  )
}

const TooltipBody = forwardRef(function TooltipBody({ content, anchorRect, position, mono, width }, ref) {
  const anchorCenterX = anchorRect.left + anchorRect.width / 2
  const above = position === 'top'
  // Clamp horizontal position so the tooltip stays within the viewport.
  const maxW = width || 260
  const halfEst = Math.min(maxW, 200) / 2
  const margin = 8
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280
  const clampedX = Math.max(halfEst + margin, Math.min(viewportW - halfEst - margin, anchorCenterX))

  const baseStyle = {
    position: 'fixed',
    // Phase 9A.3 backlog #62(c)/(d): bumped from 6000 so tooltips anchored
    // inside a Modal (Backdrop zIndex 10000) still render above the modal.
    // The chrome tooltips don't regress — background hover is blocked when
    // a modal is open.
    zIndex: 10100,
    left: clampedX,
    top: above
      ? anchorRect.top - GAP - ARROW_SIZE
      : anchorRect.bottom + GAP + ARROW_SIZE,
    transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 11,
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    maxWidth: maxW,
    whiteSpace: 'normal',
    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
  }

  // Arrow: small triangle pointing toward the anchor.
  // `left` positioned in pixel space relative to the tooltip's own bounds
  // AFTER the translate(-50%,…) — so the arrow origin is at the tooltip's
  // horizontal midpoint unless the anchor centre was clamped off-screen,
  // in which case we nudge the arrow toward the anchor edge.
  const anchorOffsetFromTooltipCenter = anchorCenterX - clampedX
  const arrowStyle = {
    position: 'absolute',
    left: '50%',
    transform: `translateX(calc(-50% + ${anchorOffsetFromTooltipCenter}px))`,
    width: 0,
    height: 0,
    borderLeft: `${ARROW_SIZE}px solid transparent`,
    borderRight: `${ARROW_SIZE}px solid transparent`,
    ...(above
      ? {
          top: '100%',
          borderTop: `${ARROW_SIZE}px solid var(--border)`,
        }
      : {
          bottom: '100%',
          borderBottom: `${ARROW_SIZE}px solid var(--border)`,
        }),
  }
  // Inner arrow fill (1px inset) to match the border-on-card look.
  const arrowFillStyle = {
    position: 'absolute',
    left: '50%',
    transform: `translateX(calc(-50% + ${anchorOffsetFromTooltipCenter}px))`,
    width: 0,
    height: 0,
    borderLeft: `${ARROW_SIZE - 1}px solid transparent`,
    borderRight: `${ARROW_SIZE - 1}px solid transparent`,
    ...(above
      ? {
          top: 'calc(100% - 1px)',
          borderTop: `${ARROW_SIZE - 1}px solid var(--bg-card)`,
        }
      : {
          bottom: 'calc(100% - 1px)',
          borderBottom: `${ARROW_SIZE - 1}px solid var(--bg-card)`,
        }),
  }

  return (
    <div ref={ref} style={baseStyle}>
      {content}
      <div style={arrowStyle} />
      <div style={arrowFillStyle} />
    </div>
  )
})
