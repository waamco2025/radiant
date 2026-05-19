// Phase 17.2.1 — AssetPickerModal.
//
// First step of the RFP-solicitation Accept flow. Bob (the RFP owner)
// has clicked "Request Agreement" on a pending solicitation from Alice;
// per the architectural rule that disclosure + evaluation requests must
// originate from one of the requester's Assets (so the parent canvas
// can lay out a request-node + edge), this modal asks Bob to pick which
// of his own Assets will anchor the mapping.
//
// On Continue: fires onSubmit({ assetId, solicitationId }). V2App's
// handler stashes the picked Asset into v22RequestAnchor and opens the
// existing CombinedRequestModal with the solicitor's Claim PIN +
// RFP-derived Requirements Sets pre-filled. The existing cold-path
// provisional EA+DA pipeline takes over from there.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

export default function AssetPickerModal({
  solicitation,         // RfpSolicitation
  solicitorClaim,       // resolved Claim object (the target of the EA+DA request)
  rfp,                  // resolved Rfp object (for the context block)
  activeAssets = [],    // active actor's owned Assets
  // eslint-disable-next-line no-unused-vars
  activeParty,          // active actor's party label (passed for symmetry; not rendered)
  onSubmit,             // ({ assetId, solicitationId }) => void
  onCancel,
}) {
  const [selectedAssetId, setSelectedAssetId] = useState(null)

  const hasAssets = activeAssets.length > 0
  const canContinue = hasAssets && !!selectedAssetId

  const handleContinue = () => {
    if (!canContinue) return
    onSubmit?.({
      assetId: selectedAssetId,
      solicitationId: solicitation?.id,
    })
  }

  const solicitorParty = solicitation?.solicitor || solicitorClaim?.owner || ''
  const claimName = solicitorClaim?.name || solicitation?.claimId || ''
  const rfpName = rfp?.name || ''

  return (
    <Backdrop onClose={onCancel}>
      <Modal width={620}>
        <ModalHeader
          title="Pick an Asset"
          subtitle={
            claimName
              ? `Pick the Asset that "${claimName}" will map to in your network.`
              : 'Pick the Asset that this Claim will map to in your network.'
          }
          onClose={onCancel}
        />
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Solicitation context block — anchors who/what the user is
                responding to so the picker decision is unambiguous. */}
            <div style={{
              padding: '12px 14px',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 30%, var(--border))',
              background: 'color-mix(in srgb, var(--accent-indigo) 6%, var(--bg-card))',
              borderRadius: 6,
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>From: </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{solicitorParty}</span>
                {rfpName && (
                  <>
                    <span style={{ color: 'var(--text-tertiary)' }}> via RFP: </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{rfpName}</span>
                  </>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Their Claim: </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{claimName}</span>
              </div>
            </div>

            {/* Asset picker */}
            <div>
              <FieldLabel label="Your Asset" required />
              {hasAssets ? (
                <div style={{
                  maxHeight: 320,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                }}>
                  {activeAssets.map((a) => {
                    const isSelected = selectedAssetId === a.id
                    const fileName = a.file?.filename || ''
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAssetId(a.id)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: isSelected
                            ? 'color-mix(in srgb, var(--accent-indigo) 12%, var(--bg-card))'
                            : 'transparent',
                          borderLeft: isSelected
                            ? '3px solid var(--accent-indigo)'
                            : '3px solid transparent',
                          transition: 'background 120ms',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--bg-raised)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 4,
                        }}>
                          <span style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: '1.5px solid ' + (isSelected ? 'var(--accent-indigo)' : 'var(--text-dim)'),
                            background: isSelected ? 'var(--accent-indigo)' : 'transparent',
                            boxShadow: isSelected ? 'inset 0 0 0 2.5px var(--bg-card)' : 'none',
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            flex: 1,
                            wordBreak: 'break-word',
                          }}>{a.name || a.id}</span>
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
                            flexShrink: 0,
                          }}>ASSET</span>
                        </div>
                        {fileName && (
                          <div style={{
                            fontSize: 11,
                            color: 'var(--text-dim)',
                            paddingLeft: 24,
                            fontFamily: 'var(--font-mono)',
                            wordBreak: 'break-all',
                          }}>{fileName}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  padding: '14px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-deep)',
                  fontSize: 13,
                  color: 'var(--text-dim)',
                  fontStyle: 'italic',
                }}>You have no Assets to map this Claim to. Create an Asset on your parent canvas first.</div>
              )}
              {hasAssets && !selectedAssetId && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--accent-amber)',
                  fontStyle: 'italic',
                  marginTop: 8,
                }}>Select at least one Asset to continue.</div>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn label="Cancel" onClick={onCancel} />
          <Btn
            label="Continue"
            accent
            disabled={!canContinue}
            onClick={handleContinue}
          />
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
