// AmendDisclosureModal — Phase 6 / spec §11.2.
// Alice adjusts the scope of a Disclosure Agreement she granted. Behaviour
// branches on the DA type:
//   • full       → toggle which referenced Assets are in scope (assetIds)
//   • selective  → toggle parsed fields in scope (fieldIds)
//   • proofonly  → toggle Eval Result ids in scope (evaluationResultIds)
//
// Per spec §11.2 enforcement: if an evaluation has been run against an asset /
// field / eval result currently in scope, that item cannot be removed. The
// caller passes `lockedAssetIds` / `lockedFieldIds` / `lockedEvalResultIds` —
// items with locked === true are pre-checked and disabled.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

function ToggleRow({ id, label, sublabel, selected, locked, onToggle, color }) {
  const cursor = locked ? 'not-allowed' : 'pointer'
  return (
    <div
      onClick={locked ? undefined : () => onToggle(id)}
      title={locked ? 'Cannot remove — an evaluation has already been run against this item.' : undefined}
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
}

export default function AmendDisclosureModal({
  agreement,                  // the DA being amended
  candidateAssets = [],       // [{ id, name, file: { filename } }] — for type=full
  candidateFields = [],       // [{ key, label, parseTemplateName }] — for type=selective; key = `${parseId}::${fieldId}`
  candidateEvalResults = [],  // [{ id, name }] — for type=proofonly
  lockedAssetIds = [],
  lockedFieldIds = [],
  lockedEvalResultIds = [],
  onSubmit,                   // ({ scope, note }) => void
  onClose,
}) {
  const initialAssetIds = new Set([...(agreement.scope?.assetIds || []), ...lockedAssetIds])
  const initialFieldIds = new Set([...(agreement.scope?.fieldIds || []), ...lockedFieldIds])
  const initialEvalIds  = new Set([...(agreement.scope?.evaluationResultIds || []), ...lockedEvalResultIds])

  const [selectedAssetIds, setSelectedAssetIds] = useState(Array.from(initialAssetIds))
  const [selectedFieldIds, setSelectedFieldIds] = useState(Array.from(initialFieldIds))
  const [selectedEvalIds, setSelectedEvalIds] = useState(Array.from(initialEvalIds))
  const [note, setNote] = useState('')

  const lockedAssetSet = new Set(lockedAssetIds)
  const lockedFieldSet = new Set(lockedFieldIds)
  const lockedEvalSet = new Set(lockedEvalResultIds)

  const toggle = (arr, setArr, id, lockedSet) => {
    if (lockedSet.has(id)) return
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  // Phase 6.5+ #7: only allow submission when the active scope dimension's
  // selection differs (set comparison, order-independent) from the original
  // agreement.scope. No-op amendments are blocked.
  const setsEqual = (a, b) => {
    if (a.length !== b.length) return false
    const A = new Set(a)
    for (const x of b) if (!A.has(x)) return false
    return true
  }
  const baselineAssetIds = agreement.scope?.assetIds || []
  const baselineFieldIds = agreement.scope?.fieldIds || []
  const baselineEvalIds = agreement.scope?.evaluationResultIds || []
  const hasChanges =
    (agreement.type === 'full' && !setsEqual(selectedAssetIds, baselineAssetIds)) ||
    (agreement.type === 'selective' && !setsEqual(selectedFieldIds, baselineFieldIds)) ||
    (agreement.type === 'proofonly' && !setsEqual(selectedEvalIds, baselineEvalIds))

  const handleSubmit = () => {
    let scope
    if (agreement.type === 'full') {
      scope = {
        assetIds: [...selectedAssetIds],
        fieldIds: agreement.scope?.fieldIds || null,
        evaluationResultIds: agreement.scope?.evaluationResultIds || null,
        includeDerivatives: agreement.scope?.includeDerivatives ?? true,
      }
    } else if (agreement.type === 'selective') {
      scope = {
        assetIds: agreement.scope?.assetIds || null,
        fieldIds: [...selectedFieldIds],
        evaluationResultIds: null,
        includeDerivatives: false,
      }
    } else if (agreement.type === 'proofonly') {
      scope = {
        assetIds: null,
        fieldIds: null,
        evaluationResultIds: [...selectedEvalIds],
        includeDerivatives: false,
      }
    } else {
      onClose?.()
      return
    }
    onSubmit?.({ scope, note: note.trim() })
  }

  const accentColor = agreement.type === 'full'
    ? 'var(--accent-indigo)'
    : agreement.type === 'selective'
      ? 'var(--accent-amber)'
      : 'var(--accent-green)'

  return (
    <Backdrop onClose={onClose}>
      <Modal width={680}>
        <ModalHeader
          title="Amend Disclosure"
          subtitle={`${agreement.type === 'full' ? 'Full' : agreement.type === 'selective' ? 'Selective' : 'Proof-Only'} Disclosure to ${agreement.grantee.party}. Items already evaluated are locked and cannot be removed from scope.`}
          onClose={onClose}
        />
        <ModalBody>
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
              <FieldLabel label={`Eval Results in scope (${candidateEvalResults.length})`} required />
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
                {candidateEvalResults.map((er) => (
                  <ToggleRow
                    key={er.id} id={er.id} label={er.name}
                    sublabel={er.id}
                    selected={selectedEvalIds.includes(er.id)}
                    locked={lockedEvalSet.has(er.id)}
                    onToggle={(id) => toggle(selectedEvalIds, setSelectedEvalIds, id, lockedEvalSet)}
                    color={accentColor}
                  />
                ))}
              </div>
            </>
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
            {agreement.type === 'full' && `${selectedAssetIds.length} Asset${selectedAssetIds.length !== 1 ? 's' : ''} in scope`}
            {agreement.type === 'selective' && `${selectedFieldIds.length} field${selectedFieldIds.length !== 1 ? 's' : ''} in scope`}
            {agreement.type === 'proofonly' && `${selectedEvalIds.length} Eval Result${selectedEvalIds.length !== 1 ? 's' : ''} in scope`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Amend Disclosure" accent disabled={!hasChanges} onClick={handleSubmit} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
