// AmendClaimModal — Phase 6 / spec §11.1.
// Alice adds Asset references to one of her existing Claims. The Claim's
// referencedAssetIds is widened with the picked Asset ids; an entry is appended
// to the Claim's amendments[]. Existing Disclosure Agreements are NOT
// automatically widened — Alice must explicitly amend each agreement she wants
// to share the new evidence with (spec §11.1 step 5).

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

export default function AmendClaimModal({
  claim,                      // { id, name, description, referencedAssetIds }
  candidateAssets = [],       // [{ id, name, file: { filename } }] — Assets owned by the active actor that aren't already referenced
  alreadyReferencedAssets = [], // [{ id, name, file: { filename } }] — for the read-only "already referenced" panel
  onSubmit,                   // ({ addedAssetIds }) => void
  onClose,
}) {
  const [selected, setSelected] = useState([])
  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const canSubmit = selected.length > 0

  return (
    <Backdrop onClose={onClose}>
      <Modal width={620}>
        <ModalHeader
          title="Amend Claim"
          subtitle={`Add Assets you own to ${claim?.name || 'this Claim'}'s referenced Assets. Existing Disclosure Agreements are not automatically widened.`}
          onClose={onClose}
        />
        <ModalBody>
          {/* Phase 6.5 #9: read-only Asset cards (matched style with the
              selectable list below) instead of a code-reference text box. */}
          <FieldLabel label={`Already referenced (${alreadyReferencedAssets.length})`} />
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
            {alreadyReferencedAssets.length === 0 ? (
              <div style={{ padding: 14, fontSize: 11, color: 'var(--text-dim)' }}>
                No Assets currently referenced.
              </div>
            ) : alreadyReferencedAssets.map((a) => (
              <div
                key={a.id}
                title="Already referenced — cannot deselect (Asset removal is not supported in V2.2)."
                style={{
                  padding: '10px 14px',
                  background: 'color-mix(in srgb, var(--text-dim) 5%, transparent)',
                  borderBottom: '1px solid var(--border-faint)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'not-allowed',
                  opacity: 0.85,
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: '1.5px solid var(--text-dim)',
                  background: 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{a.file?.filename || a.id}</div>
                </div>
              </div>
            ))}
          </div>
          <FieldLabel label={`Add Assets (${candidateAssets.length} available)`} required />
          {candidateAssets.length === 0 ? (
            <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              You don't own any Assets that aren't already referenced by this Claim. Register a new Asset first.
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {candidateAssets.map((a) => {
                const sel = selected.includes(a.id)
                return (
                  <div
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      background: sel ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'transparent',
                      borderBottom: '1px solid var(--border-faint)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: 3,
                      border: `1.5px solid ${sel ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                      background: sel ? 'var(--accent-indigo)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sel && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{a.file?.filename || a.id}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {selected.length} Asset{selected.length !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Amend Claim" accent disabled={!canSubmit} onClick={() => onSubmit?.({ addedAssetIds: [...selected] })} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
