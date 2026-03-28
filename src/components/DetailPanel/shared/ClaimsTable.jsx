import { Tip } from './Tooltip'

export default function ClaimsTable({ claims, maxHeight = 320, proofOnly = false }) {
  if (!claims || claims.length === 0) return null

  return (
    <div style={{ maxHeight, overflowY: 'auto' }}>
      {claims.map((claim, i) => {
        // Status
        const isGood = claim.status === 'satisfactory' || claim.status === 'verified'
        const isBad = claim.status === 'unsatisfactory' || claim.status === 'failed' || claim.status === 'contested'
        const isMissing = claim.status === 'missing'
        const statusColor = isGood ? 'var(--accent-green)' : isBad ? 'var(--accent-red)' : 'var(--text-dim)'
        const statusLabel = isGood ? 'SAT' : isBad ? 'UNSAT' : isMissing ? 'MISS' : '—'
        const statusFull = isGood ? 'Satisfactory' : isBad ? 'Unsatisfactory' : isMissing ? 'Missing' : '—'

        // Confidence
        const conf = claim.aiConfidence != null ? Math.round(claim.aiConfidence * 100) : null
        const confColor = conf != null
          ? (conf >= 90 ? 'var(--accent-green)' : conf >= 80 ? 'var(--accent-amber)' : 'var(--accent-red)')
          : 'var(--text-dim)'

        // Type
        const isExt = claim.type === 'extraction'

        return (
          <div key={claim.requirementId || i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '7px 0',
            borderBottom: i < claims.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {/* INF/EXT badge — hidden in proofOnly */}
            {!proofOnly && (
              <Tip text={isExt ? 'Extraction — AI finds a specific value' : 'Inference — AI determines if a condition holds'}>
                <span style={{
                  fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '2px 6px', borderRadius: 3, flexShrink: 0, marginTop: 2,
                  color: isExt ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                  background: isExt
                    ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)'
                    : 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                  cursor: 'default',
                }}>
                  {isExt ? 'EXT' : 'INF'}
                </span>
              </Tip>
            )}

            {/* Label + description + value */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                {claim.label || claim.requirement}
              </div>
              {claim.description && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4, marginTop: 1 }}>
                  {claim.description}
                </div>
              )}
              {!proofOnly && (claim.humanValue || claim.aiValue || claim.output) && (
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                  marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {claim.humanValue || claim.aiValue || claim.output}
                </div>
              )}
            </div>

            {/* Conf% badge + SAT/UNSAT badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
              {!proofOnly && conf != null && (
                <Tip text={`AI confidence: ${conf}%`}>
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    padding: '2px 5px', borderRadius: 3,
                    color: confColor,
                    background: `color-mix(in srgb, ${confColor} 10%, transparent)`,
                    cursor: 'default',
                  }}>
                    {conf}%
                  </span>
                </Tip>
              )}
              <Tip text={statusFull}>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 4,
                  color: statusColor,
                  background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
                  cursor: 'default',
                }}>
                  {statusLabel}
                </span>
              </Tip>
            </div>
          </div>
        )
      })}
    </div>
  )
}
