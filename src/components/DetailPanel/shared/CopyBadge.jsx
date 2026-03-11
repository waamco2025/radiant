import { useState } from 'react'

export default function CopyBadge({ value, truncated }) {
  const [copied, setCopied] = useState(false)
  const display = truncated ? value.slice(0, 8) + '...' + value.slice(-4) : value

  const handleCopy = (e) => {
    e.stopPropagation()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    try { navigator.clipboard.writeText(value) } catch (_) {}
  }

  return (
    <span
      onClick={handleCopy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
        background: copied
          ? 'color-mix(in srgb, var(--accent-green) 6%, transparent)'
          : 'var(--bg-deep)',
        border: `1px solid ${copied ? 'var(--accent-green)' : 'var(--border)'}`,
        cursor: 'pointer',
        transition: 'all 180ms',
        whiteSpace: 'nowrap',
      }}
      title="Click to copy"
    >
      {copied ? '✓ Copied' : display}
    </span>
  )
}
