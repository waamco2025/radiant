// Phase 17.2 — Renders a single RFP Solicitation inside RfpDetailPanel.
//
// Two viewer modes:
//   • viewerRole = 'owner'      → RFP buyer looking at incoming solicitations.
//                                  Pending: Request Agreement + Reject buttons.
//                                  Accepted (17.2.1): green badge, "see EA on
//                                  parent canvas" text, no actions.
//                                  Rejected: red badge, reply, no actions.
//   • viewerRole = 'solicitor'  → Seller looking at their own outgoing
//                                  solicitation. No action bar — status display
//                                  only. Accepted-state surfaces the EA pointer.
//
// Status taxonomy: 'pending' | 'rejected' | 'accepted'.
//
// Date formatting matches RfpDetailPanel.jsx — `YYYY-MM-DD · HH:MM UTC`.

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
  const value = String(status || 'pending').toLowerCase()
  const label = value.toUpperCase()
  if (value === 'rejected') {
    return (
      <span style={{
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--accent-red)',
        padding: '2px 6px',
        borderRadius: 3,
        border: '1px solid color-mix(in srgb, var(--accent-red) 40%, var(--border))',
        background: 'color-mix(in srgb, var(--accent-red) 12%, var(--bg-raised))',
      }}>{label}</span>
    )
  }
  if (value === 'accepted') {
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
  // pending — neutral indigo
  return (
    <span style={{
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'var(--accent-indigo)',
      padding: '2px 6px',
      borderRadius: 3,
      border: '1px solid color-mix(in srgb, var(--accent-indigo) 40%, var(--border))',
      background: 'color-mix(in srgb, var(--accent-indigo) 12%, var(--bg-raised))',
    }}>{label}</span>
  )
}

function ActorPill({ party }) {
  return (
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
  )
}

function MessageBlock({ label, text }) {
  if (!text) return null
  return (
    <div style={{
      marginTop: 10,
      padding: '8px 10px',
      background: 'var(--bg-deep)',
      borderLeft: '2px solid color-mix(in srgb, var(--accent-indigo) 60%, var(--border))',
      borderRadius: 3,
    }}>
      <div style={{
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>"{text}"</div>
    </div>
  )
}

// Action button — affirm = filled indigo; neutral = outline; danger reuses
// neutral styling for visual quietness (Reject is not destructive — the
// solicitor can resubmit a new solicitation in a future phase).
function CardActionBtn({ label, onClick, variant = 'neutral', disabled, tooltip }) {
  const isAffirm = variant === 'affirm'
  const base = (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={tooltip || undefined}
      style={{
        flex: 1,
        padding: '8px 12px',
        background: isAffirm
          ? (disabled ? 'var(--bg-raised)' : 'var(--accent-indigo)')
          : 'var(--bg-raised)',
        border: '1px solid ' + (isAffirm && !disabled ? 'var(--accent-indigo)' : 'var(--border)'),
        borderRadius: 4,
        color: isAffirm && !disabled
          ? 'var(--bg-deep)'
          : (disabled ? 'var(--text-dim)' : 'var(--text-primary)'),
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >{label}</button>
  )
  return base
}

export default function SolicitationCard({
  solicitation,
  claim,
  viewerRole,            // 'owner' | 'solicitor'
  onReject,              // owner-only: (solicitation) => void
  onRequestAgreement,    // owner-only: (solicitation) => void  (Phase 17.2.1)
}) {
  if (!solicitation) return null

  const status = solicitation.status || 'pending'
  const isPending = status === 'pending'
  const isRejected = status === 'rejected'
  const isAccepted = status === 'accepted'

  const claimName = claim?.name || solicitation.claimId
  const claimOwner = claim?.owner || solicitation.solicitor

  return (
    <div style={{
      padding: 12,
      border: '1px solid var(--border)',
      borderRadius: 4,
      background: 'var(--bg-card)',
      marginBottom: 10,
    }}>
      {/* Header row — solicitor party + status badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}>
        <ActorPill party={solicitation.solicitor} />
        <span style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          fontWeight: 600,
        }}>{solicitation.solicitor}</span>
        <span style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}>solicited</span>
        <div style={{ flex: 1 }} />
        <StatusBadge status={status} />
      </div>

      {/* Referenced Claim row */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        marginBottom: 6,
        wordBreak: 'break-word',
      }}>
        <span style={{ color: 'var(--text-tertiary)' }}>Re: </span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{claimName}</span>
        <span style={{ color: 'var(--text-tertiary)' }}> from </span>
        <span style={{ color: 'var(--text-primary)' }}>{claimOwner}</span>
      </div>

      {/* Solicitor's message (if any) */}
      <MessageBlock label="Seller's message" text={solicitation.message} />

      {/* Buyer's rejection reply (solicitor view, rejected status, message present) */}
      {isRejected && (
        <MessageBlock label="Buyer's reply" text={solicitation.rejectionMessage} />
      )}

      {/* Dates */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        marginTop: 10,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
      }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Solicited </span>
          <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(solicitation.createdDate)}</span>
        </div>
        {isRejected && solicitation.respondedDate && (
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Rejected </span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(solicitation.respondedDate)}</span>
          </div>
        )}
        {isAccepted && solicitation.respondedDate && (
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Agreement requested </span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(solicitation.respondedDate)}</span>
          </div>
        )}
      </div>

      {/* Phase 17.2.1: accepted-state pointer. The provisional EA+DA now
          lives on the requester's parent canvas; both viewer roles get a
          line pointing them there. No action buttons — the EA is the
          live artifact and is managed via the parent canvas. */}
      {isAccepted && (
        <div style={{
          marginTop: 10,
          padding: '8px 10px',
          background: 'color-mix(in srgb, var(--accent-green) 8%, var(--bg-deep))',
          borderLeft: '2px solid color-mix(in srgb, var(--accent-green) 60%, var(--border))',
          borderRadius: 3,
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          {viewerRole === 'solicitor'
            ? 'Accepted — see your new Evaluation Agreement on the parent canvas.'
            : 'Agreement requested — see the provisional EA on the parent canvas.'}
        </div>
      )}

      {/* Action bar — owner-only on pending status. Phase 17.2.1: the
          Request Agreement button is enabled; click fires the
          onRequestAgreement prop, V2App opens AssetPickerModal. */}
      {viewerRole === 'owner' && isPending && (
        <div style={{
          display: 'flex',
          gap: 6,
          marginTop: 12,
        }}>
          <CardActionBtn
            label="Request Agreement"
            variant="affirm"
            onClick={() => onRequestAgreement?.(solicitation)}
          />
          <CardActionBtn
            label="Reject"
            variant="neutral"
            onClick={() => onReject?.(solicitation)}
          />
        </div>
      )}
    </div>
  )
}
