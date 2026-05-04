// AmendClaimModal — Phase 6 / spec §11.1, extended Phase 12.1 (#120).
// Alice adds Asset references to one of her existing Claims. The Claim's
// referencedAssetIds is widened with the picked Asset ids; an entry is appended
// to the Claim's amendments[]. Existing Disclosure Agreements are NOT
// automatically widened — Alice must explicitly amend each agreement she wants
// to share the new evidence with (spec §11.1 step 5).
//
// Phase 12.1 (#120): two parallel sections — Referenced Assets (Asset add)
// and Referenced Standards (RS add + remove). RS edits are cascade-skip:
// they DO NOT mark Eval Results stale and DO NOT generate notifications
// (per spec §10.3a). Submit can carry either section's diff or both;
// at-least-one of (Asset add, RS add, RS remove) is required to enable
// submit.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'
import Tooltip from '../Tooltip'
import V22CreateAssetModal from './V22CreateAssetModal.jsx'
import RequirementsSetPicker from './RequirementsSetPicker.jsx'

export default function AmendClaimModal({
  activeParty,                 // Phase 9A.3 Gate B — required when `onNestedAssetCreated` is passed
  credits = Infinity,          // Phase 9A.6 Gate A (#65) — forwarded to nested Register-new-Asset
  creditsPerAsset = 0,
  claim,                       // { id, name, description, referencedAssetIds, referencedRequirementsSets, assetReferences }
  candidateAssets = [],        // [{ id, name, file: { filename } }] — Assets owned by the active actor that aren't already referenced
  alreadyReferencedAssets = [], // [{ id, name, file: { filename } }] — for the read-only "already referenced" panel
  // Phase 12.1 (#120): RS pools + lookup for surfacing existing references.
  ownRequirementSets = [],
  publicRequirementSets = [],
  rsLookup = {},               // { [rsId]: { name, version, _publishedBy, ... } } — used to render existing-reference rows
  // Phase 12.2 (#122): set of evaluated Asset ids (Assets referenced by at
  // least one Eval Result on this Claim). Used to gate the Replace/Remove
  // affordances — non-evaluated rows can also be removed but the brief
  // says the two-affordance pattern only applies to evaluated rows.
  evaluatedAssetIds = [],
  // Phase 12.2 (#122): replacement candidate pool — Assets owned by the
  // active actor that aren't already on the Claim. Used for the Replace
  // sub-picker. Same shape as `candidateAssets` (a superset).
  replacementCandidates = null,
  onSubmit,                    // ({ addedAssetIds, addedRequirementsSetIds, removedRequirementsSetIds, removedAssetIds, supersededAssets }) => void
  onClose,
  // Phase 9A.3 Gate B / backlog #34 — inline "Register new Asset…" CTA. When
  // passed, the modal renders the CTA and opens V22CreateAssetModal nested.
  // On nested submit V2App creates the Asset and returns its new id; we
  // auto-select it in this modal's `selected` list.
  onNestedAssetCreated,        // ({ file, displayName }) => newAssetId
}) {
  const [selected, setSelected] = useState([])
  const [showNestedRegister, setShowNestedRegister] = useState(false)
  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  // Phase 12.1 (#120): RS edit state. `addedRsIds` are picks not yet on the
  // Claim. `removedRsIds` are existing references the user has marked for
  // removal (rendered with strikethrough but stay visible until Cancel/Submit).
  // `currentRsIds` is the set of RS already on the Claim — used to lock the
  // picker so the user can't double-add an existing reference.
  const currentRsList = claim?.referencedRequirementsSets || []
  const currentRsIds = currentRsList.map((r) => r.requirementsSetId)
  const [addedRsIds, setAddedRsIds] = useState([])
  const [removedRsIds, setRemovedRsIds] = useState([])
  const [showRsPicker, setShowRsPicker] = useState(false)
  const toggleRsPick = (rsId) => {
    setAddedRsIds((prev) => prev.includes(rsId) ? prev.filter((x) => x !== rsId) : [...prev, rsId])
  }
  const toggleRsRemove = (rsId) => {
    setRemovedRsIds((prev) => prev.includes(rsId) ? prev.filter((x) => x !== rsId) : [...prev, rsId])
  }

  // Phase 12.2 (#122): Asset edits — supersede + drop. `supersededAssets`
  // is a list of `{ from, to }` pairs (Replace selections); `removedAssetIds`
  // is the bare-id drop set. `replacingFromAssetId` tracks which row is
  // currently in the Replace picker.
  const [supersededAssets, setSupersededAssets] = useState([])
  const [removedAssetIds, setRemovedAssetIds] = useState([])
  const [replacingFromAssetId, setReplacingFromAssetId] = useState(null)
  const evaluatedSet = new Set(evaluatedAssetIds)
  const replacementPool = (replacementCandidates || candidateAssets)
    .filter((a) => a.id !== replacingFromAssetId)
  const toggleRemoveAsset = (assetId) => {
    setRemovedAssetIds((prev) => prev.includes(assetId) ? prev.filter((x) => x !== assetId) : [...prev, assetId])
    // Removing an Asset cancels any in-flight supersession on the same id.
    setSupersededAssets((prev) => prev.filter((s) => s.from !== assetId))
  }
  const applyReplace = (toAssetId) => {
    if (!replacingFromAssetId || !toAssetId) return
    setSupersededAssets((prev) => {
      const without = prev.filter((s) => s.from !== replacingFromAssetId)
      return [...without, { from: replacingFromAssetId, to: toAssetId }]
    })
    // Replacing cancels any drop on the same id.
    setRemovedAssetIds((prev) => prev.filter((x) => x !== replacingFromAssetId))
    setReplacingFromAssetId(null)
  }
  const cancelReplace = (fromAssetId) => {
    setSupersededAssets((prev) => prev.filter((s) => s.from !== fromAssetId))
  }
  const cancelRemove = (assetId) => {
    setRemovedAssetIds((prev) => prev.filter((x) => x !== assetId))
  }

  // Submit is enabled when ANY of the diff buckets has content.
  const canSubmit = selected.length > 0
    || addedRsIds.length > 0
    || removedRsIds.length > 0
    || supersededAssets.length > 0
    || removedAssetIds.length > 0

  const handleNestedAssetComplete = (payload) => {
    setShowNestedRegister(false)
    const newIds = onNestedAssetCreated?.(payload)
    // Phase 9A.6 Gate B (#66): may be an array for multi-file nested registers.
    const ids = Array.isArray(newIds) ? newIds : (newIds ? [newIds] : [])
    if (ids.length > 0) {
      // V2App's parent render may not yet include the new Assets in
      // candidateAssets by the time we check; set selected optimistically so
      // the user sees their new Assets ticked as soon as the parent re-renders.
      setSelected((p) => {
        const next = [...p]
        for (const id of ids) if (!next.includes(id)) next.push(id)
        return next
      })
    }
  }

  return (
    <>
    <Backdrop onClose={onClose}>
      <Modal width={620}>
        <ModalHeader
          title="Amend Claim"
          subtitle={`Add Assets you own to ${claim?.name || 'this Claim'}'s referenced Assets. Existing Disclosure Agreements are not automatically widened.`}
          onClose={onClose}
        />
        <ModalBody>
          {/* Phase 12.2 (#122): per-Asset action affordances. Evaluated rows
              get Replace + Remove buttons. Both produce the OUTDATED signal
              on prior Eval Results. Non-evaluated rows still render with
              the existing tooltip-disabled treatment (no action surface
              this phase — keeps scope tight). */}
          <FieldLabel label={`Already referenced (${alreadyReferencedAssets.length})`} />
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
            {alreadyReferencedAssets.length === 0 ? (
              <div style={{ padding: 14, fontSize: 11, color: 'var(--text-dim)' }}>
                No Assets currently referenced.
              </div>
            ) : alreadyReferencedAssets.map((a) => {
              const isEvaluated = evaluatedSet.has(a.id)
              const isRemoving = removedAssetIds.includes(a.id)
              const supersedeEntry = supersededAssets.find((s) => s.from === a.id)
              const replacement = supersedeEntry
                ? (replacementPool.find((x) => x.id === supersedeEntry.to)
                  || alreadyReferencedAssets.find((x) => x.id === supersedeEntry.to)
                  || candidateAssets.find((x) => x.id === supersedeEntry.to))
                : null
              const dimmed = isRemoving || !!supersedeEntry
              return (
                <div
                  key={a.id}
                  style={{
                    padding: '10px 14px',
                    background: isRemoving
                      ? 'color-mix(in srgb, var(--accent-red) 6%, transparent)'
                      : supersedeEntry
                        ? 'color-mix(in srgb, var(--accent-amber) 5%, transparent)'
                        : 'color-mix(in srgb, var(--text-dim) 5%, transparent)',
                    borderBottom: '1px solid var(--border-faint)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    opacity: dimmed ? 0.85 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600,
                      textDecoration: dimmed ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {a.name}
                      {isEvaluated && (
                        <span style={{
                          marginLeft: 6, fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          letterSpacing: '0.1em', padding: '1px 5px', borderRadius: 3,
                          color: 'var(--accent-indigo)',
                          background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--accent-indigo) 30%, transparent)',
                          textDecoration: 'none',
                        }}>EVALUATED</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{a.file?.filename || a.id}</div>
                    {supersedeEntry && replacement && (
                      <div style={{ fontSize: 10, color: 'var(--accent-amber)', marginTop: 4 }}>
                        → Replacing with <strong style={{ color: 'var(--text-primary)' }}>{replacement.name || replacement.id}</strong>
                      </div>
                    )}
                  </div>
                  {/* Action affordances. Evaluated + non-evaluated both get
                      Replace / Remove this phase to keep the surface uniform. */}
                  {!isRemoving && !supersedeEntry && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => setReplacingFromAssetId(a.id)}
                        title={isEvaluated ? 'Replace with a newer version (records as supersession; flips referencing Eval Results to OUTDATED).' : 'Replace this Asset reference with another you own.'}
                        style={{
                          padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)',
                          fontWeight: 600, letterSpacing: '0.04em',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-amber)'; e.currentTarget.style.borderColor = 'var(--accent-amber)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                      >Replace</button>
                      <button
                        onClick={() => toggleRemoveAsset(a.id)}
                        title={isEvaluated ? 'Drop this Asset reference (flips referencing Eval Results to OUTDATED).' : 'Drop this Asset reference.'}
                        style={{
                          padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)',
                          fontWeight: 600, letterSpacing: '0.04em',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                      >Remove</button>
                    </div>
                  )}
                  {isRemoving && (
                    <button
                      onClick={() => cancelRemove(a.id)}
                      style={{
                        padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                        border: '1px solid var(--accent-amber)',
                        background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                        color: 'var(--accent-amber)', fontSize: 10, fontFamily: 'var(--font-mono)',
                        fontWeight: 600, letterSpacing: '0.04em', flexShrink: 0,
                      }}
                    >Undo</button>
                  )}
                  {supersedeEntry && (
                    <button
                      onClick={() => cancelReplace(a.id)}
                      style={{
                        padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                        border: '1px solid var(--accent-amber)',
                        background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                        color: 'var(--accent-amber)', fontSize: 10, fontFamily: 'var(--font-mono)',
                        fontWeight: 600, letterSpacing: '0.04em', flexShrink: 0,
                      }}
                    >Undo</button>
                  )}
                </div>
              )
            })}
          </div>
          {/* Phase 12.1 (#120): Asset section is no longer "required" in
              isolation — submit is gated on at-least-one of (Asset add,
              RS add, RS remove). Label drops the asterisk. */}
          <FieldLabel label={`Add Assets (${candidateAssets.length} available)`} />
          {candidateAssets.length === 0 ? (
            <div style={{
              padding: 14, background: 'var(--bg-card)',
              border: '1px dashed var(--border)', borderRadius: 8,
              fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6,
            }}>
              <div style={{ marginBottom: onNestedAssetCreated ? 10 : 0 }}>
                You don't own any Assets that aren't already referenced by this Claim.
                {onNestedAssetCreated ? ' Register one inline and it will be added to this Claim.' : ' Register a new Asset first.'}
              </div>
              {onNestedAssetCreated && (
                <button
                  onClick={() => setShowNestedRegister(true)}
                  style={{
                    width: '100%', padding: '9px 14px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--accent-green)',
                    background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
                    color: 'var(--accent-green)',
                    fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  + Register new Asset…
                </button>
              )}
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {onNestedAssetCreated && (
                <div style={{
                  padding: '8px 14px', borderBottom: '1px solid var(--border-faint)',
                }}>
                  <button
                    onClick={() => setShowNestedRegister(true)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                      border: '1px dashed var(--accent-green)',
                      background: 'transparent',
                      color: 'var(--accent-green)',
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      letterSpacing: '0.04em',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green) 5%, transparent)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    + Register new Asset…
                  </button>
                </div>
              )}
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

          {/* Phase 12.1 (#120): Referenced Standards section. Optional —
              the parent Claim doesn't require any RS. Edits are cascade-skip:
              no Eval Result staleness, no notifications. Removals show
              inline strikethrough with an Undo button. */}
          <div style={{ marginTop: 22 }}>
            <FieldLabel label={`Referenced Standards (${currentRsList.length} current, ${addedRsIds.length} adding, ${removedRsIds.length} removing)`} />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
              Non-binding metadata declaring which standards this Claim is built to satisfy.
              Changes here do not affect existing evaluations and do not generate notifications.
            </div>

            {/* Existing references with × buttons. */}
            {currentRsList.length > 0 && (
              <div style={{
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--bg-card)', marginBottom: 10,
              }}>
                {currentRsList.map((entry, i) => {
                  const rs = rsLookup[entry.requirementsSetId]
                  const removing = removedRsIds.includes(entry.requirementsSetId)
                  const name = rs?.name || entry.requirementsSetId
                  const version = rs?.version
                  return (
                    <div key={entry.requirementsSetId} style={{
                      padding: '10px 14px',
                      borderBottom: i < currentRsList.length - 1 ? '1px solid var(--border-faint)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: removing ? 'color-mix(in srgb, var(--accent-red) 6%, transparent)' : 'transparent',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, color: 'var(--text-primary)', fontWeight: 600,
                          textDecoration: removing ? 'line-through' : 'none',
                          opacity: removing ? 0.55 : 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {name}
                          {version != null && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginLeft: 6 }}>v{version}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleRsRemove(entry.requirementsSetId)}
                        title={removing ? 'Undo removal' : 'Remove this reference'}
                        style={{
                          padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                          border: '1px solid var(--border)',
                          background: removing ? 'color-mix(in srgb, var(--accent-amber) 12%, transparent)' : 'transparent',
                          color: removing ? 'var(--accent-amber)' : 'var(--text-dim)',
                          fontSize: 10, fontFamily: 'var(--font-mono)',
                          fontWeight: 600, letterSpacing: '0.04em',
                        }}
                      >{removing ? 'Undo' : 'Remove'}</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Newly-picked references (preview before submit). */}
            {addedRsIds.length > 0 && (
              <div style={{
                border: '1px solid color-mix(in srgb, var(--accent-indigo) 30%, transparent)',
                borderRadius: 8, background: 'color-mix(in srgb, var(--accent-indigo) 4%, transparent)',
                marginBottom: 10,
              }}>
                {addedRsIds.map((rsId, i) => {
                  const rs = rsLookup[rsId] || ownRequirementSets.find((x) => x.id === rsId) || publicRequirementSets.find((x) => x.id === rsId)
                  return (
                    <div key={rsId} style={{
                      padding: '10px 14px',
                      borderBottom: i < addedRsIds.length - 1 ? '1px solid var(--border-faint)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{
                        fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        letterSpacing: '0.1em', padding: '1px 5px', borderRadius: 3,
                        color: 'var(--accent-indigo)',
                        background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--accent-indigo) 30%, transparent)',
                      }}>NEW</span>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                        {rs?.name || rsId}
                        {rs?.version != null && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginLeft: 6 }}>v{rs.version}</span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleRsPick(rsId)}
                        title="Drop from selection"
                        style={{
                          padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)',
                          fontWeight: 600, letterSpacing: '0.04em',
                        }}
                      >Cancel</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add references — toggleable picker so it doesn't crowd the
                modal when the user is only doing Asset edits. */}
            {!showRsPicker ? (
              <button
                onClick={() => setShowRsPicker(true)}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 6, cursor: 'pointer',
                  border: '1px dashed var(--border-hover)', background: 'transparent',
                  color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)',
                  fontWeight: 600, letterSpacing: '0.04em',
                  transition: 'all 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; e.currentTarget.style.color = 'var(--accent-indigo)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                + Add Referenced Standard{currentRsList.length === 0 ? 's' : ''}
              </button>
            ) : (
              <div>
                <RequirementsSetPicker
                  ownRequirementSets={ownRequirementSets}
                  publicRequirementSets={publicRequirementSets}
                  selectedIds={addedRsIds}
                  onToggle={toggleRsPick}
                  lockedIds={currentRsIds}
                />
                <button
                  onClick={() => setShowRsPicker(false)}
                  style={{
                    marginTop: 8, padding: '6px 12px', borderRadius: 5, cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)',
                    fontWeight: 600, letterSpacing: '0.04em',
                  }}
                >Hide picker</button>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {selected.length} added · {supersededAssets.length} replaced · {removedAssetIds.length} removed · {addedRsIds.length}/{removedRsIds.length} standards
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn
              label="Amend Claim"
              accent
              disabled={!canSubmit}
              onClick={() => onSubmit?.({
                addedAssetIds: [...selected],
                addedRequirementsSetIds: [...addedRsIds],
                removedRequirementsSetIds: [...removedRsIds],
                // Phase 12.2 (#122): Asset supersession + drop diff buckets.
                supersededAssets: supersededAssets.map((s) => ({ from: s.from, to: s.to })),
                removedAssetIds: [...removedAssetIds],
              })}
            />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
    {showNestedRegister && (
      <V22CreateAssetModal
        activeParty={activeParty}
        credits={credits}
        creditsPerAsset={creditsPerAsset}
        onClose={() => setShowNestedRegister(false)}
        onComplete={handleNestedAssetComplete}
      />
    )}
    {/* Phase 12.2 (#122): Replace-Asset picker overlay. Sibling Backdrop
        sitting above the parent so the user can pick the replacement
        without losing the rest of the AmendClaim diff state. */}
    {replacingFromAssetId && (
      <Backdrop onClose={() => setReplacingFromAssetId(null)}>
        <Modal width={520}>
          <ModalHeader
            title="Replace Asset reference"
            subtitle="Pick a replacement Asset you own. The original Asset stays in the Claim's history; referencing Eval Results will flip to OUTDATED."
            onClose={() => setReplacingFromAssetId(null)}
          />
          <ModalBody>
            {replacementPool.length === 0 ? (
              <div style={{ padding: 14, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                No replacement candidates available. Register a new Asset first, or close this picker and use Remove instead.
              </div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {replacementPool.map((a, i) => (
                  <div
                    key={a.id}
                    onClick={() => applyReplace(a.id)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: i < replacementPool.length - 1 ? '1px solid var(--border-faint)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-amber) 8%, transparent)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{a.file?.filename || a.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Btn label="Cancel" onClick={() => setReplacingFromAssetId(null)} />
          </ModalFooter>
        </Modal>
      </Backdrop>
    )}
    </>
  )
}
