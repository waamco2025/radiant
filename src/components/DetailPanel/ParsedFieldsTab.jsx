import { FIELD_CATEGORIES } from '../../v2/pepTemplates.js'

function groupFieldsByCategory(fields) {
  const groups = {}
  fields.forEach(f => {
    if (!groups[f.category]) groups[f.category] = []
    groups[f.category].push(f)
  })
  return groups
}

export default function ParsedFieldsTab({ fields }) {
  if (!fields || fields.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
        No parsed fields available
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0' }}>
      {Object.entries(groupFieldsByCategory(fields)).map(([catKey, catFields]) => {
        const catConfig = FIELD_CATEGORIES[catKey] || { label: catKey, color: 'var(--text-secondary)' }
        return (
          <div key={catKey} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: catConfig.color, letterSpacing: '0.06em', marginBottom: 8,
            }}>
              {catConfig.label.toUpperCase()}
            </div>
            {catFields.map((f, i) => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center',
                padding: '7px 0',
                borderBottom: i < catFields.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ width: 140, flexShrink: 0, fontSize: 11, color: 'var(--text-dim)' }}>{f.name}</span>
                <span style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{f.value}</span>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  padding: '2px 6px', borderRadius: 4,
                  color: f.confidence === 'high' ? 'var(--accent-green)' : f.confidence === 'medium' ? 'var(--accent-amber)' : 'var(--accent-red)',
                  background: f.confidence === 'high'
                    ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                    : f.confidence === 'medium'
                      ? 'color-mix(in srgb, var(--accent-amber) 10%, transparent)'
                      : 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
                }}>
                  {f.confidence.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
