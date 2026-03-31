import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow, CopyBadge,
  SDATypeCard, ExpiryPicker, expiryLabel, SDA_TYPES,
} from './ModalShared'
import { StepFieldSelection } from './DisclosureResponseModal'

const CATEGORY_ICONS = { person: '●', place: '◆', process: '◎', product: '■', party: '⬡' }
const CATEGORY_COLORS = { person: 'var(--accent-cyan)', place: 'var(--accent-green)', process: 'var(--accent-amber)', product: 'var(--accent-blue)', party: 'var(--accent-indigo)' }

/* ─── Step 1: Confirm asset ─── */
function StepConfirm({ asset, isPublishReady }) {
  const catColor = CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.product
  const catIcon = CATEGORY_ICONS[asset.category] || '■'
  const h = asset.health || { ok: 0, warn: 0, bad: 0 }
  return (
    <div>
      <div style={{ padding: 18, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: catColor }}>{catIcon}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: catColor, letterSpacing: '0.06em' }}>{asset.category.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{asset.name}</div>
        <div style={{ marginBottom: 14 }}><CopyBadge value={asset.pin} truncated /></div>
        <InfoRow label="Owner" value={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{asset.owner}<CopyBadge value={asset.dot} truncated /></span>} />
        <InfoRow label="Health" value={
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
            <span style={{ color: 'var(--accent-green)' }}>{h.ok} satisfactory</span>
            {h.warn > 0 && <span style={{ color: 'var(--text-dim)' }}> · {h.warn} missing</span>}
            <span style={{ color: 'var(--accent-red)' }}> · {h.bad} unsatisfactory</span>
          </span>
        } />
        <InfoRow label="Children" value={asset.childCount > 0 ? `${asset.childCount} sub-assets` : 'None'} />
        <InfoRow label="Evidence" value={asset.hasEvidence ? <span style={{ color: 'var(--accent-green)' }}>Attached</span> : <span style={{ color: 'var(--text-dim)' }}>None</span>} />
      </div>
      {!isPublishReady && (
        <div style={{
          padding: '14px 16px',
          background: 'color-mix(in srgb, var(--accent-red) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)',
          borderRadius: 8, fontSize: 12, color: 'var(--accent-red)', lineHeight: 1.7,
          marginBottom: 14,
        }}>
          This asset cannot be published yet. Add evidence and run a PEP parse before publishing to the directory.
        </div>
      )}
      <div style={{
        padding: '14px 16px',
        background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
        borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--accent-amber)' }}>Publishing this asset</strong> will make it visible on the Radiant Network Public Directory. Other parties can see the asset name, type, owner, and registration date — but not your evidence or evaluation results. They must request disclosure to access anything further.
      </div>
    </div>
  )
}

/* ─── Step 2: Permission level ─── */
function StepPermission({ level, setLevel, hasProofEval }) {
  return (
    <div>
      <FieldLabel label="Choose access level for disclosure requests" />
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.7 }}>
        When a party requests disclosure, this is the maximum access level they can receive. You can always downgrade on a per-request basis.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <SDATypeCard type="full" selected={level} onSelect={setLevel} />
        <SDATypeCard type="selective" selected={level} onSelect={setLevel} />
        <SDATypeCard type="proofonly" selected={level} onSelect={setLevel} />
      </div>
      {level === 'proofonly' && !hasProofEval && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginTop: 14,
          background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
          fontSize: 12, color: 'var(--accent-amber)', lineHeight: 1.7,
        }}>
          Proof-only disclosure requires a completed evaluation on this asset.
          Run an evaluation before creating a proof-only disclosure, or choose Full or Selective.
        </div>
      )}
      {level && (
        <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
            {level === 'full' && <><strong style={{ color: 'var(--accent-red)' }}>Full disclosure</strong> exposes all of your asset's evidence to the Radiant Network Public Directory. Any party can <strong style={{ color: 'var(--text-primary)' }}>extract data fields</strong>, <strong style={{ color: 'var(--text-primary)' }}>run evaluations</strong>, and view all parsed data without restriction. Only choose this if the asset contains no proprietary or sensitive information.</>}
            {level === 'selective' && <><strong style={{ color: 'var(--accent-amber)' }}>Selective disclosure</strong> lets you choose which parsed fields to share. Requestors can <strong style={{ color: 'var(--text-primary)' }}>run evaluations</strong> against disclosed fields but <strong style={{ color: 'var(--text-primary)' }}>cannot access withheld data</strong>. This protects sensitive specifics while allowing compliance verification.</>}
            {level === 'proofonly' && <><strong style={{ color: 'var(--accent-green)' }}>Proof-only disclosure</strong> shares only the <strong style={{ color: 'var(--text-primary)' }}>pass/fail result</strong> of completed evaluations. No evidence, parsed data, or evaluation details are accessible. This is the most restrictive access level.</>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Step 3: Eval select (proof-only only) ─── */
function StepEvalSelect({ evals, selected, setSelected }) {
  const toggle = (ev) => {
    setSelected(prev => {
      const exists = prev.find(e => e.id === ev.id)
      return exists ? prev.filter(e => e.id !== ev.id) : [...prev, ev]
    })
  }
  return (
    <div>
      <FieldLabel label="Select evaluation(s) to share" />
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.7 }}>
        Proof-only disclosure shares the pass/fail result from completed evaluations. Select one or more evaluations to include in this listing.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {evals.map(ev => {
          const active = !!selected.find(e => e.id === ev.id)
          const claims = ev.claims || []
          const ok = claims.filter(c => c.status === 'verified' || c.status === 'satisfactory').length
          const bad = claims.filter(c => c.status === 'contested' || c.status === 'failed' || c.status === 'unsatisfactory').length
          const miss = claims.filter(c => c.status === 'missing').length
          return (
            <div key={ev.id} onClick={() => toggle(ev)} style={{
              padding: '16px 18px', borderRadius: 8,
              border: `1.5px solid ${active ? 'var(--accent-green)' : 'var(--border)'}`,
              background: active ? 'color-mix(in srgb, var(--accent-green) 5%, transparent)' : 'var(--bg-card)',
              cursor: 'pointer', transition: 'all 150ms',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                border: `1.5px solid ${active ? 'var(--accent-green)' : 'var(--border)'}`,
                background: active ? 'var(--accent-green)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms', flexShrink: 0, marginTop: 1,
              }}>
                {active && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{ev.requirements}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{ev.date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>by {ev.org}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{ok} satisfactory</span>
                  {bad > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>{bad} unsatisfactory</span>}
                  {miss > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{miss} missing</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Step 4: Expiry + review ─── */
function StepExpiry({ expiry, setExpiry, customDate, setCustomDate, level, asset, selectedEvals, pepFields, selectedFields }) {
  return (
    <div>
      <FieldLabel label="Set expiration" />
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.7 }}>
        How long should this listing remain active in the directory? You can revoke at any time regardless of the expiration date.
      </div>
      <ExpiryPicker expiry={expiry} setExpiry={setExpiry} customDate={customDate} setCustomDate={setCustomDate} />
      <div style={{ padding: '18px 20px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em', marginBottom: 14 }}>REVIEW</div>
        <InfoRow label="Asset" value={<span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{asset.name}</span>} />
        <InfoRow label="PIN" value={<CopyBadge value={asset.pin} truncated />} />
        <InfoRow label="Permission" value={<span style={{ color: SDA_TYPES[level]?.c, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>{SDA_TYPES[level]?.short}</span>} />
        {level === 'selective' && selectedFields && selectedFields.size > 0 && (
          <>
            <InfoRow label="Disclosed fields" value={
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--accent-amber)' }}>
                {selectedFields.size} of {pepFields.length}
              </span>
            } />
            <div style={{
              maxHeight: 140, overflowY: 'auto', marginTop: 4, marginBottom: 8,
              padding: '8px 12px', borderRadius: 6,
              background: 'var(--bg-deep)', border: '1px solid var(--border)',
            }}>
              {[...selectedFields].map(fieldKey => {
                const field = pepFields.find(f => f.fieldKey === fieldKey)
                return field ? (
                  <div key={fieldKey} style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                    padding: '3px 0', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ color: 'var(--text-dim)', width: 90, flexShrink: 0 }}>{field.category || '—'}</span>
                    <span>{field.label || field.id}</span>
                  </div>
                ) : null
              })}
            </div>
          </>
        )}
        {level === 'proofonly' && selectedEvals.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 34, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)', paddingLeft: 4, paddingTop: 8 }}>Evaluation(s)</div>
            <div style={{ flex: 1, paddingTop: 6, paddingBottom: 6 }}>
              {selectedEvals.map((ev, i) => <div key={i} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', lineHeight: 1.8 }}>{ev.requirements} ({ev.org})</div>)}
            </div>
          </div>
        )}
        <InfoRow label="Expiration" value={expiryLabel(expiry, customDate)} />
        <InfoRow label="Visibility" value="Radiant Network Public Directory" />
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          Publishing is recorded on-chain and cannot be undone, but the listing can be revoked at any time. Revocation removes the asset from the directory and prevents new disclosure requests.
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN MODAL
   ═══════════════════════════════════════════════════════════════════════ */
export default function PublishModal({ node, onClose, onComplete, _noBackdrop }) {
  // Capture on mount — won't change when SDA is added mid-flow
  const wasAlreadyPublished = useRef(
    (node?.sdas || []).some(s => s.party === 'Radiant Network')
  )
  const isAlreadyPublished = wasAlreadyPublished.current

  const [step, setStep] = useState(0)
  const [level, setLevel] = useState(null)
  const [selectedEvals, setSelectedEvals] = useState([])
  const [expiry, setExpiry] = useState('1-year')
  const [customDate, setCustomDate] = useState('')
  const [published, setPublished] = useState(false)
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState(new Set())

  const evidenceNodes = useMemo(() => {
    if (!node?.children) return []
    return node.children.filter(c => c.isEvidence)
  }, [node])

  useEffect(() => {
    if (evidenceNodes.length > 0) {
      setSelectedEvidenceIds(new Set(evidenceNodes.map(e => e.id)))
    }
  }, [evidenceNodes])

  const completedEvals = useMemo(() => {
    return (node.children || [])
      .filter(c => c.isEvaluation || c.category === 'evaluation')
      .filter(c => c.status === 'completed')
      .map(ev => ({
        id: ev.id,
        org: ev.evaluatorParty || ev.owner,
        date: ev.date,
        requirements: ev.requirementSetName || ev.name,
        status: ev.status,
        claims: ev.claims || [],
      }))
  }, [node])

  const pepFields = useMemo(() => {
    if (!node?.children) return []
    return node.children
      .filter(c => c.isParse || c.category === 'parse')
      .flatMap(pn => (pn.parsedFields || []).map(f => ({
        ...f, templateName: pn.name, parseNodeId: pn.id,
        fieldKey: `${pn.id}::${f.id}`,
      })))
  }, [node])

  const [selectedFields, setSelectedFields] = useState(new Set())
  const [allFieldsSelected, setAllFieldsSelected] = useState(true)

  useEffect(() => {
    if (pepFields.length > 0) {
      setSelectedFields(new Set(pepFields.map(f => f.fieldKey)))
      setAllFieldsSelected(true)
    }
  }, [pepFields])

  const hasProofEval = completedEvals.length > 0
  const needsEvidenceStep = evidenceNodes.length > 0
  const needsFieldStep = level === 'selective' && pepFields.length > 0
  const needsEvalStep = level === 'proofonly'

  const STEP_CONFIRM = 0
  const STEP_EVIDENCE = needsEvidenceStep ? 1 : -1
  const STEP_PERMISSION = needsEvidenceStep ? 2 : 1
  const STEP_FIELDS = needsFieldStep ? STEP_PERMISSION + 1 : -1
  const STEP_EVALS = needsEvalStep ? (STEP_FIELDS >= 0 ? STEP_FIELDS + 1 : STEP_PERMISSION + 1) : -1
  const STEP_EXPIRY = Math.max(STEP_PERMISSION, STEP_FIELDS, STEP_EVALS) + 1
  const totalSteps = STEP_EXPIRY + 1

  const hasChildren = node.children && node.children.length > 0
  const hasParsedData = node.children?.some(c => c.isParse || c.category === 'parse')
  const isPublishReady = hasChildren && hasParsedData

  const asset = {
    name: node.name,
    pin: node.pin || 'PIN-0x0000...0000',
    category: node.category || 'product',
    owner: node.owner || 'Unknown',
    dot: node.dot || 'DOT-0x0000...0000',
    health: node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 },
    childCount: node.children?.length || 0,
    hasEvidence: !!node.hasEvidence,
    evaluations: completedEvals,
  }

  const nextStep = () => {
    if (step === STEP_CONFIRM) setStep(needsEvidenceStep ? STEP_EVIDENCE : STEP_PERMISSION)
    else if (step === STEP_EVIDENCE) setStep(STEP_PERMISSION)
    else if (step === STEP_PERMISSION) {
      if (needsFieldStep) setStep(STEP_FIELDS)
      else if (needsEvalStep) setStep(STEP_EVALS)
      else setStep(STEP_EXPIRY)
    }
    else if (step === STEP_FIELDS) setStep(STEP_EXPIRY)
    else if (step === STEP_EVALS) setStep(STEP_EXPIRY)
    else setStep(step + 1)
  }
  const prevStep = () => {
    if (step === STEP_EXPIRY) {
      if (needsFieldStep) setStep(STEP_FIELDS)
      else if (needsEvalStep) setStep(STEP_EVALS)
      else setStep(STEP_PERMISSION)
    }
    else if (step === STEP_EVALS) setStep(STEP_PERMISSION)
    else if (step === STEP_FIELDS) setStep(STEP_PERMISSION)
    else if (step === STEP_PERMISSION) setStep(needsEvidenceStep ? STEP_EVIDENCE : STEP_CONFIRM)
    else if (step === STEP_EVIDENCE) setStep(STEP_CONFIRM)
    else setStep(step - 1)
  }
  const currentStepNum = () => step + 1

  const handlePublish = () => {
    onComplete?.({
      assetId: node.id,
      assetName: node.name,
      assetPin: node.pin,
      disclosureType: level,
      selectedEvals: level === 'proofonly' ? selectedEvals : null,
      selectedFields: level === 'selective' ? [...selectedFields] : null,
      selectedEvidenceIds: [...selectedEvidenceIds],
      expiry,
      customDate,
    })
    setPublished(true)
  }

  if (isAlreadyPublished) {
    const existingSda = (node.sdas || []).find(s => s.party === 'Radiant Network')
    const alreadyContent = (
      <Modal width={540}>
        <ModalHeader title="Already Published" subtitle="Radiant Network Public Directory" onClose={onClose} />
        <ModalBody>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', border: '2px solid var(--accent-green)',
            }}>
              <span style={{ fontSize: 26, color: 'var(--accent-green)' }}>✓</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{node.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 24 }}>
              This asset is already listed in the Radiant Network public directory.
            </div>
          </div>
          <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <InfoRow label="PIN" value={<CopyBadge value={node.pin} truncated />} />
            <InfoRow label="Disclosure" value={
              <span style={{ color: SDA_TYPES[existingSda?.type]?.c || 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
                {SDA_TYPES[existingSda?.type]?.short || existingSda?.type || '—'}
              </span>
            } />
            {existingSda?.created && <InfoRow label="Published" value={existingSda.created} />}
          </div>
          <div style={{
            marginTop: 16, padding: '14px 16px',
            background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
            borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
          }}>
            To change the disclosure type or remove this listing, use the <strong style={{ color: 'var(--text-primary)' }}>Disclosures</strong> tab in the detail panel.
          </div>
        </ModalBody>
        <ModalFooter>
          <div />
          <Btn label="Done" accent onClick={onClose} />
        </ModalFooter>
      </Modal>
    )
    return _noBackdrop ? alreadyContent : <Backdrop onClose={onClose}>{alreadyContent}</Backdrop>
  }

  if (published) {
    const publishedContent = (
      <Modal width={540}>
        <div style={{ padding: '52px 36px', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px', border: '2px solid var(--accent-green)',
          }}>
            <span style={{ fontSize: 26, color: 'var(--accent-green)' }}>✓</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Asset Published</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 28 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{asset.name}</strong> is now listed on the <strong>Radiant Network Public Directory</strong> with <strong style={{ color: SDA_TYPES[level]?.c || 'var(--accent-indigo)' }}>{SDA_TYPES[level]?.label || '—'}</strong> access.
          </div>
          <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28, textAlign: 'left' }}>
            <InfoRow label="PIN" value={<CopyBadge value={asset.pin} truncated />} />
            <InfoRow label="Permission" value={<span style={{ color: SDA_TYPES[level]?.c, fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{SDA_TYPES[level]?.short}</span>} />
            {level === 'selective' && selectedFields.size > 0 && (
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <InfoRow label="Disclosed fields" value={
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--accent-amber)' }}>
                    {selectedFields.size} of {pepFields.length}
                  </span>
                } />
                <div style={{
                  maxHeight: 120, overflowY: 'auto', marginTop: 4,
                  padding: '6px 10px', borderRadius: 6,
                  background: 'var(--bg-deep)', border: '1px solid var(--border)',
                }}>
                  {[...selectedFields].map(fieldKey => {
                    const field = pepFields.find(f => f.fieldKey === fieldKey)
                    return field ? (
                      <div key={fieldKey} style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                        padding: '2px 0',
                      }}>
                        {field.label || field.id}
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}
            {level === 'proofonly' && selectedEvals.length > 0 && (
              <InfoRow label="Evaluation(s)" value={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {selectedEvals.map((ev, i) => <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{ev.requirements} ({ev.org})</span>)}
                </div>
              } />
            )}
            <InfoRow label="Expires" value={expiryLabel(expiry, customDate)} />
            <InfoRow label="On-chain TX" value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>0x7f3a...pending confirmation</span>} />
          </div>
          <Btn label="Done" accent onClick={onClose} />
        </div>
      </Modal>
    )
    return _noBackdrop ? publishedContent : <Backdrop onClose={onClose}>{publishedContent}</Backdrop>
  }

  const formContent = (
    <Modal>
      <ModalHeader title="Publish to Directory" subtitle="Radiant Network Public Directory" step={currentStepNum()} totalSteps={totalSteps} onClose={onClose} />
      <ModalBody>
        {step === STEP_CONFIRM && <StepConfirm asset={asset} isPublishReady={isPublishReady} />}
        {step === STEP_EVIDENCE && needsEvidenceStep && (
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-orange)', letterSpacing: '0.05em', marginBottom: 12 }}>SELECT EVIDENCE TO PUBLISH</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.7 }}>
              Choose which evidence files to include in this directory listing.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEvidenceIds.size} of {evidenceNodes.length} selected</span>
              <span onClick={() => {
                if (selectedEvidenceIds.size === evidenceNodes.length) setSelectedEvidenceIds(new Set())
                else setSelectedEvidenceIds(new Set(evidenceNodes.map(e => e.id)))
              }} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', cursor: 'pointer' }}>
                {selectedEvidenceIds.size === evidenceNodes.length ? 'Deselect All' : 'Select All'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evidenceNodes.map(ev => {
                const checked = selectedEvidenceIds.has(ev.id)
                const isParsed = node.children?.some(c => (c.isParse || c.category === 'parse') && c.sourceEvidenceId === ev.id)
                return (
                  <div key={ev.id} onClick={() => {
                    setSelectedEvidenceIds(prev => { const next = new Set(prev); if (next.has(ev.id)) next.delete(ev.id); else next.add(ev.id); return next })
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${checked ? 'var(--accent-orange)' : 'var(--border)'}`,
                    background: checked ? 'color-mix(in srgb, var(--accent-orange) 4%, transparent)' : 'var(--bg-card)', transition: 'all 150ms',
                  }}>
                    <span style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `2px solid ${checked ? 'var(--accent-orange)' : 'var(--border)'}`, background: checked ? 'var(--accent-orange)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {checked && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>&#10003;</span>}
                    </span>
                    <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-orange)' }}>EV</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{ev.name}</div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: isParsed ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'var(--bg-raised)', color: isParsed ? 'var(--accent-green)' : 'var(--text-dim)' }}>{isParsed ? 'PARSED' : 'UNPARSED'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {step === STEP_PERMISSION && <StepPermission level={level} setLevel={setLevel} hasProofEval={hasProofEval} />}
        {step === STEP_FIELDS && needsFieldStep && (
          <StepFieldSelection
            pepFields={pepFields}
            selectedFields={selectedFields}
            setSelectedFields={setSelectedFields}
            allFieldsSelected={allFieldsSelected}
            setAllFieldsSelected={setAllFieldsSelected}
          />
        )}
        {step === STEP_EVALS && needsEvalStep && <StepEvalSelect evals={completedEvals} selected={selectedEvals} setSelected={setSelectedEvals} />}
        {step === STEP_EXPIRY && <StepExpiry expiry={expiry} setExpiry={setExpiry} customDate={customDate} setCustomDate={setCustomDate} level={level} asset={asset} selectedEvals={selectedEvals} pepFields={pepFields} selectedFields={selectedFields} />}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={prevStep} />}
          <StepDots current={currentStepNum() - 1} total={totalSteps} />
        </div>
        {step === STEP_CONFIRM && <Btn label="Next →" accent disabled={!isPublishReady} onClick={nextStep} />}
        {step === STEP_EVIDENCE && needsEvidenceStep && <Btn label={`${selectedEvidenceIds.size} Evidence — Set Access Level →`} accent disabled={selectedEvidenceIds.size === 0} onClick={nextStep} />}
        {step === STEP_PERMISSION && <Btn label="Next →" accent disabled={!level || (level === 'proofonly' && !hasProofEval)} onClick={nextStep} />}
        {step === STEP_FIELDS && needsFieldStep && (
          <Btn label={`Publish ${selectedFields.size} Fields →`} accent disabled={selectedFields.size === 0} onClick={nextStep} />
        )}
        {step === STEP_EVALS && needsEvalStep && <Btn label="Next →" accent disabled={selectedEvals.length === 0} onClick={nextStep} />}
        {step === STEP_EXPIRY && <Btn label="Publish to Directory" accent onClick={handlePublish} />}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
