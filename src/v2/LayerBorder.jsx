export default function LayerBorder({ color, visible, rightInset = 0 }) {
  return (
    <div style={{
      position: 'absolute',
      inset: `0 ${rightInset}px 0 0`,
      pointerEvents: 'none',
      zIndex: 50,
      boxShadow: visible
        ? `inset 0 0 0 3px var(--bg-deep), inset 0 0 0 4px ${color}, inset 0 0 0 7px var(--bg-deep), inset 0 0 0 8px color-mix(in srgb, ${color} 40%, transparent)`
        : 'none',
      transition: 'box-shadow 200ms ease, inset 200ms ease',
    }} />
  )
}
