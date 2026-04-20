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
  Btn, FieldLabel, CopyBadge,
} from './ModalShared'
import PrimeRadiant from '../../v2/PrimeRadiant.jsx'

function MockProgress({ reqSetName }) {
  // Phase 8 polish #3: match the V22RunEvaluationModal / ParseEvidenceModal
  // processing-stage layout — same PrimeRadiant + progress-bar treatment so
  // the three structurally-similar flows feel like siblings.
  return (
    <div style={{ padding: '60px 36px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 28px' }}>
        <PrimeRadiant size={80} fps={30} strutScale={1.8} brightness={0.3} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        Searching the Radiant Network for matches…
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        Scanning public Claims against {reqSetName || 'your Requirements Set'}
      </div>
      <div style={{
        width: '60%', height: 3, borderRadius: 2,
        background: 'var(--border)', margin: '24px auto 0',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'var(--accent-amber)',
          animation: 'v22shopperprogress 2.2s ease forwards',
        }} />
      </div>
      <style>{`@keyframes v22shopperprogress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  )
}

function CandidateCard({ candidate, onRequest }) {
  // Phase 8 polish #4: visual hierarchy —
  //   • match score is the largest and most prominent element
  //   • claim name sits at 15px/600 as the primary heading
  //   • per-result rationale (two lines: primary + secondary) as subtitle
  //   • owner + truncated PIN live as a discreet footer row using CopyBadge
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px 16px',
        background: 'var(--bg-card)',
        display: 'flex', alignItems: 'stretch', gap: 16,
        marginBottom: 10,
      }}
    >
      <div style={{
        width: 72, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)',
        borderRadius: 8,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700,
          color: 'var(--accent-amber)', lineHeight: 1,
        }}>
          {candidate.matchScore}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.08em', color: 'var(--text-dim)', marginTop: 4,
        }}>
          MATCH
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600,
          color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {candidate.claim.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {candidate.rationalePrimary}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {candidate.rationaleSecondary}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginTop: 4, fontSize: 10,
        }}>
          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
            {candidate.claim.owner}
          </span>
          <span style={{ color: 'var(--border-hover)' }}>·</span>
          <CopyBadge value={candidate.claim.pin} truncated />
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
      const reqSetNameLower = (reqSet?.name || '').toLowerCase()
      // Phase 8 polish #4: per-result rationale variety. Pick which "angle"
      // the mock agent found to highlight — token match / disclosure type /
      // recency / owner party — so three stacked candidates don't all say
      // the same thing. Rationale decides by score band so the top result
      // names the strongest match reason.
      const scored = publicClaims.map((c, i) => {
        const nameLower = (c.name || '').toLowerCase()
        const tokenHit = reqSetNameLower && nameLower.split(/[\s-]+/).some((tok) => reqSetNameLower.includes(tok) && tok.length > 2)
        const promptHit = promptLower && nameLower.split(/[\s-]+/).some((tok) => promptLower.includes(tok) && tok.length > 3)
        let score = 72 + (publicClaims.length - i) * 3
        if (tokenHit) score += 15
        if (promptHit) score += 10
        const disclosureLabel = c.publishedDisclosureType === 'selective'
          ? 'Selective publication — parsed fields available'
          : c.publishedDisclosureType === 'proofonly'
            ? 'Proof-only publication — attested by prior Eval Results'
            : 'Full publication — complete evidence set available'
        // Pick the strongest reason first; vary second reason by index.
        const primary = tokenHit
          ? `Direct match on “${reqSet?.name || 'Requirements Set'}” terms`
          : promptHit
            ? 'Semantic match against your prompt'
            : `Aligns topically with ${reqSet?.name || 'Requirements Set'}`
        const secondary = [
          disclosureLabel,
          `Owned by ${c.owner}`,
          `${Math.max(2, 12 - i * 3)} other Req Sets have scored it highly`,
        ][i % 3]
        return {
          claim: c,
          matchScore: Math.min(99, score),
          rationalePrimary: primary,
          rationaleSecondary: secondary,
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
              {/* Phase 8 polish #5: match the Req Set picker in V22RunEvaluationModal —
                  a flat card list with name + id/version, indigo-tinted selection state.
                  Retired the native <select> both for visual consistency and because
                  its "first option visible regardless of state" behaviour caused a
                  disabled-launch trap during Phase 7 runtime verification. */}
              {availableRequirementsSets.length === 0 ? (
                <div style={{
                  padding: 14, background: 'var(--bg-card)',
                  border: '1px solid var(--accent-amber)', borderRadius: 6,
                  fontSize: 11, color: 'var(--text-secondary)', marginBottom: 20,
                }}>
                  No Requirements Sets in your library. Add one before launching the AI Shopper.
                </div>
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Requirements Set"
                  style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}
                >
                  {availableRequirementsSets.map((rs) => {
                    const selected = selectedReqSetId === rs.id
                    return (
                      <div
                        key={rs.id}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        onClick={() => setSelectedReqSetId(rs.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedReqSetId(rs.id)
                          }
                        }}
                        style={{
                          padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
                          background: selected ? 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)' : 'var(--bg-card)',
                          border: `1px solid ${selected ? 'var(--accent-indigo)' : 'var(--border)'}`,
                          transition: 'all 120ms',
                          display: 'flex', alignItems: 'center', gap: 10,
                          outline: 'none',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = selected ? 'var(--accent-indigo)' : 'var(--border-hover)' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = selected ? 'var(--accent-indigo)' : 'var(--border)' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{rs.name}</div>
                          <div style={{
                            fontSize: 10, color: 'var(--text-dim)',
                            fontFamily: 'var(--font-mono)', marginTop: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {rs.id} · v{rs.version ?? 1}
                          </div>
                        </div>
                        {/* Selection indicator dot — same language as the eval-modal picker. */}
                        <div style={{
                          width: 12, height: 12, borderRadius: '50%',
                          border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                          background: selected ? 'var(--accent-indigo)' : 'transparent',
                          flexShrink: 0,
                        }} />
                      </div>
                    )
                  })}
                </div>
              )}

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

          {stage === 'searching' && (
            <MockProgress
              reqSetName={availableRequirementsSets.find((r) => r.id === selectedReqSetId)?.name}
            />
          )}

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
