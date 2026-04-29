// EARequestModal — Phase 11C / spec §11.6a warm-path Evaluation Agreement
// request flow.
//
// Used when the requester already has an active Disclosure Agreement on the
// target Claim and wants to add an Evaluation Agreement to gain evaluation
// rights. Single-step modal — the DA scope/type is fixed (already negotiated),
// so the requester only needs to propose EA terms.
//
// Submission creates a provisional EA referencing the existing active DA.
// The Claim flips to provisional state on the requester's canvas; the grantor
// receives a `v22-request-ea-only` notification and responds via
// CombinedResponseModal in `eaOnlyMode`.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

const DEFAULT_EXPIRY_DAYS = 365

function defaultExpiryIsoDate() {
  const d = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export default function EARequestModal({
  requesterParty,        // e.g. 'GovCo'
  requesterAsset,        // { id, name } — anchor on the requester's canvas
  claim,                 // { id, name, ownerParty } — the Claim being requested for
  ownerParty,            // grantor (= claim.owner)
  existingDisclosureAgreementId, // the active DA's id (warm path anchor)
  availableRequirementsSets = [], // [{ id, name, version }]
  onSubmit,              // ({ claim, ownerParty, existingDisclosureAgreementId, selectedRequirementsSetIds, message, eaTerms }) => void
  onClose,
}) {
  const [message, setMessage] = useState('')
  const [selectedReqSets, setSelectedReqSets] = useState([])
  const [expiryDate, setExpiryDate] = useState(() => defaultExpiryIsoDate())
  const [resultConfidentiality, setResultConfidentiality] = useState(false)
  const [attribution, setAttribution] = useState(false)

  const toggleReqSet = (id) => {
    setSelectedReqSets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSubmit = () => {
    onSubmit?.({
      claim,
      ownerParty,
      existingDisclosureAgreementId,
      selectedRequirementsSetIds: selectedReqSets,
      message: message.trim(),
      eaTerms: {
        expires: expiryDate ? new Date(`${expiryDate}T23:59:59Z`).toISOString() : null,
        resultConfidentiality,
        attribution,
      },
    })
  }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={640}>
        <ModalHeader
          title="Request Evaluation Agreement"
          subtitle={`Request evaluation rights on ${claim?.name || 'this Claim'} from ${ownerParty}. Your existing Disclosure Agreement remains in place.`}
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
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Target</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{claim?.name} <span style={{ color: 'var(--text-secondary)' }}>— {ownerParty}</span></div>
            </div>
            {requesterAsset && (
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Anchor</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{requesterAsset.name}</div>
              </div>
            )}
          </div>

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

          <FieldLabel label="Agreement expiry" />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
            Set when the Evaluation Agreement expires. Defaults to one year from today. Leave blank for no expiry.
          </div>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            style={{
              width: '100%', height: 38, padding: '0 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              outline: 'none',
              marginBottom: 22,
              boxSizing: 'border-box',
            }}
          />

          <FieldLabel label="Acknowledgments" />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
            These commitments ride along with the Evaluation Agreement and are surfaced to the grantor for review.
          </div>
          <CheckboxRow
            checked={resultConfidentiality}
            onToggle={() => setResultConfidentiality(v => !v)}
            label="Result confidentiality"
            desc="Evaluation results are for internal use only and will not be shared with third parties."
          />
          <CheckboxRow
            checked={attribution}
            onToggle={() => setAttribution(v => !v)}
            label="Attribution"
            desc="If results are referenced externally (audits, certifications), the evaluator will be credited."
          />

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
            Will request from <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{ownerParty}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Send Request" accent onClick={handleSubmit} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}

// Same checkbox row pattern as CombinedRequestModal Step 2.
function CheckboxRow({ checked, onToggle, label, desc }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '12px 14px',
        marginBottom: 10,
        cursor: 'pointer',
        background: checked ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'var(--bg-card)',
        border: `1px solid ${checked ? 'color-mix(in srgb, var(--accent-indigo) 35%, var(--border))' : 'var(--border)'}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'flex-start', gap: 12,
        transition: 'background 120ms, border 120ms',
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: 3,
        border: `1.5px solid ${checked ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
        background: checked ? 'var(--accent-indigo)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
      }}>
        {checked && (
          <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}
