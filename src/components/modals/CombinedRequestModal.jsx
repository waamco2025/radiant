// CombinedRequestModal — V2.2 replacement for RequestDisclosureModal.
// Bob requests a Disclosure Agreement + Evaluation Agreement pair in a single
// flow (spec §7.1 step 1). Visual language inherited from V2.1 modals
// (Backdrop / Modal / ModalHeader / ModalBody / ModalFooter, Btn, StepDots).
//
// Flow (single step):
//   1. Enter the target Claim's PIN.
//   2. (Optional) Select one or more Requirements Sets you'd like authorized.
//   3. Write a short message for the grantor.
//   Submit → V2App creates a provisional DA + EA pair.

import { useState, useMemo } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, CopyBadge,
} from './ModalShared'

const PIN_PREFIX = 'PIN-0x'

function isValidPinShape(pin) {
  return typeof pin === 'string' && pin.startsWith(PIN_PREFIX) && pin.length >= PIN_PREFIX.length + 8
}

export default function CombinedRequestModal({
  requesterParty,        // e.g. 'GovCo'
  requesterAsset,        // { id, name, pin } — the Asset this request will anchor to on the requester's canvas
  availableRequirementsSets = [], // [{ id, name, version }]
  resolveClaimByPin,     // (pin) => { claim, ownerParty } | null
  onSubmit,              // ({ claimPin, claim, selectedRequirementsSetIds, message }) => void
  onClose,
}) {
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [selectedReqSets, setSelectedReqSets] = useState([])

  const trimmed = pin.trim()
  const pinShapeOk = isValidPinShape(trimmed)

  const resolution = useMemo(() => {
    if (!pinShapeOk) return { state: 'idle' }
    const lookup = resolveClaimByPin?.(trimmed)
    if (!lookup || !lookup.claim) return { state: 'missing' }
    if (lookup.ownerParty === requesterParty) return { state: 'self' }
    return { state: 'ok', claim: lookup.claim, ownerParty: lookup.ownerParty }
  }, [trimmed, pinShapeOk, resolveClaimByPin, requesterParty])

  const canSubmit = resolution.state === 'ok' && requesterAsset

  const toggleReqSet = (id) => {
    setSelectedReqSets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit?.({
      claimPin: trimmed,
      claim: resolution.claim,
      ownerParty: resolution.ownerParty,
      selectedRequirementsSetIds: selectedReqSets,
      message: message.trim(),
    })
  }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={640}>
        <ModalHeader
          title="Request Agreement"
          subtitle="Request a Disclosure + Evaluation Agreement in one step. The grantor will respond with the disclosure type, scope, and evaluation terms."
          onClose={onClose}
        />

        <ModalBody>
          {/* Context — who's requesting and against what */}
          <div style={{
            padding: '12px 16px', borderRadius: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            marginBottom: 20,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Requester</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{requesterParty}</div>
            </div>
            {requesterAsset && (
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Anchor</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{requesterAsset.name}</div>
              </div>
            )}
          </div>

          {/* PIN input */}
          <FieldLabel label="Claim PIN" required />
          <input
            type="text"
            autoFocus
            spellCheck={false}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN-0x..."
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              background: 'var(--bg-card)',
              border: `1px solid ${resolution.state === 'missing' || resolution.state === 'self' ? 'var(--accent-red)' : 'var(--border)'}`,
              borderRadius: 6,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <div style={{ minHeight: 22, marginTop: 6, marginBottom: 18 }}>
            {resolution.state === 'ok' && (
              <div style={{ fontSize: 11, color: 'var(--accent-green)' }}>
                ✓ Found: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{resolution.claim.name}</span>
                {' — '}
                <span style={{ color: 'var(--text-secondary)' }}>{resolution.ownerParty}</span>
              </div>
            )}
            {resolution.state === 'missing' && trimmed.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>PIN not found on the network.</div>
            )}
            {resolution.state === 'self' && (
              <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>This Claim is owned by you — no agreement needed.</div>
            )}
          </div>

          {/* Optional requirements sets */}
          <FieldLabel label="Requested Requirements Sets (optional)" />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.6 }}>
            Suggest the Requirements Sets you'd like to evaluate against. The grantor decides which to authorize in their response.
          </div>
          <div style={{
            maxHeight: 200, overflowY: 'auto',
            border: '1px solid var(--border)', borderRadius: 8,
            marginBottom: 22,
          }}>
            {availableRequirementsSets.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                No Requirements Sets available in your library.
              </div>
            ) : (
              availableRequirementsSets.map((rs) => {
                const selected = selectedReqSets.includes(rs.id)
                return (
                  <div
                    key={rs.id}
                    onClick={() => toggleReqSet(rs.id)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      background: selected ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'transparent',
                      borderBottom: '1px solid var(--border-faint)',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--bg-raised)' }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: 3,
                      border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                      background: selected ? 'var(--accent-indigo)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {selected && (
                        <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{rs.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {rs.id} · v{rs.version ?? 1}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Message */}
          <FieldLabel label="Message (optional)" />
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Briefly explain the context of this request…"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
        </ModalBody>

        <ModalFooter>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {resolution.state === 'ok' && (
              <>
                Will request from <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{resolution.ownerParty}</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Send Request" accent disabled={!canSubmit} onClick={handleSubmit} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
