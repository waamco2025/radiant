import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow, CopyBadge,
  SDATypeCard, ExpiryPicker, expiryLabel, SDA_TYPES, ToggleCard,
} from './ModalShared'

const CATEGORY_ICONS = { person: '●', place: '◆', process: '◎', product: '■', party: '⬡' }
const CATEGORY_COLORS = { person: 'var(--accent-cyan)', place: 'var(--accent-green)', process: 'var(--accent-amber)', product: 'var(--accent-blue)', party: 'var(--accent-indigo)' }

/* ─── Step 1: Confirm asset ─── */
function StepConfirm({ asset }) {
  const catColor = CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.product
  const catIcon = CATEGORY_ICONS[asset.category] || '■'
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
          <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
            {asset.health.ok} verified · {asset.health.bad} failed
          </span>
        } />
        <InfoRow label="Children" value={asset.childCount > 0 ? `${asset.childCount} sub-assets` : 'None'} />
        <InfoRow label="Evidence" value={asset.hasEvidence ? <span style={{ color: 'var(--accent-green)' }}>Attached</span> : <span style={{ color: 'var(--text-dim)' }}>None</span>} />
      </div>
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
        <SDATypeCard type="proofonly" selected={level} onSelect={setLevel}
          disabled={!hasProofEval}
          disabledReason={hasProofEval ? null : 'No completed evaluations exist for this asset. Run at least one evaluation before offering proof-only disclosure.'}
        />
      </div>
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
          const ok = claims.filter(c => c.status === 'verified').length
          const bad = claims.filter(c => c.status !== 'verified').length
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
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{ok} verified</span>
                  {bad > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>{bad} failed</span>}
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
function StepExpiry({ expiry, setExpiry, customDate, setCustomDate, level, asset, selectedEvals, cascadePolicy, setCascadePolicy }) {
  return (
    <div>
      <FieldLabel label="Disclose connected assets?" />
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.7 }}>
        If enabled, select assets connected to <strong style={{ color: 'var(--text-primary)' }}>{asset.name}</strong> can also be disclosed to parties who request access, and those parties can evaluate the connected assets. You control which assets are disclosed, and their disclosure permissions. You can revoke any of your disclosures at any time.
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        <ToggleCard
          selected={cascadePolicy === 'open'}
          onClick={() => setCascadePolicy('open')}
          label="Open"
          desc={`Select assets connected to ${asset.name} can also be disclosed to requesting parties.`}
        />
        <ToggleCard
          selected={cascadePolicy === 'closed'}
          onClick={() => setCascadePolicy('closed')}
          label="Closed"
          desc={`No assets connected to ${asset.name} will be disclosed to requesting parties.`}
        />
      </div>

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
        {level === 'proofonly' && selectedEvals.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 34, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)', paddingLeft: 4, paddingTop: 8 }}>Evaluation(s)</div>
            <div style={{ flex: 1, paddingTop: 6, paddingBottom: 6 }}>
              {selectedEvals.map((ev, i) => <div key={i} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', lineHeight: 1.8 }}>{ev.requirements} ({ev.org})</div>)}
            </div>
          </div>
        )}
        <InfoRow label="Expiration" value={expiryLabel(expiry, customDate)} />
        <InfoRow label="Cascade policy" value={
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: cascadePolicy === 'open' ? 'var(--accent-green)' : 'var(--text-dim)' }}>
            {cascadePolicy === 'open' ? 'Open' : 'Closed'}
          </span>
        } />
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
export default function PublishModal({ node, onClose, _noBackdrop }) {
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState(null)
  const [selectedEvals, setSelectedEvals] = useState([])
  const [expiry, setExpiry] = useState('1-year')
  const [customDate, setCustomDate] = useState('')
  const [cascadePolicy, setCascadePolicy] = useState('closed')
  const [published, setPublished] = useState(false)

  const completedEvals = node.evaluations?.filter(e => e.status === 'completed') || []
  const hasProofEval = completedEvals.length > 0
  const needsEvalStep = level === 'proofonly'
  const totalSteps = needsEvalStep ? 4 : 3

  const asset = {
    name: node.name,
    pin: node.pin || 'PIN-0x0000...0000',
    category: node.category || 'product',
    owner: node.owner || 'Unknown',
    dot: node.dot || 'DOT-0x0000...0000',
    health: node.health || { ok: 0, bad: 0 },
    childCount: node.children?.length || 0,
    hasEvidence: !!node.hasEvidence,
    evaluations: completedEvals,
  }

  const nextStep = () => {
    if (step === 1 && !needsEvalStep) setStep(step + 2)
    else setStep(step + 1)
  }
  const prevStep = () => {
    if (step === 3 && !needsEvalStep) setStep(1)
    else setStep(step - 1)
  }
  const currentStepNum = () => {
    if (!needsEvalStep && step === 3) return 3
    return step + 1
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
      <ModalHeader title="Publish to Directory" subtitle="Make this asset discoverable to all parties on the network." step={currentStepNum()} totalSteps={totalSteps} onClose={onClose} />
      <ModalBody>
        {step === 0 && <StepConfirm asset={asset} />}
        {step === 1 && <StepPermission level={level} setLevel={setLevel} hasProofEval={hasProofEval} />}
        {step === 2 && <StepEvalSelect evals={completedEvals} selected={selectedEvals} setSelected={setSelectedEvals} />}
        {step === 3 && <StepExpiry expiry={expiry} setExpiry={setExpiry} customDate={customDate} setCustomDate={setCustomDate} level={level} asset={asset} selectedEvals={selectedEvals} cascadePolicy={cascadePolicy} setCascadePolicy={setCascadePolicy} />}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={prevStep} />}
          <StepDots current={step === 3 ? (needsEvalStep ? 3 : 2) : step} total={totalSteps} />
        </div>
        {step === 0 && <Btn label="Next →" accent onClick={() => setStep(1)} />}
        {step === 1 && <Btn label="Next →" accent disabled={!level} onClick={nextStep} />}
        {step === 2 && <Btn label="Next →" accent disabled={selectedEvals.length === 0} onClick={() => setStep(3)} />}
        {step === 3 && <Btn label="Publish to Directory" accent onClick={() => setPublished(true)} />}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
