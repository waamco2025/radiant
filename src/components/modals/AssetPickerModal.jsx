// AssetPickerModal — Phase 17.2.1 origin, refactored in Phase 17.3.
//
// Asks the active actor to pick which of their owned Assets will anchor a
// disclosure + evaluation request against another party's Claim, per the
// architectural rule that EA+DA requests must originate from one of the
// requester's Assets so the parent canvas can lay out the request-node + edge.
//
// On Continue: fires onSubmit({ assetId, claimId }). V2App's handler resolves
// both ids against shared artifacts and opens the existing CombinedRequestModal
// pre-filled (requesterAsset = picked Asset, initialPin = target Claim PIN,
// initialRequirementsSetIds = optional, supplied by caller via context).
//
// Phase 17.3 — generalized prop contract. The modal now accepts a generic
// `targetClaim` (the Claim being targeted) + optional `context` object that
// drives the subtitle / context block copy. Previous solicitation-specific
// props (solicitation, solicitorClaim, rfp) are still accepted for the legacy
// RFP Accept flow (now defunct post-17.2.1.1 but the props remain for future
// re-use should the AssetPickerModal step return to the create-RFP flow).

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

export default function AssetPickerModal({
  // Phase 17.3: canonical prop set.
  targetClaim,          // resolved Claim object (the EA+DA request target)
  context,              // optional: { type: 'directory-claim' } | { type: 'rfp', rfp } | null
  // Legacy props from Phase 17.2.1 (preserved for compatibility — see header).
  solicitation,
  solicitorClaim,
  rfp,
  activeAssets = [],    // active actor's owned Assets
  // eslint-disable-next-line no-unused-vars
  activeParty,
  onSubmit,             // ({ assetId, claimId, solicitationId }) => void
  onCancel,
}) {
  const [selectedAssetId, setSelectedAssetId] = useState(null)

  // Resolve the target Claim from either the new `targetClaim` prop or the
  // legacy `solicitorClaim` fallback. `targetClaim` wins when both are set.
  const claim = targetClaim || solicitorClaim || null
  const hasAssets = activeAssets.length > 0
  const canContinue = hasAssets && !!selectedAssetId

  const handleContinue = () => {
    if (!canContinue) return
    onSubmit?.({
      assetId: selectedAssetId,
      claimId: claim?.id || null,
      // Legacy field — preserved so the previous RFP Accept handler shape
      // still resolves the solicitation id when invoked. Null when no
      // solicitation context (Phase 17.3 Directory-Claim entry).
      solicitationId: solicitation?.id || null,
    })
  }

  // Phase 17.3: context block + subtitle vary based on the entry path. The
  // Directory-Claim entry has no solicitor / RFP, so the block emphasizes
  // the Claim's owner instead.
  const ctxType = context?.type
    || (solicitation || rfp ? 'rfp' : null)
    || (claim ? 'directory-claim' : null)
  const claimName = claim?.name || solicitation?.claimId || ''
  const claimOwner = claim?.owner || ''
  const solicitorParty = solicitation?.solicitor || ''
  const rfpName = (context?.type === 'rfp' && context?.rfp?.name) || rfp?.name || ''

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
            {/* Context block. Variant per entry path:
                - 'rfp' (legacy RFP Accept flow): From: {solicitor} via RFP: {rfp.name}
                - 'directory-claim' (Phase 17.3 — Directory Claim CTA): Their
                  Claim + Owner. */}
            <div style={{
              padding: '12px 14px',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 30%, var(--border))',
              background: 'color-mix(in srgb, var(--accent-indigo) 6%, var(--bg-card))',
              borderRadius: 6,
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              {ctxType === 'rfp' ? (
                <>
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
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Their Claim: </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{claimName || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Owned by: </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{claimOwner || '—'}</span>
                  </div>
                </>
              )}
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
