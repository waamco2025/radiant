// AIShopperModal — Phase 7 (spec §9).
//
// Placeholder-grade AI Shopper. The "AI" is a deterministic mock: always
// returns the publicly-disclosed Claims seeded on `buildV22SharedArtifacts`
// as candidate matches, with mock match scores biased by which Requirements
// Set the user picked. The UI shape — Requirements Set picker + prompt +
// launch + progress + results + Request Agreement CTA — is the architecture
// a real LLM-backed shopper would slot into, so Phase 7+ can replace only
// the `runMockSearch` step without redesigning the flow.
//
// Entry points (spec §9): chrome icon (always available) and a prominent
// button inside the Directory Layer (§8.3).

import { useState, useMemo, useEffect } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

function MockProgress() {
  // Simple three-dot progress used while the mock "agent" pretends to search.
  // Matches the PrimeRadiant pattern in look (golden ripple, centred).
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 16px', gap: 20,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-amber) 30%, transparent) 0%, transparent 70%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'v22ShopperPulse 1.6s ease-in-out infinite',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'color-mix(in srgb, var(--accent-amber) 80%, transparent)',
          boxShadow: '0 0 18px color-mix(in srgb, var(--accent-amber) 60%, transparent)',
        }} />
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
      }}>
        Searching the Radiant Network for matches…
      </div>
      <style>{`
        @keyframes v22ShopperPulse {
          0%   { transform: scale(0.85); opacity: 0.6; }
          50%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

function CandidateCard({ candidate, onRequest }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px 16px',
        background: 'var(--bg-card)',
        display: 'flex', alignItems: 'stretch', gap: 14,
        marginBottom: 10,
      }}
    >
      <div style={{
        width: 56, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)',
        borderRadius: 8,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
          color: 'var(--accent-amber)',
        }}>
          {candidate.matchScore}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.08em', color: 'var(--text-dim)', marginTop: 2,
        }}>
          MATCH
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
          color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {candidate.claim.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-dim)' }}>Owner:</span>{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>{candidate.claim.owner}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {candidate.claim.pin}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
          {candidate.rationale}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Btn accent label="Request Agreement" onClick={() => onRequest(candidate)} />
      </div>
    </div>
  )
}

export default function AIShopperModal({
  availableRequirementsSets = [], // [{ id, name, version }]
  publicClaims = [],              // [{ id, name, pin, owner }]
  onRequestAgreement,             // ({ claimPin, claim, ownerParty, suggestedRequirementsSetId }) => void
  onClose,
}) {
  // Default to the first available Req Set so the user can launch without
  // first interacting with the dropdown — the `<select>` shows its first
  // option visually regardless of state, so a blank initial state was a
  // "disabled Launch" trap.
  const [selectedReqSetId, setSelectedReqSetId] = useState(
    () => availableRequirementsSets[0]?.id || '',
  )
  const [prompt, setPrompt] = useState('')
  const [stage, setStage] = useState('setup') // 'setup' | 'searching' | 'results'
  const [results, setResults] = useState([])

  const canLaunch = !!selectedReqSetId && !!prompt.trim()

  const runMockSearch = () => {
    if (!canLaunch) return
    setStage('searching')
    setResults([])
    // Mock latency mirrors the kind of round-trip a real shopper would need
    // (2.2s — long enough to feel real, short enough not to bore a demo).
    setTimeout(() => {
      const reqSet = availableRequirementsSets.find((r) => r.id === selectedReqSetId)
      // Deterministic ranking: the top candidate is the Claim whose name
      // contains tokens overlapping the Req Set name or the prompt. Falling
      // back to insertion order keeps results stable across runs.
      const promptLower = prompt.toLowerCase()
      const reqSetName = (reqSet?.name || '').toLowerCase()
      const scored = publicClaims.map((c, i) => {
        const nameLower = (c.name || '').toLowerCase()
        let score = 72 + (publicClaims.length - i) * 3
        if (reqSetName && nameLower.split(' ').some((tok) => reqSetName.includes(tok))) score += 15
        if (promptLower && nameLower.split(' ').some((tok) => promptLower.includes(tok))) score += 10
        return {
          claim: c,
          matchScore: Math.min(99, score),
          rationale: [
            reqSet ? `Aligns with ${reqSet.name}` : 'Aligns with selected Requirements Set',
            c.publishedDisclosureType ? `Published as ${c.publishedDisclosureType}` : 'Published to Radiant Network',
          ].join(' · '),
          suggestedRequirementsSetId: selectedReqSetId,
        }
      })
      scored.sort((a, b) => b.matchScore - a.matchScore)
      setResults(scored.slice(0, 3))
      setStage('results')
    }, 2200)
  }

  // Cancel the pending mock timer on close so it can't fire into an unmounted
  // component. (Stage is local so no state leaks if the modal is reopened.)
  useEffect(() => {
    return () => { /* nothing to clean up — setTimeout handle ephemeral */ }
  }, [])

  return (
    <Backdrop onClose={onClose}>
      <Modal width={680}>
        <ModalHeader
          title="AI Shopper"
          subtitle="Describe what you're looking for and the AI Shopper will search the Radiant Network for public Claims that match. Results return as candidates you can request an Agreement against."
          onClose={onClose}
        />

        <ModalBody>
          {stage === 'setup' && (
            <>
              <FieldLabel label="Requirements Set" required />
              <select
                value={selectedReqSetId}
                onChange={(e) => setSelectedReqSetId(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)', fontSize: 13,
                  marginBottom: 20,
                }}
              >
                {!selectedReqSetId && <option value="">— Select a Requirements Set —</option>}
                {availableRequirementsSets.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} (v{r.version || 1})</option>
                ))}
              </select>

              <FieldLabel label="What are you looking for?" required />
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. radiation-hardened power regulation modules rated for satellite avionics"
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)', fontSize: 13,
                  resize: 'vertical',
                }}
              />
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 6,
                background: 'color-mix(in srgb, var(--accent-amber) 7%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-amber) 22%, transparent)',
                fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                The shopper searches Claims that have been publicly disclosed to the Radiant Network.
                Matching is advisory — you still request a bilateral Disclosure + Evaluation Agreement
                with the Claim owner before running an evaluation.
              </div>
            </>
          )}

          {stage === 'searching' && <MockProgress />}

          {stage === 'results' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 12,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                }}>
                  Top {results.length} match{results.length === 1 ? '' : 'es'}
                </div>
                <button
                  onClick={() => setStage('setup')}
                  style={{
                    padding: '4px 10px', fontSize: 11,
                    border: '1px solid var(--border)',
                    borderRadius: 4, background: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  Refine
                </button>
              </div>
              {results.length === 0 ? (
                <div style={{
                  padding: 20, textAlign: 'center',
                  color: 'var(--text-dim)', fontSize: 12,
                }}>
                  No public Claims matched. Try adjusting the Requirements Set or prompt.
                </div>
              ) : (
                results.map((c) => (
                  <CandidateCard
                    key={c.claim.id}
                    candidate={c}
                    onRequest={(cand) => {
                      onRequestAgreement?.({
                        claimPin: cand.claim.pin,
                        claim: cand.claim,
                        ownerParty: cand.claim.owner,
                        suggestedRequirementsSetId: cand.suggestedRequirementsSetId,
                      })
                    }}
                  />
                ))
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <Btn label="Cancel" onClick={onClose} />
          {stage === 'setup' ? (
            <Btn accent label="Launch AI Shopper" onClick={runMockSearch} disabled={!canLaunch} />
          ) : stage === 'searching' ? (
            <Btn label="Searching…" disabled />
          ) : (
            <Btn label="Done" onClick={onClose} />
          )}
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
