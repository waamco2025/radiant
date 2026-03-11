import { SDA_CONFIG } from '../constants'
import { Tip } from './Tooltip'

export default function SDABadge({ type }) {
  const s = SDA_CONFIG[type] || SDA_CONFIG.full
  return (
    <Tip text={s.tip} w={260}>
      <span style={{
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 10.5,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        background: `color-mix(in srgb, ${s.color} 10%, transparent)`,
        color: s.color,
        border: `1px ${s.borderStyle} color-mix(in srgb, ${s.color} 45%, transparent)`,
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
      }}>
        {s.short}
      </span>
    </Tip>
  )
}
