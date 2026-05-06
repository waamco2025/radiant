// RevokeBadgeModal — Phase 14.1 (#169 part 2).
//
// Single-step revocation flow. Required reason textarea; Confirm disabled
// until reason has content. Save callback shape:
// `onRevoke(badgeIssuanceId, reason)` — V2App marks the issuance revoked,
// stamps revokedDate + revocationReason, fires `v22-badge-revoked`
// notification.
//
// No unravel animation in scope (per design huddle decision 6) — chip
// simply re-renders without it.

import { useEffect, useState } from 'react'
import { Backdrop } from './ModalShared.jsx'
import BadgeShieldIcon from '../../v2/BadgeShieldIcon.jsx'

export default function RevokeBadgeModal({
  issuance,            // Badge Issuance artifact
  badgeTemplate,       // resolved template (for display)
  recipientParty,      // resolved recipient (for display)
  onRevoke,
  onClose,
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const canConfirm = reason.trim().length > 0

  const handleConfirm = () => {
    if (!canConfirm || !issuance?.id) return
    onRevoke?.(issuance.id, reason.trim())
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={{
        width: 560, background: 'var(--bg-surface)',
        borderRadius: 14, border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>Revoke Badge</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {badgeTemplate ? `${badgeTemplate.name} v${badgeTemplate.version || 1}` : (issuance?.id || 'Badge Issuance')}
              {recipientParty && (
                <>
                  {' · '}
                  <span style={{ color: 'var(--text-primary)' }}>recipient: {recipientParty}</span>
                </>
              )}
            </div>
          </div>
          <span
            onClick={onClose}
            style={{
              fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4,
            }}
          >×</span>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {badgeTemplate && (
            <div style={{
              padding: '12px 14px', background: 'var(--bg-deep)',
              border: '1px solid var(--border)', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
            }}>
              <BadgeShieldIcon size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {badgeTemplate.name}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>
                  v{badgeTemplate.version || 1} · by {badgeTemplate.ownerParty}
                </div>
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.03em' }}>
            REVOCATION REASON
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you revoking this Badge?"
            rows={5}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
              outline: 'none', resize: 'none',
            }}
          />
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
            This message will appear in the recipient&rsquo;s notification.
          </div>
        </div>

        <div style={{
          padding: '12px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
        }}>
          <span
            onClick={onClose}
            style={{
              fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
              cursor: 'pointer', padding: '8px 16px', borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          >Cancel</span>
          <span
            onClick={canConfirm ? handleConfirm : undefined}
            style={{
              fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: '#fff', padding: '8px 16px', borderRadius: 6,
              background: 'var(--accent-red)',
              cursor: canConfirm ? 'pointer' : 'default',
              opacity: canConfirm ? 1 : 0.35,
            }}
          >Revoke Badge</span>
        </div>
      </div>
    </Backdrop>
  )
}
