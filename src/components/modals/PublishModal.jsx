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
        <strong style={{ color: 'var(--accent-amber)' }}>Publishing this asset</strong> will make it visible in the public asset directory. Other parties can see the asset name, type, owner, and registration date — but not your evidence or evaluation results. They must request disclosure to access anything further.
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
            {level === 'full' && <>Requestors will be able to <strong style={{ color: 'var(--text-primary)' }}>extract data fields</strong> and <strong style={{ color: 'var(--text-primary)' }}>run inference requirements</strong> against your evidence. This is the highest access level.</>}
            {level === 'selective' && <>Requestors will be able to <strong style={{ color: 'var(--text-primary)' }}>run inference requirements</strong> against your evidence but <strong style={{ color: 'var(--text-primary)' }}>cannot extract raw data</strong>. This protects sensitive specifics while allowing compliance verification.</>}
            {level === 'proofonly' && <>Requestors will only see the <strong style={{ color: 'var(--text-primary)' }}>pass/fail result</strong> of a completed evaluation. No access to the evidence is granted, and <strong style={{ color: 'var(--text-primary)' }}>no further evaluations can be run</strong> by other parties on this asset.</>}
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
        {level === 'selective' && pepFields && pepFields.length > 0 && (
          <InfoRow label="Disclosed fields" value={
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--accent-amber)' }}>
              {selectedFields?.size || 0} of {pepFields.length}
            </span>
          } />
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
        <InfoRow label="Visibility" value="Public asset directory" />
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
  const needsFieldStep = level === 'selective' && pepFields.length > 0
  const needsEvalStep = level === 'proofonly'
  const totalSteps = 3 + (needsFieldStep ? 1 : 0) + (needsEvalStep ? 1 : 0)

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
    if (step === 1) {
      if (needsFieldStep) setStep(2)
      else if (needsEvalStep) setStep(3)
      else setStep(4)
    } else if (step === 2 && needsFieldStep) {
      setStep(4)
    } else if (step === 3 && needsEvalStep) {
      setStep(4)
    } else {
      setStep(step + 1)
    }
  }
  const prevStep = () => {
    if (step === 4) {
      if (needsFieldStep) setStep(2)
      else if (needsEvalStep) setStep(3)
      else setStep(1)
    } else if (step === 3 && needsEvalStep) {
      setStep(1)
    } else if (step === 2 && needsFieldStep) {
      setStep(1)
    } else {
      setStep(step - 1)
    }
  }
  const currentStepNum = () => {
    if (step === 0) return 1
    if (step === 1) return 2
    if (step === 2 && needsFieldStep) return 3
    if (step === 3 && needsEvalStep) return 3
    if (step === 4) return needsFieldStep || needsEvalStep ? 4 : 3
    return step + 1
  }

  const handlePublish = () => {
    onComplete?.({
      assetId: node.id,
      assetName: node.name,
      assetPin: node.pin,
      disclosureType: level,
      selectedEvals: level === 'proofonly' ? selectedEvals : null,
      selectedFields: level === 'selective' ? [...selectedFields] : null,
      expiry,
      customDate,
    })
    setPublished(true)
  }

  if (isAlreadyPublished) {
    const existingSda = (node.sdas || []).find(s => s.party === 'Radiant Network')
    const alreadyContent = (
      <Modal width={540}>
        <ModalHeader title="Already Published" onClose={onClose} />
        <ModalBody>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'color-mix(in srgb, var(--accent-sky) 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', border: '2px solid var(--accent-sky)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sky)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
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
            <strong style={{ color: 'var(--text-primary)' }}>{asset.name}</strong> is now discoverable in the public asset directory with <strong style={{ color: SDA_TYPES[level]?.c || 'var(--accent-indigo)' }}>{SDA_TYPES[level]?.label || '—'}</strong> access.
          </div>
          <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28, textAlign: 'left' }}>
            <InfoRow label="PIN" value={<CopyBadge value={asset.pin} truncated />} />
            <InfoRow label="Permission" value={<span style={{ color: SDA_TYPES[level]?.c, fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{SDA_TYPES[level]?.short}</span>} />
            {level === 'selective' && pepFields.length > 0 && (
              <InfoRow label="Disclosed fields" value={
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--accent-amber)' }}>
                  {selectedFields.size} of {pepFields.length}
                </span>
              } />
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
      <ModalHeader title="Disclose to Directory" subtitle="Make this asset discoverable on the Radiant Network." step={currentStepNum()} totalSteps={totalSteps} onClose={onClose} />
      <ModalBody>
        {step === 0 && <StepConfirm asset={asset} isPublishReady={isPublishReady} />}
        {step === 1 && <StepPermission level={level} setLevel={setLevel} hasProofEval={hasProofEval} />}
        {step === 2 && needsFieldStep && (
          <StepFieldSelection
            pepFields={pepFields}
            selectedFields={selectedFields}
            setSelectedFields={setSelectedFields}
            allFieldsSelected={allFieldsSelected}
            setAllFieldsSelected={setAllFieldsSelected}
          />
        )}
        {step === 3 && needsEvalStep && <StepEvalSelect evals={completedEvals} selected={selectedEvals} setSelected={setSelectedEvals} />}
        {step === 4 && <StepExpiry expiry={expiry} setExpiry={setExpiry} customDate={customDate} setCustomDate={setCustomDate} level={level} asset={asset} selectedEvals={selectedEvals} pepFields={pepFields} selectedFields={selectedFields} />}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={prevStep} />}
          <StepDots current={currentStepNum() - 1} total={totalSteps} />
        </div>
        {step === 0 && <Btn label="Next →" accent disabled={!isPublishReady} onClick={() => setStep(1)} />}
        {step === 1 && <Btn label="Next →" accent disabled={!level || (level === 'proofonly' && !hasProofEval)} onClick={nextStep} />}
        {step === 2 && needsFieldStep && (
          <Btn label={`Disclose ${selectedFields.size} Fields →`} accent disabled={selectedFields.size === 0} onClick={nextStep} />
        )}
        {step === 3 && needsEvalStep && <Btn label="Next →" accent disabled={selectedEvals.length === 0} onClick={nextStep} />}
        {step === 4 && <Btn label="Disclose to Directory" accent onClick={handlePublish} />}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
