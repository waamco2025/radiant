import DataTable from './shared/DataTable'
import { FIELD_CATEGORIES } from '../../v2/pepTemplates.js'

export default function ParsedFieldsTab({ fields, isSelective }) {
  if (!fields || fields.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
        No parsed fields available
      </div>
    )
  }

  const groupColors = {}
  const groupLabels = {}
  Object.entries(FIELD_CATEGORIES).forEach(([key, cfg]) => {
    groupColors[key] = cfg.color
    groupLabels[key] = cfg.label
  })

  const columns = [
    { key: 'name', header: 'Field', width: 150, bold: true, color: 'var(--text-secondary)' },
    { key: 'value', header: 'Value', width: 'flex', mono: true },
    {
      key: 'confidence', header: 'Conf.', width: 70, mono: true,
      render: (value) => {
        const color = value === 'high' ? 'var(--accent-green)'
          : value === 'medium' ? 'var(--accent-amber)'
          : 'var(--accent-red)'
        return (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
            padding: '2px 6px', borderRadius: 4,
            color,
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
          }}>
            {value?.toUpperCase()}
          </span>
        )
      },
    },
  ]

  return (
    <div style={{ padding: '12px 0' }}>
      {isSelective && (
        <div style={{
          padding: '10px 14px', marginBottom: 14, borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
          fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--accent-amber)' }}>Selective disclosure</strong> — additional fields may exist that are not included in this disclosure.
        </div>
      )}
      <DataTable
        columns={columns}
        rows={fields}
        groupBy="category"
        groupColors={groupColors}
        groupLabels={groupLabels}
        maxRows={12}
        compact
      />
    </div>
  )
}
