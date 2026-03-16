import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow, CopyBadge,
} from './ModalShared'
import { makePin } from '../../v2/v2Data.js'

const ASSET_CATEGORIES = [
  { id: 'product', icon: '■', label: 'Product', desc: 'Physical or digital product, component, or assembly', color: 'var(--accent-blue, #60a5fa)' },
  { id: 'process', icon: '◎', label: 'Process', desc: 'Manufacturing process, test procedure, or workflow', color: 'var(--accent-amber)' },
  { id: 'place',   icon: '◆', label: 'Place', desc: 'Facility, warehouse, or geographic location', color: 'var(--accent-green)' },
  { id: 'person',  icon: '●', label: 'Person', desc: 'Individual, team, or certified operator', color: 'var(--accent-cyan, #22d3ee)' },
]

const CAT_ICONS = {
  product: (color) => (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l8.66 5v10L12 22 3.34 17V7L12 2z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  ),
  process: (color) => (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none">
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={color} strokeWidth={1.5} />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={1.5} />
    </svg>
  ),
  place: (color) => (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none">
      <path d="M12 21c0 0-7-5.75-7-10.5a7 7 0 0114 0C19 15.25 12 21 12 21z" stroke={color} strokeWidth={1.5} />
      <circle cx={12} cy={10.5} r={2.5} stroke={color} strokeWidth={1.5} />
    </svg>
  ),
  person: (color) => (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none">
      <circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.5} />
      <path d="M20 21c0-3.31-3.58-6-8-6s-8 2.69-8 6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  ),
}

function CategoryCard({ cat, selected, onClick }) {
  const [hov, setHov] = useState(false)
  const active = selected === cat.id
  const iconColor = active || hov ? cat.color : 'var(--text-dim)'

  return (
    <div
      onClick={() => onClick(cat.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 12px 16px',
        borderRadius: 8,
        border: `1.5px solid ${active ? cat.color : hov ? 'var(--border-hover)' : 'var(--border)'}`,
        background: active
          ? `color-mix(in srgb, ${cat.color} 6%, transparent)`
          : hov
            ? 'var(--bg-raised)'
            : 'var(--bg-card)',
        cursor: 'pointer',
        transition: 'all 150ms',
        textAlign: 'center',
        gap: 8,
      }}
    >
      {CAT_ICONS[cat.id]?.(iconColor)}
      <div style={{
        fontSize: 12, fontWeight: 600,
        color: active ? cat.color : hov ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'color 150ms',
      }}>
        {cat.icon} {cat.label}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{cat.desc}</div>
    </div>
  )
}

const inputStyle = {
  width: '100%', height: 38, padding: '0 14px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
  outline: 'none', marginBottom: 18,
}

const textareaStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
  resize: 'vertical', outline: 'none', lineHeight: 1.6, marginBottom: 18,
}

export default function RegisterAssetModal({ parentNode, activeParty, onClose, onComplete, onBack, _noBackdrop }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [category, setCategory] = useState(null)
  const [desc, setDesc] = useState('')
  const [completed, setCompleted] = useState(false)
  const [generatedPin, setGeneratedPin] = useState(null)
  const [txHash] = useState(() => Math.random().toString(16).slice(2, 6))

  const cat = ASSET_CATEGORIES.find(c => c.id === category)
  const canProceed = name.trim() && category

  const handleRegister = () => {
    const pin = makePin('new-' + name.toLowerCase().replace(/\s+/g, '-'))
    setGeneratedPin(pin)
    setCompleted(true)
  }

  if (completed) {
    const completedContent = (
      <Modal width={540}>
        <div style={{ padding: '52px 36px', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px',
            border: '2px solid var(--accent-green)',
          }}>
            <span style={{ fontSize: 26, color: 'var(--accent-green)' }}>✓</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Asset Registered</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 28 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{name}</strong> has been registered and connected to {parentNode.name}.
          </div>
          <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28, textAlign: 'left' }}>
            <InfoRow label="Asset name" value={name} />
            <InfoRow label="PIN" value={<CopyBadge value={generatedPin} />} />
            <InfoRow label="Category" value={
              <span style={{ color: cat?.color, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
                {cat?.icon} {cat?.label}
              </span>
            } />
            <InfoRow label="Connected to" value={parentNode.name} />
            <InfoRow label="Owner" value={activeParty} />
            <InfoRow label="On-chain TX" value={
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                0x{txHash}...pending
              </span>
            } />
          </div>
          <Btn label="Done" accent onClick={() => onComplete({ name, category, description: desc })} />
        </div>
      </Modal>
    )
    return _noBackdrop ? completedContent : <Backdrop onClose={onClose}>{completedContent}</Backdrop>
  }

  const formContent = (
    <Modal width={780}>
      <ModalHeader
        title="Register Asset"
        subtitle="Create a new asset on your network."
        step={step + 1}
        totalSteps={2}
        onClose={onClose}
      />
      <ModalBody>
        {step === 0 && (
          <div>
            <FieldLabel label="Asset name" required />
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Thermal Interface Pad"
              style={inputStyle}
            />

            <FieldLabel label="Category" required />
            <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
              {ASSET_CATEGORIES.map(c => (
                <CategoryCard key={c.id} cat={c} selected={category} onClick={setCategory} />
              ))}
            </div>

            <FieldLabel label="Description" />
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Brief description of this asset..."
              rows={3}
              style={textareaStyle}
            />
          </div>
        )}
        {step === 1 && (
          <div>
            <div style={{ padding: 18, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 18 }}>
              <InfoRow label="Asset name" value={name} />
              <InfoRow label="Category" value={
                <span style={{ color: cat?.color, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
                  {cat?.icon} {cat?.label}
                </span>
              } />
              <InfoRow label="Connected to" value={parentNode.name} />
              <InfoRow label="Owner" value={activeParty} />
              {desc && <InfoRow label="Description" value={desc} />}
            </div>
            <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
              This will create a new asset on your network with a unique PIN, connected to <strong style={{ color: 'var(--text-primary)' }}>{parentNode.name}</strong> via a full internal disclosure.
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step === 0 && onBack && <Btn label="← Methods" onClick={onBack} />}
          {step > 0 && <Btn label="← Back" onClick={() => setStep(0)} />}
          <StepDots current={step} total={2} />
        </div>
        {step === 0 && <Btn label="Next → Review" accent disabled={!canProceed} onClick={() => setStep(1)} />}
        {step === 1 && <Btn label="Register Asset" accent onClick={handleRegister} />}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
