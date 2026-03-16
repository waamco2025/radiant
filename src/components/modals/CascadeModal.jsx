import { useState, useMemo } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, InfoRow, LevelInline, SDABadge, ChainIcon,
  getEffectiveLevel,
} from './ModalShared'
import UpstreamPicker from './UpstreamPicker'

export default function CascadeModal({ node, sda, existingCascades, onClose, _noBackdrop }) {
  const [selected, setSelected] = useState([])
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState(false)

  const downstreamLevel = sda.type || 'selective'
  const downstreamParty = sda.party || 'Unknown'

  const alreadyIds = useMemo(() =>
    (existingCascades || []).filter(c => c.toParty === downstreamParty).map(c => c.assetId),
    [existingCascades, downstreamParty]
  )

  // Build upstream asset list from node's upstreamAssets
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
        cascadeTo: downstreamParty,
      }))
  }, [node, downstreamParty])

  if (completed) {
    const completedContent = (
      <Modal width={560}>
        <div style={{ padding: '52px 36px', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--accent-purple, #a78bfa) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px',
            border: '2px solid var(--accent-purple, #a78bfa)',
          }}><ChainIcon s={28} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
            Cascading Disclosures Updated
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 28 }}>
            {selected.length > 0
              ? <>{selected.length} new cascading disclosure{selected.length > 1 ? 's' : ''} added to your agreement with {downstreamParty}.</>
              : 'No changes made.'}
          </div>
          {selected.length > 0 && (
            <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 24, textAlign: 'left' }}>
              {selected.map(id => {
                const a = upstreamAssets.find(x => x.id === id)
                const eff = getEffectiveLevel(a?.upstreamSdaType, downstreamLevel)
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a?.owner}</div>
                    </div>
                    <SDABadge type={eff} tip />
                  </div>
                )
              })}
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                You can manage cascading disclosures at any time from the Disclosures tab on {node.name}'s Detail Panel.
              </div>
            </div>
          )}
          <Btn label="Done" purple onClick={onClose} />
        </div>
      </Modal>
    )
    return _noBackdrop ? completedContent : <Backdrop onClose={onClose}>{completedContent}</Backdrop>
  }

  const formContent = (
    <Modal>
      <ModalHeader
        title="Manage Cascading Disclosures"
        subtitle={<span>{node.name} → {downstreamParty} (<LevelInline type={downstreamLevel} tip />)</span>}
        step={step + 1}
        totalSteps={2}
        onClose={onClose}
      />
      <ModalBody>
        {step === 0 && (
          <div>
            <div style={{
              padding: '14px 16px',
              background: 'color-mix(in srgb, var(--accent-purple, #a78bfa) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-purple, #a78bfa) 20%, transparent)',
              borderRadius: 8, marginBottom: 22, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
            }}>
              <strong style={{ color: 'var(--accent-purple, #a78bfa)' }}>Active SDA:</strong> You have a <LevelInline type={downstreamLevel} tip /> disclosure with {downstreamParty} for {node.name}. Select additional connected assets to cascade through this agreement.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <ChainIcon s={20} />
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Disclose connected assets</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 22, lineHeight: 1.7 }}>
              Cascading disclosures to {downstreamParty} are shown in green. Select additional assets to include. {node.name} is connected to {upstreamAssets.length} other assets total.
            </div>

            <UpstreamPicker assets={upstreamAssets} selected={selected} setSelected={setSelected} downstreamLevel={downstreamLevel} alreadyIds={alreadyIds} />
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ padding: '18px 20px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 14 }}>CASCADE CHANGES</div>

              {alreadyIds.length > 0 && <>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', marginBottom: 10 }}>EXISTING ({alreadyIds.length})</div>
                {alreadyIds.map(id => {
                  const a = upstreamAssets.find(x => x.id === id)
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', opacity: 0.6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a?.name} ({a?.owner})</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>Active</span>
                    </div>
                  )
                })}
                <div style={{ height: 18 }} />
              </>}

              {selected.length > 0 && <>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple, #a78bfa)', marginBottom: 10 }}>ADDING ({selected.length})</div>
                {selected.map(id => {
                  const a = upstreamAssets.find(x => x.id === id)
                  const eff = getEffectiveLevel(a?.upstreamSdaType, downstreamLevel)
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a?.owner}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SDABadge type={eff} tip />
                        <span style={{ fontSize: 10, color: 'var(--accent-purple, #a78bfa)', fontFamily: 'var(--font-mono)' }}>NEW</span>
                      </div>
                    </div>
                  )
                })}
              </>}

              {selected.length === 0 && (
                <div style={{ padding: '14px 16px', background: 'var(--bg-raised)', borderRadius: 6, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  No new cascading assets selected. All available assets are either already cascading or have a closed policy.
                </div>
              )}

              <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                New cascading disclosures will be recorded on-chain. {downstreamParty} will be notified of newly available assets. Either the upstream owner or you can revoke a cascading disclosure independently at any time.
              </div>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={() => setStep(0)} />}
          <StepDots current={step} total={2} />
        </div>
        {step === 0 && (
          <Btn
            label={selected.length > 0 ? `Review Changes (${selected.length})` : 'No Changes'}
            purple={selected.length > 0}
            disabled={selected.length === 0}
            onClick={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Btn label={`Add ${selected.length} Cascading Disclosure${selected.length > 1 ? 's' : ''}`} purple onClick={() => setCompleted(true)} />
        )}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
