import { useState, useEffect, useMemo } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow, CopyBadge,
  SDATypeCard, DecisionCard, ExpiryPicker, expiryLabel, SDA_TYPES,
  ToggleCard, LevelInline, SDABadge, ChainIcon, getEffectiveLevel,
} from './ModalShared'
import UpstreamPicker from './UpstreamPicker'

/* ─── Step 1: Review request + decide ─── */
function StepReview({ request, decision, setDecision }) {
  const order = ['full', 'selective', 'proofonly']
  const reqIdx = order.indexOf(request.requestedLevel)
  const hasCounterOptions = reqIdx < order.length - 1

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
            <CopyBadge value={request.from.dot} />
          </div>
        </div>
        <InfoRow label="Requesting asset" value={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{request.asset.name}</span>
            <CopyBadge value={request.asset.pin} />
          </span>
        } />
        <InfoRow label="Requested level" value={
          <span style={{ color: SDA_TYPES[request.requestedLevel]?.c, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
            {SDA_TYPES[request.requestedLevel]?.short}
          </span>
        } />
        <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 34, borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)', paddingLeft: 4, paddingTop: 8 }}>Requirements</div>
          <div style={{ flex: 1, paddingTop: 6, paddingBottom: 6 }}>
            {request.requirements.map((r, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>{r}</div>)}
          </div>
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
          desc={`Grant ${SDA_TYPES[request.requestedLevel]?.label} access as requested`}
          color="var(--accent-green)" icon="✓"
          active={decision === 'accept'} onClick={() => setDecision('accept')}
        />
        <DecisionCard
          id="counter" label="Counter"
          desc={hasCounterOptions ? 'Counter with a lower access level instead' : 'No lower permission levels are available'}
          color="var(--accent-amber)" icon="⇋"
          disabled={!hasCounterOptions}
          active={decision === 'counter'} onClick={() => setDecision('counter')}
        />
        <DecisionCard
          id="decline" label="Decline"
          desc="Reject this disclosure request entirely"
          color="var(--accent-red)" icon="✕"
          active={decision === 'decline'} onClick={() => setDecision('decline')}
        />
      </div>
    </div>
  )
}

/* ─── Step 2a: Terms (accept/counter) ─── */
function StepTerms({ level, setLevel, expiry, setExpiry, customDate, setCustomDate, request, decision, hasProofEval, cascadePolicy, setCascadePolicy }) {
  const isCounter = decision === 'counter'
  const reqLevel = request.requestedLevel
  const reqSDA = SDA_TYPES[reqLevel]
  const counterOptions = useMemo(() => {
    const order = ['full', 'selective', 'proofonly']
    return order.slice(order.indexOf(reqLevel) + 1)
  }, [reqLevel])

  return (
    <div>
      {!isCounter && (
        <div style={{
          padding: '16px 18px',
          background: `color-mix(in srgb, ${reqSDA?.c || 'var(--accent-amber)'} 6%, transparent)`,
          border: `1px solid color-mix(in srgb, ${reqSDA?.c || 'var(--accent-amber)'} 25%, transparent)`,
          borderRadius: 8, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: reqSDA?.c || 'var(--accent-amber)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: reqSDA?.c || 'var(--accent-amber)', marginBottom: 3 }}>{reqSDA?.short} — as requested</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{reqSDA?.desc}</div>
          </div>
        </div>
      )}

      {isCounter && (
        <>
          <div style={{
            padding: '14px 16px',
            background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
            borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 18,
          }}>
            <strong style={{ color: 'var(--accent-amber)' }}>Countering:</strong> {request.from.name} requested <strong style={{ color: reqSDA?.c }}>{reqSDA?.short}</strong>. You can counter with a lower access level. They will be notified of your counter-offer.
          </div>
          <FieldLabel label="Counter with a lower permission level" />
          {counterOptions.length === 0 ? (
            <div style={{ padding: '16px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 18 }}>
              There are no lower permission levels available to offer. The requested level is already the minimum. You can accept as-is or decline the request.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
              {counterOptions.map(t => (
                <SDATypeCard key={t} type={t} selected={level} onSelect={setLevel}
                  disabled={t === 'proofonly' && !hasProofEval}
                  disabledReason={t === 'proofonly' && !hasProofEval ? 'Requires a completed evaluation' : null}
                />
              ))}
            </div>
          )}
        </>
      )}

      <FieldLabel label="Set expiration" />
      <ExpiryPicker expiry={expiry} setExpiry={setExpiry} customDate={customDate} setCustomDate={setCustomDate} />

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

      <div style={{ padding: '16px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 12 }}>DISCLOSURE SUMMARY</div>
        <InfoRow label="Asset" value={request.asset.name} />
        <InfoRow label="To" value={request.from.name} />
        <InfoRow label="Permission" value={
          <span style={{ color: SDA_TYPES[isCounter ? level : reqLevel]?.c, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
            {SDA_TYPES[isCounter ? level : reqLevel]?.short}{isCounter ? ' (countered)' : ''}
          </span>
        } />
        <InfoRow label="Expires" value={expiryLabel(expiry, customDate)} />
        <InfoRow label="Cascade policy" value={
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: cascadePolicy === 'open' ? 'var(--accent-green)' : 'var(--text-dim)' }}>
            {cascadePolicy === 'open' ? 'Open' : 'Closed'}
          </span>
        } />
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          This creates a bilateral {SDA_TYPES[isCounter ? level : reqLevel]?.label?.toLowerCase() || 'disclosure'} recorded on-chain. The receiving party will be able to run evaluations at the specified permission level.
        </div>
      </div>
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
  const dsLevel = level
  const dsSDA = SDA_TYPES[dsLevel]

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
          You are creating a <LevelInline type={dsLevel} tip /> disclosure with {request.from.name} for {request.asset.name}.
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

      <UpstreamPicker assets={upstreamAssets} selected={selected} setSelected={setSelected} downstreamLevel={dsLevel} />
      <div style={{ marginTop: 18, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        Assets with a closed cascade policy cannot be forwarded. Contact the upstream owner to request a policy change.
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN MODAL
   ═══════════════════════════════════════════════════════════════════════ */
export default function DisclosureResponseModal({ request, onClose }) {
  const [step, setStep] = useState(0)
  const [decision, setDecision] = useState(null)
  const [level, setLevel] = useState(request.requestedLevel)
  const [expiry, setExpiry] = useState('1-year')
  const [customDate, setCustomDate] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [cascadePolicy, setCascadePolicy] = useState('closed')
  const [cascadeSelected, setCascadeSelected] = useState([])
  const [completed, setCompleted] = useState(false)
  const hasProofEval = true // demo — assume owner has completed evaluations

  // Build upstream asset list from node's children (if node is provided)
  const node = request.node
  const upstreamAssets = useMemo(() => {
    if (!node?.children) return []
    return node.children
      .filter(c => c.upstreamSda)
      .map(c => ({
        id: c.id,
        name: c.name,
        pin: c.pin || `PIN-${c.id}`,
        category: c.category || 'product',
        owner: c.upstreamSda.owner,
        ownerDot: c.upstreamSda.ownerDot,
        upstreamSdaType: c.upstreamSda.type,
        cascadePolicy: c.upstreamSda.policy,
        cascadeTo: request.from.name,
      }))
  }, [node, request.from.name])

  const hasCascadableAssets = upstreamAssets.some(a => a.cascadePolicy === 'open')
  const showCascadeStep = decision !== 'decline' && hasCascadableAssets && cascadePolicy === 'open'

  useEffect(() => {
    if (decision === 'counter') {
      const order = ['full', 'selective', 'proofonly']
      const reqIdx = order.indexOf(request.requestedLevel)
      const opts = order.slice(reqIdx + 1)
      if (opts.length > 0) setLevel(opts[0])
    } else if (decision === 'accept') {
      setLevel(request.requestedLevel)
    }
  }, [decision, request.requestedLevel])

  const totalSteps = decision === 'decline' ? 2 : showCascadeStep ? 4 : 3

  if (completed) {
    const isDecline = decision === 'decline'
    const effectiveLevel = decision === 'counter' ? level : request.requestedLevel
    return (
      <Backdrop onClose={onClose}><Modal width={620}>
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
              <InfoRow label="Asset" value={request.asset.name} />
              <InfoRow label="Party" value={request.from.name} />
              <InfoRow label="Permission" value={
                <span style={{ color: SDA_TYPES[effectiveLevel]?.c, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
                  {SDA_TYPES[effectiveLevel]?.short}{decision === 'counter' ? ' (countered)' : ''}
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
              <InfoRow label="On-chain TX" value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>0x{Math.random().toString(16).slice(2, 6)}...pending</span>} />
            </div>
          )}
          <Btn label="Done" accent onClick={onClose} />
        </div>
      </Modal></Backdrop>
    )
  }

  // Step mapping:
  // step 0 = Review (always)
  // step 1 = Terms (accept/counter) or Decline
  // step 2 = Cascade (if showCascadeStep and not decline)
  // step 3 = final confirm (only when cascade step exists, handled via Create Disclosure on step 2's review)

  const currentStepNum = () => {
    if (!decision) return 1
    if (decision === 'decline') return step + 2
    return step + 2
  }

  return (
    <Backdrop onClose={onClose}><Modal width={720}>
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
            request={request} decision={decision} hasProofEval={hasProofEval}
            cascadePolicy={cascadePolicy} setCascadePolicy={setCascadePolicy}
          />
        )}
        {step === 2 && decision !== 'decline' && (
          <StepCascade
            request={request} node={node} level={decision === 'counter' ? level : request.requestedLevel}
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
          showCascadeStep
            ? <Btn label="Next — Cascade Assets →" accent onClick={() => setStep(2)} />
            : <Btn label="Create Disclosure" accent onClick={() => setCompleted(true)} />
        )}
        {step === 2 && decision !== 'decline' && (
          <Btn
            label={cascadeSelected.length > 0 ? `Create Disclosure (${cascadeSelected.length} cascading)` : 'Skip — No Cascading Assets'}
            purple={cascadeSelected.length > 0}
            accent={cascadeSelected.length === 0}
            onClick={() => setCompleted(true)}
          />
        )}
      </ModalFooter>
    </Modal></Backdrop>
  )
}
