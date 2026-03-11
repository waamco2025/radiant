import { LABEL_W } from '../constants'
import { Tip } from './Tooltip'

export default function GridRow({ label, value, vc, labelTip }) {
  const lbl = labelTip ? (
    <Tip text={labelTip} w={220}>
      <span style={{ borderBottom: '1px dashed var(--text-dim)', cursor: 'default' }}>{label}</span>
    </Tip>
  ) : label

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      minHeight: 32,
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: LABEL_W,
        flexShrink: 0,
        fontSize: 11,
        color: 'var(--text-tertiary)',
        paddingLeft: 8,
      }}>
        {lbl}
      </div>
      <div style={{
        flex: 1,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: vc || 'var(--text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  )
}
