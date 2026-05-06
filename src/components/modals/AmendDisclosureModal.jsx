// AmendDisclosureModal — Phase 6 / spec §11.2.
// Alice adjusts the scope of a Disclosure Agreement she granted. Behaviour
// branches on the DA type:
//   • full       → toggle which referenced Assets are in scope (assetIds)
//   • selective  → toggle parsed fields in scope (fieldIds)
//   • proofonly  → toggle PoE ids in scope (poeIds — Phase 13 #168 migration
//                  from per-Eval-Result picker; PoEs wrap Eval Results and
//                  share-PoE-shares-all auto-discloses every wrapped result)
//
// Per spec §11.2 enforcement: if an evaluation has been run against an asset /
// field / PoE currently in scope, that item cannot be removed. The caller
// passes `lockedAssetIds` / `lockedFieldIds` / `lockedPoeIds` — items with
// locked === true are pre-checked and disabled.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, ExpiryPicker,
} from './ModalShared'
import Tooltip from '../Tooltip'

// Phase 11E.1.6 Fix 3: shared "Never expires" / YYYY-MM-DD formatter for
// the footer summary line. Mirrors AmendEvaluationAgreementModal's helper.
function formatDateOnly(iso) {
  if (!iso) return 'Never expires'
  return iso.slice(0, 10)
}

function ToggleRow({ id, label, sublabel, selected, locked, onToggle, color }) {
  const cursor = locked ? 'not-allowed' : 'pointer'
  const row = (
    <div
      onClick={locked ? undefined : () => onToggle(id)}
      style={{
        padding: '10px 14px', cursor,
        background: selected ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent',
        borderBottom: '1px solid var(--border-faint)',
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: locked ? 0.85 : 1,
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: 3,
        border: `1.5px solid ${selected ? color : 'var(--border-hover)'}`,
        background: selected ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{sublabel}</div>}
      </div>
      {locked && (
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
          color: 'var(--accent-amber)',
          background: 'color-mix(in srgb, var(--accent-amber) 16%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)',
          flexShrink: 0,
          marginLeft: 'auto',
        }}>EVALUATED</span>
      )}
    </div>
  )
  return locked
    ? <Tooltip content="Cannot remove — an evaluation has already been run against this item." width={280} wrapperStyle={{ display: 'block' }}>{row}</Tooltip>
    : row
}

export default function AmendDisclosureModal({
  agreement,                  // the DA being amended
  // Phase 11E.1.6 Fix 4: claim is now passed through so the subtitle can
  // weave the Claim's display name into the prose. The agreement's
  // subject.id is opaque without a claim lookup; rendering the id as a
  // bolded token would read worse than the existing "to {grantee}" copy.
  claim,
  candidateAssets = [],       // [{ id, name, file: { filename } }] — for type=full
  candidateFields = [],       // [{ key, label, parseTemplateName }] — for type=selective; key = `${parseId}::${fieldId}`
  candidatePoEs = [],         // [{ id, name }] — for type=proofonly (Phase 13 #168)
  lockedAssetIds = [],
  lockedFieldIds = [],
  lockedPoeIds = [],
  onSubmit,                   // ({ scope, terms, note }) => void
  onClose,
}) {
  const initialAssetIds = new Set([...(agreement.scope?.assetIds || []), ...lockedAssetIds])
  const initialFieldIds = new Set([...(agreement.scope?.fieldIds || []), ...lockedFieldIds])
  const initialPoeIds   = new Set([...(agreement.scope?.poeIds || []), ...lockedPoeIds])

  const [selectedAssetIds, setSelectedAssetIds] = useState(Array.from(initialAssetIds))
  const [selectedFieldIds, setSelectedFieldIds] = useState(Array.from(initialFieldIds))
  const [selectedPoeIds, setSelectedPoeIds] = useState(Array.from(initialPoeIds))
  const [note, setNote] = useState('')

  // Phase 11E.1.6 Fix 3: expiration state. Pre-fill picker to 'custom'
  // with the existing expires when present; 'none' (Never expires) when
  // the DA has no expiration. Same pattern as AmendEvaluationAgreementModal.
  const initialExpires = agreement.terms?.expires ?? null
  const [expiry, setExpiry] = useState(initialExpires ? 'custom' : 'none')
  const [customExpiry, setCustomExpiry] = useState(
    initialExpires ? initialExpires.slice(0, 10) : '',
  )

  const lockedAssetSet = new Set(lockedAssetIds)
  const lockedFieldSet = new Set(lockedFieldIds)
  const lockedPoeSet = new Set(lockedPoeIds)

  const toggle = (arr, setArr, id, lockedSet) => {
    if (lockedSet.has(id)) return
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  // Phase 6.5+ #7: only allow submission when the active scope dimension's
  // selection differs (set comparison, order-independent) from the original
  // agreement.scope. No-op amendments are blocked.
  // Phase 11E.1.6 Fix 3: also allow submission when expiration changed,
  // even with scope unchanged.
  const setsEqual = (a, b) => {
    if (a.length !== b.length) return false
    const A = new Set(a)
    for (const x of b) if (!A.has(x)) return false
    return true
  }
  const baselineAssetIds = agreement.scope?.assetIds || []
  const baselineFieldIds = agreement.scope?.fieldIds || []
  const baselinePoeIds = agreement.scope?.poeIds || []
  const scopeChanged =
    (agreement.type === 'full' && !setsEqual(selectedAssetIds, baselineAssetIds)) ||
    (agreement.type === 'selective' && !setsEqual(selectedFieldIds, baselineFieldIds)) ||
    (agreement.type === 'proofonly' && !setsEqual(selectedPoeIds, baselinePoeIds))

  // Phase 11E.1.6 Fix 3: compute the would-be next expires (null for
  // 'none', ISO for '1-year' / '2-year', custom date for 'custom').
  // Mirrors CombinedResponseModal's `isoFromPicker` so the two flows stay
  // consistent.
  const computeNextExpiresIso = () => {
    const now = new Date()
    switch (expiry) {
      case '1-year': now.setUTCFullYear(now.getUTCFullYear() + 1); return now.toISOString()
      case '2-year': now.setUTCFullYear(now.getUTCFullYear() + 2); return now.toISOString()
      case 'custom': return customExpiry ? new Date(customExpiry).toISOString() : null
      case 'none':   return null
      default:       return initialExpires
    }
  }
  const nextExpiresIso = computeNextExpiresIso()
  // Compare at YYYY-MM-DD precision — the picker can only express day
  // resolution via the date input, while the original ISO may carry a
  // time component (e.g. '2027-03-04T16:42:00Z' vs.
  // '2027-03-04T00:00:00Z'). Same normalization Phase 11E.1.1 Fix 1
  // applied to AmendEvaluationAgreementModal.
  const toDateOnly = (iso) => (iso ? iso.slice(0, 10) : null)
  const expiryChanged = toDateOnly(initialExpires) !== toDateOnly(nextExpiresIso)
  const hasChanges = scopeChanged || expiryChanged

  // Phase 11E.1.7 Fix 4: Submit is gated on a non-empty scope for the
  // active type. Pre-fix the user could uncheck the lone Asset (or last
  // field / eval result), trip `hasChanges`, and submit a DA whose scope
  // had nothing in it. Spec §11.2 implies non-empty scope (a DA with no
  // disclosed items isn't a meaningful agreement). The empty-state
  // amber italic message renders only when the user has interacted to
  // reach zero — not on initial open of an already-empty DA (which
  // shouldn't be possible per spec, but the timing rule is the same
  // either way: only show after deselection brings the count to 0,
  // which is detectable via baseline > 0 && current === 0).
  const scopeIsEmpty =
    (agreement.type === 'full' && selectedAssetIds.length === 0) ||
    (agreement.type === 'selective' && selectedFieldIds.length === 0) ||
    (agreement.type === 'proofonly' && selectedPoeIds.length === 0)
  const baselineWasNonEmpty =
    (agreement.type === 'full' && baselineAssetIds.length > 0) ||
    (agreement.type === 'selective' && baselineFieldIds.length > 0) ||
    (agreement.type === 'proofonly' && baselinePoeIds.length > 0)
  const showEmptyScopeWarning = scopeIsEmpty && baselineWasNonEmpty
  const canSubmit = hasChanges && !scopeIsEmpty
  const emptyScopeMessage = agreement.type === 'full'
    ? 'At least one Asset must be in scope.'
    : agreement.type === 'selective'
      ? 'At least one field must be in scope.'
      : 'At least one Proof of Evaluation must be in scope.'

  const handleSubmit = () => {
    let scope
    if (agreement.type === 'full') {
      scope = {
        assetIds: [...selectedAssetIds],
        fieldIds: agreement.scope?.fieldIds || null,
        poeIds: agreement.scope?.poeIds || null,
        includeDerivatives: agreement.scope?.includeDerivatives ?? true,
      }
    } else if (agreement.type === 'selective') {
      scope = {
        assetIds: agreement.scope?.assetIds || null,
        fieldIds: [...selectedFieldIds],
        poeIds: null,
        includeDerivatives: false,
      }
    } else if (agreement.type === 'proofonly') {
      scope = {
        assetIds: null,
        fieldIds: null,
        poeIds: [...selectedPoeIds],
        includeDerivatives: false,
      }
    } else {
      onClose?.()
      return
    }
    onSubmit?.({ scope, terms: { expires: nextExpiresIso }, note: note.trim() })
  }

  const accentColor = agreement.type === 'full'
    ? 'var(--accent-indigo)'
    : agreement.type === 'selective'
      ? 'var(--accent-amber)'
      : 'var(--accent-green)'

  // Phase 11E.1.6 Fix 4: parallel structure to AmendEvaluationAgreementModal's
  // header (Phase 11E.1.1 Fix 5). Title spells out the full artifact name;
  // subtitle weaves grantee + Claim name into the prose with <strong>.
  // Falls back gracefully when claim isn't passed (legacy callers).
  const claimName = claim?.name || agreement.subject?.id
  return (
    <Backdrop onClose={onClose}>
      <Modal width={680}>
        <ModalHeader
          title="Amend Disclosure Agreement"
          subtitle={(
            <>
              Update the expiration date and scope for the Disclosure
              Agreement with <strong>{agreement.grantee.party}</strong> on
              Claim <strong>{claimName}</strong>. Changes are unilateral —
              {' '}{agreement.grantee.party} will be notified and may
              revoke if they don't accept the new terms. Items already
              evaluated are locked and cannot be removed from scope.
            </>
          )}
          onClose={onClose}
        />
        <ModalBody>
          {/* Phase 11E.1.6 Fix 3: Expiration section. Mirrors
              AmendEvaluationAgreementModal's structure. Pre-fills picker
              to the current expires (or 'none' if Never expires). */}
          <FieldLabel label="Expiration" />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
            Current: {formatDateOnly(initialExpires)}
          </div>
          <ExpiryPicker
            expiry={expiry}
            setExpiry={setExpiry}
            customDate={customExpiry}
            setCustomDate={setCustomExpiry}
          />

          {agreement.type === 'full' && (
            <>
              <FieldLabel label={`Assets in scope (${candidateAssets.length})`} required />
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
                {candidateAssets.map((a) => (
                  <ToggleRow
                    key={a.id} id={a.id} label={a.name}
                    sublabel={a.file?.filename || a.id}
                    selected={selectedAssetIds.includes(a.id)}
                    locked={lockedAssetSet.has(a.id)}
                    onToggle={(id) => toggle(selectedAssetIds, setSelectedAssetIds, id, lockedAssetSet)}
                    color={accentColor}
                  />
                ))}
              </div>
            </>
          )}
          {agreement.type === 'selective' && (
            <>
              <FieldLabel label={`Parsed fields in scope (${candidateFields.length})`} required />
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
                {candidateFields.map((f) => (
                  <ToggleRow
                    key={f.key} id={f.key} label={f.label}
                    sublabel={f.parseTemplateName}
                    selected={selectedFieldIds.includes(f.key)}
                    locked={lockedFieldSet.has(f.key)}
                    onToggle={(id) => toggle(selectedFieldIds, setSelectedFieldIds, id, lockedFieldSet)}
                    color={accentColor}
                  />
                ))}
              </div>
            </>
          )}
          {agreement.type === 'proofonly' && (
            <>
              <FieldLabel label={`Proofs of Evaluation in scope (${candidatePoEs.length})`} required />
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
                {candidatePoEs.map((poe) => (
                  <ToggleRow
                    key={poe.id} id={poe.id} label={poe.name}
                    sublabel={poe.id}
                    selected={selectedPoeIds.includes(poe.id)}
                    locked={lockedPoeSet.has(poe.id)}
                    onToggle={(id) => toggle(selectedPoeIds, setSelectedPoeIds, id, lockedPoeSet)}
                    color={accentColor}
                  />
                ))}
              </div>
            </>
          )}
          {/* Phase 11E.1.7 Fix 4: amber italic inline empty-state message
              (CLAUDE.md UX pattern). Only renders after the user has
              deselected to zero — initial open with non-empty baseline
              suppresses the message until interaction. */}
          {showEmptyScopeWarning && (
            <div style={{
              marginTop: -8, marginBottom: 16, fontSize: 11,
              color: 'var(--accent-amber)', fontStyle: 'italic',
            }}>
              {emptyScopeMessage}
            </div>
          )}
          <FieldLabel label="Amendment note (optional)" />
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Briefly describe what's changing and why…"
            style={{
              width: '100%', padding: '10px 12px',
              fontSize: 12, fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, boxSizing: 'border-box', outline: 'none', resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
        </ModalBody>
        <ModalFooter>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {/* Phase 11E.1.6 Fix 3: surface expiration delta + scope
                summary together. Mirrors AmendEvaluationAgreementModal's
                footer copy ("Expiration: <before> → <after> · …"). */}
            {(() => {
              const parts = []
              if (expiryChanged) {
                parts.push(`Expiration: ${formatDateOnly(initialExpires)} → ${formatDateOnly(nextExpiresIso)}`)
              }
              if (agreement.type === 'full') {
                parts.push(`${selectedAssetIds.length} Asset${selectedAssetIds.length !== 1 ? 's' : ''} in scope`)
              } else if (agreement.type === 'selective') {
                parts.push(`${selectedFieldIds.length} field${selectedFieldIds.length !== 1 ? 's' : ''} in scope`)
              } else if (agreement.type === 'proofonly') {
                parts.push(`${selectedPoeIds.length} Proof${selectedPoeIds.length !== 1 ? 's' : ''} of Evaluation in scope`)
              }
              return parts.join(' · ')
            })()}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Amend Disclosure Agreement" accent disabled={!canSubmit} onClick={handleSubmit} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
