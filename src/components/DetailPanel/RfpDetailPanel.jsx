// Phase 17.0 — Read-only RFP Detail Panel.
//
// Mounted by V2App when `v22DirectorySelectedRfp` is non-null and the
// Directory layer is open. Mirrors the panel-shell visual treatment used
// by V22NodeDetailPanel (header pillbox + name + body + close button at
// top-right), without depending on its internals — RFPs are a distinct
// schema with no shared Claim/Asset/EvalResult fields.
//
// Phase 17.0 is read-only: no footer actions, no clickable RS chips, no
// post/respond/review flows. Those land in 17.1+.

const TYPE_BADGE_BG = 'var(--bg-raised)'

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
    const da = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return `${y}-${mo}-${da} · ${h}:${mi} UTC`
  } catch {
    return iso
  }
}

function StatusBadge({ status }) {
  // Phase 17.0: skeletal status taxonomy — `open` is the only value
  // seeded today. 17.1 introduces `closed`, `awarded`, etc. Render any
  // unknown status as the raw uppercased token so future values surface
  // without needing this component edited first.
  const label = String(status || 'open').toUpperCase()
  return (
    <span style={{
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'var(--accent-green)',
      padding: '2px 6px',
      borderRadius: 3,
      border: '1px solid color-mix(in srgb, var(--accent-green) 40%, var(--border))',
      background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-raised))',
    }}>{label}</span>
  )
}

function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      marginBottom: 8,
    }}>{children}</div>
  )
}

function RsChip({ name, version, raw }) {
  // raw = chip renders the rsId itself (RS not found in the lookup); use
  // muted treatment so the reader knows it's a fallback, not a canonical name.
  if (raw) {
    return (
      <span style={{
        display: 'inline-block',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-dim)',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '4px 8px',
        marginRight: 6,
        marginBottom: 6,
      }}>{raw}</span>
    )
  }
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      color: 'var(--text-primary)',
      background: 'color-mix(in srgb, var(--accent-indigo) 10%, var(--bg-raised))',
      border: '1px solid color-mix(in srgb, var(--accent-indigo) 40%, var(--border))',
      borderRadius: 4,
      padding: '4px 8px',
      marginRight: 6,
      marginBottom: 6,
    }}>{name}{version != null ? <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>v{version}</span> : null}</span>
  )
}

export default function RfpDetailPanel({ rfp, activeParty, requirementsSets = [], onClose }) {
  if (!rfp) return null

  // Phase 17.0: requirementsSets is the lookup array (id → {name, version}).
  // We accept any source — V2App passes `publishedRequirementSets` which
  // already covers the seeded RFP's two RSes (MIL-PRF-55681 v2 + System
  // Integration v1). When future RFPs reference RSes not in this catalog,
  // the chip falls back to the raw id under a muted treatment.
  const rsById = new Map()
  for (const rs of requirementsSets) {
    if (rs && rs.id) rsById.set(rs.id, rs)
  }

  const description = rfp.description || ''
  const reqIds = Array.isArray(rfp.requirementsSetIds) ? rfp.requirementsSetIds : []

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'var(--font-display)',
    }}>
      {/* Header — type pill + status badge + close button + name. */}
      <div style={{ padding: '18px 18px 14px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            padding: '2px 6px',
            background: TYPE_BADGE_BG,
            borderRadius: 3,
          }}>RFP</span>
          <StatusBadge status={rfp.status} />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 15,
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >✕</button>
        </div>
        <div style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 8,
          wordBreak: 'break-word',
        }}>{rfp.name || '(Unnamed RFP)'}</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {/* Posted by row */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>Posted by</SectionHeading>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--bg-deep)',
              textTransform: 'uppercase',
            }}>ACTOR</span>
            <span style={{
              fontSize: 13,
              color: 'var(--text-primary)',
            }}>{rfp.owner || '—'}</span>
            {activeParty && rfp.owner === activeParty && (
              <span style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
                padding: '2px 6px',
                borderRadius: 3,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
              }}>YOU</span>
            )}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>Description</SectionHeading>
          {description ? (
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}>{description}</div>
          ) : (
            <div style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              fontStyle: 'italic',
            }}>No description provided.</div>
          )}
        </div>

        {/* Required Standards (RS chips) */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>Required Standards</SectionHeading>
          {reqIds.length === 0 ? (
            <div style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              fontStyle: 'italic',
            }}>No standards listed.</div>
          ) : (
            <div>
              {reqIds.map((rsId) => {
                const rs = rsById.get(rsId)
                if (rs) return <RsChip key={rsId} name={rs.name || rsId} version={rs.version} />
                return <RsChip key={rsId} raw={rsId} />
              })}
            </div>
          )}
        </div>

        {/* Posted date */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>Posted</SectionHeading>
          <div style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
          }}>{formatDateTime(rfp.createdDate)}</div>
        </div>
      </div>
    </div>
  )
}
