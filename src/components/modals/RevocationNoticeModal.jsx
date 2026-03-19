import { Modal, ModalHeader, ModalBody, ModalFooter, Btn, CopyBadge } from './ModalShared.jsx'

export default function RevocationNoticeModal({ notification, onClose, _noBackdrop }) {
  const displayType = notification.disclosureType === 'proofonly' ? 'proof-only' : notification.disclosureType

  const content = (
    <Modal width={520}>
      <ModalHeader
        title="Disclosure Revoked"
        subtitle={`From ${notification.from.name} · ${notification.date}`}
        onClose={onClose}
      />
      <ModalBody>
        {/* Revocation notice */}
        <div style={{
          padding: '20px', borderRadius: 8, textAlign: 'center',
          background: 'color-mix(in srgb, var(--accent-red) 4%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-red) 15%, transparent)',
          marginBottom: 20,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
            border: '2px solid color-mix(in srgb, var(--accent-red) 30%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: 18, color: 'var(--accent-red)',
          }}>✕</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Access Revoked
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>{notification.from.name}</strong> has revoked
            your <strong style={{ color: 'var(--text-secondary)' }}>{displayType}</strong> disclosure
            to the following asset.
          </div>
        </div>

        {/* Asset details */}
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 8,
          border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {notification.asset.name}
            </span>
            {notification.asset.pin && (
              <CopyBadge value={notification.asset.pin} truncated />
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Owner: </span>
              <span style={{ color: 'var(--text-secondary)' }}>{notification.from.name}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Type: </span>
              <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {displayType?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Message from revoking party */}
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 8,
          border: '1px solid var(--border)', padding: '14px 16px',
        }}>
          <div style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 8,
          }}>
            MESSAGE FROM {notification.from.name.toUpperCase()}
          </div>
          <div style={{
            fontSize: 12, color: notification.message ? 'var(--text-secondary)' : 'var(--text-dim)',
            lineHeight: 1.7, fontStyle: 'italic',
          }}>
            {notification.message
              ? `"${notification.message}"`
              : '(No reason given)'
            }
          </div>
        </div>

        {/* What this means */}
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 8,
          background: 'var(--bg-card)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7,
        }}>
          This asset and its associated data have been removed from your network.
          Any evaluations previously run against this asset's data are no longer valid.
          You may re-request disclosure from the asset owner if needed.
        </div>
      </ModalBody>
      <ModalFooter>
        <div />
        <Btn label="Dismiss" accent onClick={onClose} />
      </ModalFooter>
    </Modal>
  )

  if (_noBackdrop) return content
  return content
}
