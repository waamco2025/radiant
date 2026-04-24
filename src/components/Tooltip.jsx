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
  // Phase 9D.1.3 Fix 2: measured tooltip width (null until first-paint ref
  // measurement). Used to clamp the tooltip's left position + bound the
  // arrow's offset with the actual rendered box rather than the hard-coded
  // `halfEst = 200/2` estimate. Without this, a narrow tooltip near a
  // viewport edge gets clamped as if it were 200px wide — the arrow offset
  // then points beyond the tooltip body.
  const [measuredWidth, setMeasuredWidth] = useState(null)
  const anchorRef = useRef(null)
  const tooltipRef = useRef(null)

  // No-op rule: empty / null / undefined content → render children as-is.
  const hasContent = content != null && content !== ''
  const shouldRender = hasContent && !disabled

  // Phase 9A.6 Gate C (#90): when the Tooltip becomes non-renderable (content
  // cleared externally, e.g., V2App nulls the bell tooltip while the inbox
  // is open), clear any lingering `visible` state so the tooltip doesn't
  // pop back the moment content reappears. Without this reset, the bell
  // tooltip would persist visually because mouseleave never fires on an
  // unmounted wrapper.
  useEffect(() => {
    if (!shouldRender && visible) setVisible(false)
  }, [shouldRender, visible])

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

  // Phase 9D.1.3 Fix 2: measure actual rendered tooltip width once mounted.
  // Triggers a second render with the correct width flowing into both the
  // horizontal clamp AND the arrow offset calc. Single pass after first
  // paint — imperceptible to the user since the tooltip has no entry
  // animation.
  useEffect(() => {
    if (!visible || !tooltipRef.current) return
    const w = tooltipRef.current.offsetWidth
    if (w && w !== measuredWidth) setMeasuredWidth(w)
  }, [visible, anchorRect, resolvedPosition, content, measuredWidth])

  // Reset measured width on hide so the next show recomputes — content can
  // differ between invocations.
  useEffect(() => {
    if (!visible && measuredWidth !== null) setMeasuredWidth(null)
  }, [visible, measuredWidth])

  if (!shouldRender) {
    return children
  }

  const handleMouseEnter = (e) => {
    setAnchorRect(e.currentTarget.getBoundingClientRect())
    setVisible(true)
  }
  const handleMouseLeave = () => setVisible(false)
  // Phase 9A.6 Gate C (#90): click on the wrapped anchor dismisses the
  // tooltip. Pattern: clicking a button usually opens a dropdown/modal that
  // either covers the anchor (mouseleave fires) or replaces it (mouseleave
  // won't fire because the wrapper moves). Either way, clearing visible on
  // mousedown is the user-expected behaviour.
  const handleMouseDown = () => setVisible(false)

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
        onMouseDown={handleMouseDown}
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
          measuredWidth={measuredWidth}
        />,
        document.body,
      )}
    </>
  )
}

const TooltipBody = forwardRef(function TooltipBody({ content, anchorRect, position, mono, width, measuredWidth }, ref) {
  const anchorCenterX = anchorRect.left + anchorRect.width / 2
  const above = position === 'top'
  // Clamp horizontal position so the tooltip stays within the viewport.
  // Phase 9D.1.3 Fix 2: use the measured width when available, falling back
  // to the previous 200px estimate on first paint. Once measured, the clamp
  // respects the tooltip's actual bounds — no over-clamping for short
  // content, no under-clamping for long wrapped content.
  const maxW = width || 260
  const effectiveWidth = measuredWidth || Math.min(maxW, 200)
  const half = effectiveWidth / 2
  const margin = 8
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280
  const clampedX = Math.max(half + margin, Math.min(viewportW - half - margin, anchorCenterX))

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
  // Phase 9D.1.2 W2: arrow positioned via direct pixel math, not a
  // `translateX(-50%)` on a 0-width element. The prior approach relied on
  // the CSS-transforms spec's percentage rule that `-50%` refers to the
  // element's *border-box* width (= ARROW_SIZE * 2 for a 0-width triangle);
  // in practice this resolved to -ARROW_SIZE in some browsers and 0 in
  // others, producing a small horizontal misalignment. Explicit `left: calc`
  // makes the intent unambiguous regardless of engine.
  //
  // We want the triangle's visual center at `tooltipWidth/2 + offset` so it
  // points at the anchor. For an element with width: 0 and
  // border-left: ARROW_SIZE / border-right: ARROW_SIZE, the border-box
  // center sits ARROW_SIZE px right of the element's border-box left edge,
  // and the `left` property positions the border-box's left edge. So:
  //   element-left = tooltipWidth/2 + offset - ARROW_SIZE
  //                = calc(50% - ARROW_SIZE + offset)
  // Phase 9D.1.3 Fix 2: bound the arrow offset to the tooltip's actual
  // inner half-width (minus a small safe margin for the arrow base + the
  // rounded corner radius). Without this, arrow could be pushed past the
  // tooltip edge for anchors that clamp far off-center.
  const rawOffset = anchorCenterX - clampedX
  const ARROW_SAFE_MARGIN = ARROW_SIZE + 4 // arrow base + 4px from rounded corner
  const maxOffset = Math.max(0, half - ARROW_SAFE_MARGIN)
  const anchorOffsetFromTooltipCenter = Math.max(-maxOffset, Math.min(maxOffset, rawOffset))
  const arrowStyle = {
    position: 'absolute',
    left: `calc(50% - ${ARROW_SIZE}px + ${anchorOffsetFromTooltipCenter}px)`,
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
  const FILL = ARROW_SIZE - 1
  const arrowFillStyle = {
    position: 'absolute',
    left: `calc(50% - ${FILL}px + ${anchorOffsetFromTooltipCenter}px)`,
    width: 0,
    height: 0,
    borderLeft: `${FILL}px solid transparent`,
    borderRight: `${FILL}px solid transparent`,
    ...(above
      ? {
          top: 'calc(100% - 1px)',
          borderTop: `${FILL}px solid var(--bg-card)`,
        }
      : {
          bottom: 'calc(100% - 1px)',
          borderBottom: `${FILL}px solid var(--bg-card)`,
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
