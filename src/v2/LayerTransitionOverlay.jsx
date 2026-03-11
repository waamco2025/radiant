export default function LayerTransitionOverlay({ phase, color }) {
  // phase: 'idle' | 'fadeOut' | 'hold' | 'fadeIn'
  const isVisible = phase !== 'idle'
  const isOpaque = phase === 'fadeOut' || phase === 'hold'

  // Use the tinted background for the dive target
  const isDark = typeof document !== 'undefined' && document.documentElement.dataset.theme !== 'light'
  const bg = color
    ? isDark
      ? `color-mix(in srgb, var(--bg-deep) 92%, ${color})`
      : `color-mix(in srgb, #e4e0da 94%, ${color})`
    : 'var(--bg-deep)'

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      backgroundColor: bg,
      opacity: isOpaque ? 1 : 0,
      transition:
        phase === 'hold' ? 'none' :
        phase === 'fadeOut' ? 'opacity 250ms cubic-bezier(0.4, 0, 1, 1)' :
        phase === 'fadeIn' ? 'opacity 300ms cubic-bezier(0, 0, 0.2, 1)' :
        'none',
      pointerEvents: isVisible ? 'all' : 'none',
    }} />
  )
}
