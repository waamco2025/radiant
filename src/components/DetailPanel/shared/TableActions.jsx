import { Tip } from './Tooltip'

export function TableActions({ onExpand, onDownload }) {
  const btnStyle = {
    fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
    cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
    transition: 'color 150ms, background 150ms',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', flexShrink: 0 }}>
      {onExpand && (
        <Tip text="Expand table">
          <span
            onClick={e => { e.stopPropagation(); onExpand() }}
            style={btnStyle}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 2 2 2 2 6" />
              <polyline points="10 14 14 14 14 10" />
              <line x1="2" y1="2" x2="7" y2="7" />
              <line x1="14" y1="14" x2="9" y2="9" />
            </svg>
          </span>
        </Tip>
      )}
      {onDownload && (
        <Tip text="Download CSV">
          <span
            onClick={e => { e.stopPropagation(); onDownload() }}
            style={btnStyle}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M4 7l4 4 4-4" />
              <path d="M2 12v2h12v-2" />
            </svg>
          </span>
        </Tip>
      )}
    </div>
  )
}

export function downloadCSV(filename, headers, rows) {
  const escape = (val) => {
    if (val == null) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => headers.map((_, i) => escape(row[i])).join(','))
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function claimsToCSV(claims, filename = 'claims.csv') {
  const headers = ['Type', 'Requirement', 'Description', 'Value', 'Confidence', 'Result']
  const rows = claims.map(c => {
    const type = c.type === 'extraction' ? 'EXT' : 'INF'
    const label = c.label || c.requirement || ''
    const desc = c.description || ''
    const value = c.humanValue || c.aiValue || c.output || ''
    const conf = c.aiConfidence != null ? Math.round(c.aiConfidence * 100) + '%' : ''
    const isGood = c.status === 'satisfactory' || c.status === 'verified'
    const isBad = c.status === 'unsatisfactory' || c.status === 'failed' || c.status === 'contested'
    const status = isGood ? 'SAT' : isBad ? 'UNSAT' : c.status === 'missing' ? 'MISS' : ''
    return [type, label, desc, value, conf, status]
  })
  downloadCSV(filename, headers, rows)
}
