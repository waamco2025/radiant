import { useMemo } from 'react'

export default function DataTable({
  columns = [],
  rows = [],
  groupBy = null,
  groupColors = null,
  groupLabels = null,
  maxRows = null,
  rowHeight = 34,
  emptyMessage = 'No data',
  onRowClick = null,
  highlightRow = null,
  compact = false,
  stickyHeader = true,
}) {
  const hasHeaders = columns.some(c => c.header != null)

  const groupedRows = useMemo(() => {
    if (!groupBy) return [{ group: null, rows }]
    const groups = {}
    rows.forEach(r => {
      const g = r[groupBy] || 'other'
      if (!groups[g]) groups[g] = []
      groups[g].push(r)
    })
    return Object.entries(groups).map(([group, groupRows]) => ({ group, rows: groupRows }))
  }, [rows, groupBy])

  let globalIndex = 0

  return (
    <div style={{
      borderRadius: 6,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      background: 'var(--bg-deep)',
    }}>
      {/* Header */}
      {hasHeaders && (
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          height: 30,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          position: stickyHeader ? 'sticky' : 'static',
          top: 0,
          zIndex: 2,
        }}>
          {columns.map((col, ci) => (
            <div key={col.key} style={{
              width: col.width === 'flex' ? undefined : col.width,
              flex: col.width === 'flex' ? 1 : undefined,
              flexShrink: col.width === 'flex' ? 1 : 0,
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--text-dim)',
              letterSpacing: '0.03em',
              paddingLeft: 10,
              display: 'flex',
              alignItems: 'center',
              borderLeft: ci > 0 ? '1px solid var(--border)' : 'none',
              textTransform: 'uppercase',
            }}>
              {col.header}
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div style={{
        maxHeight: maxRows ? maxRows * rowHeight : undefined,
        overflowY: maxRows ? 'auto' : 'visible',
      }}>
        {rows.length === 0 && (
          <div style={{
            padding: '20px 0',
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-dim)',
          }}>
            {emptyMessage}
          </div>
        )}

        {groupedRows.map(({ group, rows: groupRows }, gi) => (
          <div key={group ?? gi}>
            {/* Group header */}
            {group != null && (
              <div style={{
                padding: '6px 10px',
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: groupColors?.[group] || 'var(--text-dim)',
                letterSpacing: '0.06em',
                background: 'var(--bg-card)',
                borderBottom: '1px solid var(--border)',
              }}>
                {(groupLabels?.[group] || group).toUpperCase()}
              </div>
            )}

            {/* Data rows */}
            {groupRows.map((row, ri) => {
              const idx = globalIndex++
              const isLast = gi === groupedRows.length - 1 && ri === groupRows.length - 1
              return (
                <div
                  key={idx}
                  onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: compact ? 28 : rowHeight,
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    background: highlightRow?.(row, idx) ? 'var(--bg-raised)' : 'transparent',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = 'var(--bg-surface)' }}
                  onMouseLeave={e => { if (onRowClick) e.currentTarget.style.background = highlightRow?.(row, idx) ? 'var(--bg-raised)' : 'transparent' }}
                >
                  {columns.map((col, ci) => {
                    const value = row[col.key]
                    const colorValue = typeof col.color === 'function' ? col.color(value, row) : col.color
                    return (
                      <div key={col.key} style={{
                        width: col.width === 'flex' ? undefined : col.width,
                        flex: col.width === 'flex' ? 1 : undefined,
                        flexShrink: col.width === 'flex' ? 1 : 0,
                        fontSize: 11,
                        fontFamily: col.mono ? 'var(--font-mono)' : 'var(--font-display)',
                        fontWeight: col.bold ? 600 : 400,
                        color: colorValue || 'var(--text-secondary)',
                        paddingLeft: 10,
                        paddingRight: 6,
                        display: 'flex',
                        alignItems: 'center',
                        overflow: col.truncate !== false ? 'hidden' : 'visible',
                        textOverflow: col.truncate !== false ? 'ellipsis' : undefined,
                        whiteSpace: 'nowrap',
                        borderLeft: ci > 0 ? '1px solid var(--border)' : 'none',
                      }}>
                        {col.render ? col.render(value, row, idx) : (value ?? '—')}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
