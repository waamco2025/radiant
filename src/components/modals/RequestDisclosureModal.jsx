import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow,
} from './ModalShared'

const REQ_OPTS = [
  'MIL-PRF-55681 Compliance',
  'System Integration Requirements',
  'Component Screening',
  'Material Compliance',
  'Calibration Verification',
]

/* ─── Step 1: Choose path ─── */
function StepPath({ onSelectPath, onRegisterAsset }) {
  const [hov, setHov] = useState(null)
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.7 }}>
        Choose how you'd like to connect assets to your network. Register a new asset, enter PINs shared with you off-platform, or browse the public asset directory.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Register New Asset — enabled */}
        <div
          onClick={() => onRegisterAsset?.()}
          onMouseEnter={() => setHov('register')}
          onMouseLeave={() => setHov(null)}
          style={{
            padding: '22px 20px', borderRadius: 10,
            border: `1.5px solid ${hov === 'register' ? 'var(--accent-green)' : 'var(--border)'}`,
            background: hov === 'register' ? 'var(--bg-raised)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 180ms',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-green) 25%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, color: 'var(--accent-green)', fontWeight: 700 }}>+</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: hov === 'register' ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'color 150ms' }}>
              Register New Asset
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, paddingLeft: 46 }}>
            Create a new asset on your network. You can attach evidence and run evaluations after registration.
          </div>
        </div>

        {/* Known PINs — enabled */}
        <div
          onClick={onSelectPath}
          onMouseEnter={() => setHov('pins')}
          onMouseLeave={() => setHov(null)}
          style={{
            padding: '22px 20px', borderRadius: 10,
            border: `1.5px solid ${hov === 'pins' ? 'var(--accent-indigo)' : 'var(--border)'}`,
            background: hov === 'pins' ? 'var(--bg-raised)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 180ms',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 14, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>PIN</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: hov === 'pins' ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'color 150ms' }}>
              Enter known PINs
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, paddingLeft: 46 }}>
            You have asset PINs from an off-platform conversation with the asset owner. Enter them to send a disclosure request directly.
          </div>
        </div>

        {/* Public Directory — disabled */}
        <div style={{
          padding: '22px 20px', borderRadius: 10,
          border: '1.5px solid var(--border)', background: 'var(--bg-card)',
          cursor: 'default', opacity: 0.4, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 12, right: 14,
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: 'var(--text-dim)', letterSpacing: '0.06em',
            padding: '3px 8px', background: 'var(--bg-raised)', borderRadius: 6,
          }}>COMING SOON</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="var(--text-dim)" strokeWidth="1.3" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="var(--text-dim)" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>Browse Public Directory</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, paddingLeft: 46 }}>
            Search the public asset directory for assets that owners have made discoverable. Request disclosure directly from the directory listing.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN MODAL
   ═══════════════════════════════════════════════════════════════════════ */
export default function RequestDisclosureModal({ contextNode, onClose, onRegisterAsset, _noBackdrop }) {
  const [pins, setPins] = useState('')
  const [message, setMessage] = useState('')
  const [reqs, setReqs] = useState(['MIL-PRF-55681 Compliance'])
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    const submittedContent = (
      <Modal width={540}>
        <div style={{ padding: '52px 36px', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px', border: '2px solid var(--accent-indigo)',
          }}>
            <span style={{ fontSize: 26, color: 'var(--accent-indigo)' }}>↗</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Request Sent</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 28 }}>
            Your disclosure request has been recorded on-chain. The asset owner will be notified and can accept or decline. If accepted, they will determine the disclosure type and terms.
          </div>
          <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28, textAlign: 'left' }}>
            <InfoRow label="PINs requested" value={pins.split('\n').filter(Boolean).length + ' asset(s)'} />
            <InfoRow label="Requirements" value={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {reqs.map((r, i) => <span key={i} style={{ fontSize: 11 }}>{r}</span>)}
              </div>
            } />
            {message && <InfoRow label="Message" value={<span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{message.length > 80 ? message.slice(0, 80) + '…' : message}</span>} />}
          </div>
          <Btn label="Done" accent onClick={onClose} />
        </div>
      </Modal>
    )
    return _noBackdrop ? submittedContent : <Backdrop onClose={onClose}>{submittedContent}</Backdrop>
  }

  const formContent = (
    <Modal>
      <ModalHeader title="Connect Asset" subtitle="Find and request disclosure of an asset to connect it to your network." step={step + 1} totalSteps={3} onClose={onClose} />
      <ModalBody>
        {step === 0 && <StepPath onSelectPath={() => setStep(1)} onRegisterAsset={onRegisterAsset} />}
        {step === 1 && (
          <div>
            <FieldLabel label="Asset PIN(s)" required />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Enter one PIN per line. You can paste multiple PINs received from an off-platform conversation.</div>
            <textarea
              value={pins} onChange={e => setPins(e.target.value)}
              placeholder={'PIN-0x5e9a...d4c3\nPIN-0x2d7c...b5f0'}
              rows={4}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12,
                resize: 'vertical', outline: 'none', lineHeight: 1.8,
              }}
            />
            <div style={{
              marginTop: 18, padding: '14px 16px',
              background: 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
              borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
            }}>
              The asset owner will determine the disclosure type and terms when they respond to your request.
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <FieldLabel label="Requirements you plan to evaluate" />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.7 }}>
              Select the requirement sets you intend to run. This helps the owner understand your evaluation scope and prepare appropriate evidence.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {REQ_OPTS.map(r => {
                const sel = reqs.includes(r)
                return (
                  <div key={r} onClick={() => setReqs(p => sel ? p.filter(x => x !== r) : [...p, r])} style={{
                    padding: '12px 16px', borderRadius: 6,
                    border: `1px solid ${sel ? 'var(--accent-indigo)' : 'var(--border)'}`,
                    background: sel ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : 'var(--bg-card)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 150ms',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4,
                      border: `1.5px solid ${sel ? 'var(--accent-indigo)' : 'var(--border)'}`,
                      background: sel ? 'var(--accent-indigo)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 150ms', flexShrink: 0,
                    }}>
                      {sel && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 13, color: sel ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{r}</span>
                  </div>
                )
              })}
            </div>
            <FieldLabel label="Message to owner" />
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Explain why you're requesting disclosure and how the data will be used..."
              rows={4}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                resize: 'vertical', outline: 'none', lineHeight: 1.6,
              }}
            />
            {/* Review summary */}
            <div style={{ marginTop: 22, padding: '16px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em', marginBottom: 12 }}>REVIEW</div>
              <InfoRow label="PINs" value={pins.split('\n').filter(Boolean).length + ' asset(s)'} />
              <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 34, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)', paddingLeft: 4, paddingTop: 8 }}>Requirements</div>
                <div style={{ flex: 1, paddingTop: 6, paddingBottom: 6 }}>
                  {reqs.map((r, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>{r}</div>)}
                </div>
              </div>
              {message && (
                <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 34, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)', paddingLeft: 4, paddingTop: 8 }}>Message</div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8, paddingBottom: 8, lineHeight: 1.6 }}>{message}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={() => setStep(s => s - 1)} />}
          <StepDots current={step} total={3} />
        </div>
        {step === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Choose a path above</div>}
        {step === 1 && <Btn label="Next →" accent disabled={!pins.trim()} onClick={() => setStep(2)} />}
        {step === 2 && <Btn label="Send Request" accent disabled={!reqs.length} onClick={() => setSubmitted(true)} />}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
