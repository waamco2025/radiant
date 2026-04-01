import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export function TT({ text, anchorRef, w }) {
  const positionRef = useCallback(el => {
    if (el && anchorRef.current) {
      const b = anchorRef.current.getBoundingClientRect()
      const ew = el.offsetWidth
      let left = b.left + b.width / 2 - ew / 2
      if (left + ew > window.innerWidth - 12) left = window.innerWidth - ew - 12
      if (left < 12) left = 12
      el.style.left = left + 'px'
      el.style.top = (b.bottom + 8) + 'px'
    }
  }, [anchorRef])

  return createPortal(
    <div ref={positionRef} style={{
      position: 'fixed',
      left: -9999,
      top: -9999,
      padding: '8px 12px',
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-hover)',
      borderRadius: 6,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
      zIndex: 9999,
      boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
      pointerEvents: 'none',
      lineHeight: 1.6,
      whiteSpace: 'normal',
      width: w || 'auto',
      maxWidth: 280,
    }}>{text}</div>,
    document.body
  )
}

export function Tip({ text, children, w }) {
  const [show, setShow] = useState(false)
  const ref = useRef(null)
  return (
    <span
      ref={ref}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}
    >
      {children}
      {show && ref.current && <TT text={text} anchorRef={ref} w={w} />}
    </span>
  )
}
