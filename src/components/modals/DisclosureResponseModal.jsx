import { useState, useMemo, useEffect } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow, CopyBadge,
  SDATypeCard, DecisionCard, ExpiryPicker, expiryLabel, SDA_TYPES,
  ToggleCard, LevelInline, SDABadge, ChainIcon, getEffectiveLevel,
} from './ModalShared'
import UpstreamPicker from './UpstreamPicker'
import { FIELD_CATEGORIES } from '../../v2/pepTemplates.js'

/* ─── Expandable Requirement Set Card (shared) ─── */
function ReqSetCard({ rs }) {
  const [expanded, setExpanded] = useState(false)
  // Handle both full set objects and plain strings
  if (typeof rs === 'string') {
    return (
      <div style={{
        padding: '10px 12px', background: 'var(--bg-deep)', borderRadius: 6,
        border: '1px solid var(--border)', marginBottom: 6,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{rs}</div>
      </div>
    )
  }
  return (
    <div style={{
      padding: '10px 12px', background: 'var(--bg-deep)', borderRadius: 6,
      border: '1px solid var(--border)', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{rs.name}</span>
        {rs.version && (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '2px 6px', borderRadius: 4,
            color: 'var(--accent-indigo)',
            background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
          }}>v{rs.version}</span>
        )}
      </div>
      {rs.description && (
        <div style={{
          fontSize: 11, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{rs.description}</div>
      )}
      {rs.requirements && rs.requirements.length > 0 && (
        <>
          <div
            onClick={e => { e.stopPropagation(); setExpanded(p => !p) }}
            style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
              cursor: 'pointer', marginTop: 6, transition: 'color 100ms',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-indigo)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            {expanded ? `▾ Hide ${rs.requirements.length} requirements` : `▸ View ${rs.requirements.length} requirements`}
          </div>
          {expanded && (
            <div style={{
              maxHeight: 180, overflowY: 'auto', marginTop: 8, padding: '8px 10px',
              background: 'var(--bg-card)', borderRadius: 6,
              border: '1px solid var(--border)',
            }}>
              {rs.requirements.map((req, i) => (
                <div key={req.id || i} style={{
                  padding: '6px 0',
                  borderBottom: i < rs.requirements.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '2px 7px', borderRadius: 4, flexShrink: 0, marginTop: 1,
                    color: req.type === 'extraction' ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                    background: req.type === 'extraction'
                      ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)'
                      : 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                  }}>
                    {req.type === 'extraction' ? 'EXTRACT' : 'INFER'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{req.label}</div>
                    {req.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 1 }}>{req.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Step 1: Review request + decide ─── */
function StepReview({ request, decision, setDecision }) {
  const reqs = request.requirements || []
  return (
    <div>
      <div style={{ padding: 18, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)',
          }}>{request.from.name[0]}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{request.from.name}</div>
            <CopyBadge value={request.from.dot} truncated />
          </div>
        </div>
        <InfoRow label="Requesting asset" value={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{request.asset.name}</span>
            <CopyBadge value={request.asset.pin} truncated />
          </span>
        } />
        {/* Requirements section */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4, paddingTop: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Requirements</span>
            {reqs.length > 0 && (
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)',
                padding: '1px 6px', borderRadius: 4, background: 'var(--bg-raised)',
              }}>{reqs.length} set{reqs.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {reqs.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', paddingLeft: 4 }}>None specified</div>
            : (
              <div style={{ maxHeight: 240, overflowY: 'auto', paddingLeft: 4 }}>
                {reqs.map((r, i) => <ReqSetCard key={i} rs={r} />)}
              </div>
            )
          }
        </div>
      </div>

      {request.message && (
        <div style={{ padding: '16px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 8, letterSpacing: '0.03em' }}>
            MESSAGE FROM {request.from.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{request.message}</div>
        </div>
      )}

      <FieldLabel label="Your response" />
      <div style={{ display: 'flex', gap: 10 }}>
        <DecisionCard
          id="accept" label="Accept"
          desc="Grant disclosure access to this asset"
          color="var(--accent-green)" icon="✓"
          active={decision === 'accept'} onClick={() => setDecision('accept')}
        />
        <DecisionCard
          id="decline" label="Decline"
          desc="Reject this disclosure request"
          color="var(--accent-red)" icon="✕"
          active={decision === 'decline'} onClick={() => setDecision('decline')}
        />
      </div>
    </div>
  )
}

/* ─── Step 2a: Terms — owner chooses disclosure type ─── */
function StepTerms({ level, setLevel, expiry, setExpiry, customDate, setCustomDate, request, hasProofEval, cascadePolicy, setCascadePolicy, hasCascadableAssets, hasPepFields }) {
  return (
    <div>
      <FieldLabel label="Choose disclosure type" />
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
        Select the level of access <strong style={{ color: 'var(--text-primary)' }}>{request.from.name}</strong> will have to <strong style={{ color: 'var(--text-primary)' }}>{request.asset.name}</strong>.
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
        <SDATypeCard type="full" selected={level} onSelect={setLevel} />
        <SDATypeCard type="selective" selected={level} onSelect={setLevel} />
        <SDATypeCard type="proofonly" selected={level} onSelect={setLevel} />
      </div>

      {level === 'proofonly' && !hasProofEval && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginTop: -8, marginBottom: 14,
          background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
          fontSize: 12, color: 'var(--accent-amber)', lineHeight: 1.7,
        }}>
          Proof-only disclosure requires a completed evaluation on this asset.
          Run an evaluation before creating a proof-only disclosure, or choose Full or Selective.
        </div>
      )}

      {level === 'selective' && !hasPepFields && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginTop: -8, marginBottom: 14,
          background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
          fontSize: 12, color: 'var(--accent-amber)', lineHeight: 1.7,
        }}>
          This asset has no PEP-parsed data yet. Selective disclosure requires parsed evidence fields.
          Run a PEP parse on the asset's evidence before creating a selective disclosure, or choose Full or Proof-only.
        </div>
      )}

      {!((level === 'selective' && !hasPepFields) || (level === 'proofonly' && !hasProofEval)) && (
        <>
          <FieldLabel label="Set expiration" />
          <ExpiryPicker expiry={expiry} setExpiry={setExpiry} customDate={customDate} setCustomDate={setCustomDate} />

          {hasCascadableAssets && (
            <>
              <FieldLabel label="Disclose connected assets?" />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.7 }}>
                If enabled, select assets connected to <strong style={{ color: 'var(--text-primary)' }}>{request.asset.name}</strong> can also be disclosed to <strong style={{ color: 'var(--text-primary)' }}>{request.from.name}</strong>, and {request.from.name} can evaluate those assets. You control which assets are disclosed to {request.from.name}, and their disclosure permissions. You can revoke any of your disclosures at any time.
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
                <ToggleCard
                  selected={cascadePolicy === 'open'}
                  onClick={() => setCascadePolicy('open')}
                  label="Open"
                  desc={`Select assets connected to ${request.asset.name} will be disclosed to ${request.from.name}.`}
                />
                <ToggleCard
                  selected={cascadePolicy === 'closed'}
                  onClick={() => setCascadePolicy('closed')}
                  label="Closed"
                  desc={`No assets connected to ${request.asset.name} will be disclosed to ${request.from.name}.`}
                />
              </div>
            </>
          )}

          <FieldLabel label="Disclosure summary" />
          <div style={{ padding: '16px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <InfoRow label="Asset" value={request.asset.name} />
            <InfoRow label="PIN" value={<CopyBadge value={request.asset.pin} truncated />} />
            <InfoRow label="To" value={request.from.name} />
            <InfoRow label="Disclosure type" value={
              <span style={{ color: SDA_TYPES[level]?.c, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
                {SDA_TYPES[level]?.short}
              </span>
            } />
            <InfoRow label="Expires" value={expiryLabel(expiry, customDate)} />
            {hasCascadableAssets && (
              <InfoRow label="Cascade policy" value={
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: cascadePolicy === 'open' ? 'var(--accent-green)' : 'var(--text-dim)' }}>
                  {cascadePolicy === 'open' ? 'Open' : 'Closed'}
                </span>
              } />
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
              This creates a bilateral disclosure recorded on-chain. {request.from.name} will be able to {level === 'full' ? 'access all data fields and run evaluations' : level === 'selective' ? 'access selected data fields and run evaluations on those fields' : 'see pass/fail results from your evaluations only'}.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Step 2b: Decline ─── */
function StepDecline({ reason, setReason, request }) {
  return (
    <div>
      <div style={{
        padding: '14px 16px',
        background: 'color-mix(in srgb, var(--accent-red) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)',
        borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 22,
      }}>
        <strong style={{ color: 'var(--accent-red)' }}>Declining</strong> will notify {request.from.name} that their request was rejected. This is recorded on-chain but does not prevent them from sending future requests.
      </div>
      <FieldLabel label="Reason (optional)" />
      <textarea
        value={reason} onChange={e => setReason(e.target.value)}
        placeholder="Optionally provide a reason for declining..."
        rows={4}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--bg-card)',
          color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
          resize: 'vertical', outline: 'none', lineHeight: 1.6,
        }}
      />
    </div>
  )
}

/* ─── Step 3: Cascade (optional) ─── */
function StepCascade({ request, node, level, selected, setSelected, upstreamAssets }) {
  const dsSDA = SDA_TYPES[level]

  return (
    <div>
      <div style={{
        padding: '14px 16px',
        background: `color-mix(in srgb, ${dsSDA?.c || 'var(--accent-amber)'} 6%, transparent)`,
        border: `1px solid color-mix(in srgb, ${dsSDA?.c || 'var(--accent-amber)'} 25%, transparent)`,
        borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dsSDA?.c || 'var(--accent-amber)', flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          You are creating a <LevelInline type={level} tip /> disclosure with {request.from.name} for {request.asset.name}.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <ChainIcon s={20} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Disclose connected assets?</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.7 }}>
        <div style={{ marginBottom: 12 }}>Cascading disclosures enable you to disclose your connected assets to other parties. Permissions are capped at the lesser of your disclosure agreements.</div>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>{request.asset.name}</strong> is connected to <strong style={{ color: 'var(--text-primary)' }}>{upstreamAssets.length}</strong> other assets that you can choose to include in this disclosure as Cascading Assets. Cascading Assets will be revealed to <strong style={{ color: 'var(--text-primary)' }}>{request.from.name}</strong>'s network under <strong style={{ color: 'var(--text-primary)' }}>{request.asset.name}</strong>.
        </div>
      </div>

      <UpstreamPicker assets={upstreamAssets} selected={selected} setSelected={setSelected} downstreamLevel={level} />
      <div style={{ marginTop: 18, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        Assets with a closed cascade policy cannot be forwarded. Contact the upstream owner to request a policy change.
      </div>
    </div>
  )
}

/* ─── Step: Field Selection (Selective Disclosure) ─── */
function StepFieldSelection({ pepFields, selectedFields, setSelectedFields, allFieldsSelected, setAllFieldsSelected }) {
  const totalCount = pepFields.length
  const selectedCount = selectedFields.size

  // Group fields by templateName then by category
  const grouped = useMemo(() => {
    const byTemplate = {}
    pepFields.forEach(f => {
      if (!byTemplate[f.templateName]) byTemplate[f.templateName] = []
      byTemplate[f.templateName].push(f)
    })
    return byTemplate
  }, [pepFields])

  const toggleField = (fieldKey) => {
    setSelectedFields(prev => {
      const next = new Set(prev)
      if (next.has(fieldKey)) next.delete(fieldKey)
      else next.add(fieldKey)
      setAllFieldsSelected(next.size === totalCount)
      return next
    })
  }

  const toggleTemplate = (templateFields) => {
    const keys = templateFields.map(f => f.fieldKey)
    const allSelected = keys.every(k => selectedFields.has(k))
    setSelectedFields(prev => {
      const next = new Set(prev)
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k))
      setAllFieldsSelected(next.size === totalCount)
      return next
    })
  }

  const toggleAll = () => {
    if (allFieldsSelected) {
      setSelectedFields(new Set())
      setAllFieldsSelected(false)
    } else {
      setSelectedFields(new Set(pepFields.map(f => f.fieldKey)))
      setAllFieldsSelected(true)
    }
  }

  return (
    <div>
      <div style={{
        padding: '14px 16px',
        background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
        borderRadius: 8, marginBottom: 20, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--accent-amber)' }}>Selective disclosure</strong> — choose which parsed fields to share. Withheld fields will not be visible to the receiving party.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {selectedCount} of {totalCount} fields selected
        </span>
        <span
          onClick={toggleAll}
          style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', cursor: 'pointer' }}
        >
          {allFieldsSelected ? 'Deselect All' : 'Select All'}
        </span>
      </div>

      {Object.entries(grouped).map(([templateName, fields]) => {
        const templateKeys = fields.map(f => f.fieldKey)
        const allInTemplate = templateKeys.every(k => selectedFields.has(k))
        const someInTemplate = templateKeys.some(k => selectedFields.has(k))

        // Sub-group by category
        const byCategory = {}
        fields.forEach(f => {
          if (!byCategory[f.category]) byCategory[f.category] = []
          byCategory[f.category].push(f)
        })

        return (
          <div key={templateName} style={{
            marginBottom: 16, background: 'var(--bg-card)', borderRadius: 8,
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {/* Template header */}
            <div
              onClick={() => toggleTemplate(fields)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', cursor: 'pointer',
                background: 'color-mix(in srgb, var(--accent-purple, #a78bfa) 5%, transparent)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 3,
                border: `2px solid ${allInTemplate ? 'var(--accent-purple, #a78bfa)' : 'var(--border)'}`,
                background: allInTemplate ? 'var(--accent-purple, #a78bfa)' : someInTemplate ? 'color-mix(in srgb, var(--accent-purple, #a78bfa) 30%, transparent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0,
              }}>
                {allInTemplate ? '✓' : someInTemplate ? '–' : ''}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {templateName}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                {templateKeys.filter(k => selectedFields.has(k)).length}/{templateKeys.length}
              </span>
            </div>

            {/* Fields grouped by category */}
            <div style={{ padding: '6px 0' }}>
              {Object.entries(byCategory).map(([catKey, catFields]) => {
                const catConfig = FIELD_CATEGORIES[catKey] || { label: catKey, color: 'var(--text-secondary)' }
                return (
                  <div key={catKey}>
                    <div style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: catConfig.color, letterSpacing: '0.06em',
                      padding: '6px 14px 2px',
                    }}>
                      {catConfig.label.toUpperCase()}
                    </div>
                    {catFields.map(f => {
                      const checked = selectedFields.has(f.fieldKey)
                      return (
                        <div
                          key={f.fieldKey}
                          onClick={() => toggleField(f.fieldKey)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '5px 14px', cursor: 'pointer',
                            transition: 'background 100ms',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 3%, transparent)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{
                            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                            border: `2px solid ${checked ? 'var(--accent-blue)' : 'var(--border)'}`,
                            background: checked ? 'var(--accent-blue)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color: '#fff', fontWeight: 700,
                          }}>
                            {checked ? '✓' : ''}
                          </span>
                          <span style={{ width: 130, flexShrink: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
                            {f.name}
                          </span>
                          <span style={{
                            flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {f.value?.length > 40 ? f.value.slice(0, 40) + '…' : f.value}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN MODAL
   ═══════════════════════════════════════════════════════════════════════ */
export default function DisclosureResponseModal({ request, assetNode, onClose, onComplete, _noBackdrop }) {
  const [step, setStep] = useState(0)
  const [decision, setDecision] = useState(null)
  const [level, setLevel] = useState('selective')
  const [expiry, setExpiry] = useState('1-year')
  const [customDate, setCustomDate] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [cascadePolicy, setCascadePolicy] = useState('closed')
  const [cascadeSelected, setCascadeSelected] = useState([])
  const [completed, setCompleted] = useState(false)
  const [selectedFields, setSelectedFields] = useState(new Set())
  const [allFieldsSelected, setAllFieldsSelected] = useState(true)
  const hasProofEval = false // No evaluations implemented yet

  // Collect all PEP fields from asset's parse children
  const pepFields = useMemo(() => {
    if (!assetNode?.children) return []
    return assetNode.children
      .filter(c => c.isParse || c.category === 'parse')
      .flatMap(pn => (pn.parsedFields || []).map(f => ({
        ...f, templateName: pn.name, parseNodeId: pn.id,
        fieldKey: `${pn.id}::${f.id}`,
      })))
  }, [assetNode])

  // Initialize all fields selected when pepFields changes
  useEffect(() => {
    if (pepFields.length > 0) {
      setSelectedFields(new Set(pepFields.map(f => f.fieldKey)))
      setAllFieldsSelected(true)
    }
  }, [pepFields])

  // Build upstream asset list from node's upstreamAssets (if node is provided)
  const node = request.node
  const upstreamAssets = useMemo(() => {
    const assets = node?.upstreamAssets || []
    return assets
      .filter(a => a.upstreamSda)
      .map(a => ({
        id: a.id,
        name: a.name,
        pin: a.pin || `PIN-${a.id}`,
        category: a.category || 'product',
        owner: a.upstreamSda.owner,
        ownerDot: a.upstreamSda.ownerDot,
        upstreamSdaType: a.upstreamSda.type,
        cascadePolicy: a.upstreamSda.policy,
        cascadeTo: request.from.name,
      }))
  }, [node, request.from.name])

  const hasCascadableAssets = upstreamAssets.some(a => a.cascadePolicy === 'open')
  const showCascadeStep = decision !== 'decline' && hasCascadableAssets && cascadePolicy === 'open'
  const showFieldStep = decision !== 'decline' && level === 'selective' && pepFields.length > 0

  const totalSteps = decision === 'decline' ? 2 : (2 + (showFieldStep ? 1 : 0) + (showCascadeStep ? 1 : 0))
  const effectiveLevel = level

  if (completed) {
    const isDecline = decision === 'decline'
    const completedContent = (
      <Modal width={620}>
        <div style={{ padding: '52px 36px', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: `color-mix(in srgb, ${isDecline ? 'var(--accent-red)' : cascadeSelected.length > 0 ? 'var(--accent-purple, #a78bfa)' : 'var(--accent-green)'} 12%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px',
            border: `2px solid ${isDecline ? 'var(--accent-red)' : cascadeSelected.length > 0 ? 'var(--accent-purple, #a78bfa)' : 'var(--accent-green)'}`,
          }}>
            {isDecline
              ? <span style={{ fontSize: 26, color: 'var(--accent-red)' }}>✕</span>
              : cascadeSelected.length > 0
                ? <ChainIcon s={28} />
                : <span style={{ fontSize: 26, color: 'var(--accent-green)' }}>✓</span>
            }
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
            {isDecline ? 'Request Declined' : 'Disclosure Created'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 28 }}>
            {isDecline
              ? <>{request.from.name} has been notified that their disclosure request was declined.</>
              : <>A <LevelInline type={effectiveLevel} tip /> disclosure has been created with {request.from.name} for {request.asset.name}{cascadeSelected.length > 0 ? `, including ${cascadeSelected.length} cascading asset${cascadeSelected.length !== 1 ? 's' : ''}` : ''}.</>
            }
          </div>
          {!isDecline && (
            <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28, textAlign: 'left' }}>
              <InfoRow label="Asset" value={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{request.asset.name}</span>
                  <CopyBadge value={request.asset.pin} truncated />
                </span>
              } />
              <InfoRow label="Party" value={request.from.name} />
              <InfoRow label="Disclosure type" value={
                <span style={{ color: SDA_TYPES[effectiveLevel]?.c, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
                  {SDA_TYPES[effectiveLevel]?.short}
                </span>
              } />
              <InfoRow label="Expires" value={expiryLabel(expiry, customDate)} />
              {cascadeSelected.length > 0 && (
                <InfoRow label="Cascading assets" value={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cascadeSelected.map(id => {
                      const a = upstreamAssets.find(x => x.id === id)
                      const eff = getEffectiveLevel(a?.upstreamSdaType, effectiveLevel)
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a?.name}</span>
                          <span style={{ color: 'var(--text-dim)' }}>({a?.owner})</span>
                          <SDABadge type={eff} tip />
                        </div>
                      )
                    })}
                  </div>
                } />
              )}
              {effectiveLevel === 'selective' && pepFields.length > 0 && (
                <InfoRow label="Disclosed fields" value={
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--accent-amber)' }}>
                    {selectedFields.size} of {pepFields.length}
                  </span>
                } />
              )}
              <InfoRow label="On-chain TX" value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>0x{Math.random().toString(16).slice(2, 6)}...pending</span>} />
            </div>
          )}
          <Btn label="Done" accent onClick={() => {
            if (onComplete) {
              onComplete(
                decision === 'decline' ? null : level,
                level === 'selective' && pepFields.length > 0 ? [...selectedFields] : null,
              )
            } else if (onClose) {
              onClose()
            }
          }} />
        </div>
      </Modal>
    )
    return _noBackdrop ? completedContent : <Backdrop onClose={onClose}>{completedContent}</Backdrop>
  }

  const currentStepNum = () => {
    if (step === 0) return 1
    if (decision === 'decline') return 2
    return step + 1
  }

  const formContent = (
    <Modal width={720}>
      <ModalHeader
        title="Disclosure Request"
        subtitle={`From ${request.from.name} · Received ${request.date}`}
        step={currentStepNum()}
        totalSteps={totalSteps}
        onClose={onClose}
      />
      <ModalBody>
        {step === 0 && <StepReview request={request} decision={decision} setDecision={setDecision} />}
        {step === 1 && decision === 'decline' && <StepDecline reason={declineReason} setReason={setDeclineReason} request={request} />}
        {step === 1 && decision !== 'decline' && (
          <StepTerms
            level={level} setLevel={setLevel}
            expiry={expiry} setExpiry={setExpiry}
            customDate={customDate} setCustomDate={setCustomDate}
            request={request} hasProofEval={hasProofEval}
            cascadePolicy={cascadePolicy} setCascadePolicy={setCascadePolicy}
            hasCascadableAssets={hasCascadableAssets}
            hasPepFields={pepFields.length > 0}
          />
        )}
        {step === 2 && decision !== 'decline' && showFieldStep && (
          <StepFieldSelection
            pepFields={pepFields}
            selectedFields={selectedFields}
            setSelectedFields={setSelectedFields}
            allFieldsSelected={allFieldsSelected}
            setAllFieldsSelected={setAllFieldsSelected}
          />
        )}
        {step === (showFieldStep ? 3 : 2) && decision !== 'decline' && showCascadeStep && (
          <StepCascade
            request={request} node={node} level={level}
            selected={cascadeSelected} setSelected={setCascadeSelected}
            upstreamAssets={upstreamAssets}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={() => {
            if (step === 1) { setStep(0); setDecision(null) }
            else setStep(step - 1)
          }} />}
          <StepDots current={currentStepNum() - 1} total={totalSteps} />
        </div>
        {step === 0 && !decision && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Choose a response above</div>}
        {step === 0 && decision && <Btn label={decision === 'decline' ? 'Next →' : 'Set Terms →'} accent onClick={() => setStep(1)} />}
        {step === 1 && decision === 'decline' && <Btn label="Decline Request" danger onClick={() => setCompleted(true)} />}
        {step === 1 && decision !== 'decline' && (
          showFieldStep
            ? <Btn label="Select Fields →" accent onClick={() => setStep(2)} />
            : level === 'selective' && pepFields.length === 0
              ? <Btn label="No PEP Data Available" disabled />
              : level === 'proofonly' && !hasProofEval
                ? <Btn label="No Evaluation Available" disabled />
                : showCascadeStep
                  ? <Btn label="Next — Cascade Assets →" accent onClick={() => setStep(2)} />
                  : <Btn label="Create Disclosure" accent onClick={() => setCompleted(true)} />
        )}
        {step === 2 && decision !== 'decline' && showFieldStep && (
          showCascadeStep
            ? <Btn label={`Disclose ${selectedFields.size} Fields — Next →`} accent disabled={selectedFields.size === 0} onClick={() => setStep(3)} />
            : <Btn label={`Disclose ${selectedFields.size} Fields`} accent disabled={selectedFields.size === 0} onClick={() => setCompleted(true)} />
        )}
        {step === (showFieldStep ? 3 : 2) && decision !== 'decline' && showCascadeStep && (
          <Btn
            label={cascadeSelected.length > 0 ? `Create Disclosure (${cascadeSelected.length} cascading)` : 'Skip — No Cascading Assets'}
            purple={cascadeSelected.length > 0}
            accent={cascadeSelected.length === 0}
            onClick={() => setCompleted(true)}
          />
        )}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
