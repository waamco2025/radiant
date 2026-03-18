import { useState } from 'react'
import { CopyBadge, Tip, SDABadge, ChainIcon, SDA_TIPS, SDA_TYPES } from './ModalShared'

const SDA_LABELS = { full: 'FULL', selective: 'SELECTIVE', proofonly: 'PROOF-ONLY', cascade: 'CASCADE' }
const CATEGORY_CONFIG = {
  person: { icon: '●', color: 'var(--accent-cyan)', label: 'PERSON' },
  place: { icon: '◆', color: 'var(--accent-green)', label: 'PLACE' },
  process: { icon: '◎', color: 'var(--accent-amber)', label: 'PROCESS' },
  product: { icon: '■', color: 'var(--accent-blue)', label: 'PRODUCT' },
  party: { icon: '⬡', color: 'var(--accent-indigo)', label: 'PARTY' },
}

export default function UpstreamPicker({ assets, selected, setSelected, downstreamLevel, alreadyIds }) {
  const toggle = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const done = alreadyIds || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {assets.map(a => {
        const isOpen = a.cascadePolicy === 'open'
        const isSel = selected.includes(a.id)
        const isDone = done.includes(a.id)
        const off = !isOpen
        const [hov, setHov] = useState(false)
        const cat = CATEGORY_CONFIG[a.category] || CATEGORY_CONFIG.product

        return (
          <div key={a.id}
            onClick={off || isDone ? undefined : () => toggle(a.id)}
            onMouseEnter={() => !off && !isDone && setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
              padding: '18px 20px', borderRadius: 10, position: 'relative',
              border: `1.5px solid ${isDone ? 'var(--accent-green)' : isSel ? 'var(--accent-purple, #a78bfa)' : hov ? 'var(--border-hover)' : 'var(--border)'}`,
              background: isDone
                ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)'
                : isSel
                  ? 'color-mix(in srgb, var(--accent-purple, #a78bfa) 5%, transparent)'
                  : hov ? 'var(--bg-raised)' : 'var(--bg-card)',
              cursor: off || isDone ? 'default' : 'pointer',
              transition: 'all 150ms',
              opacity: off ? 0.45 : 1,
            }}
          >
            {/* Policy badge top-right with tooltip */}
            <div style={{ position: 'absolute', top: 12, right: 14 }}>
              <Tip text={isOpen
                ? `${a.owner} has permitted ${(SDA_LABELS[a.upstreamSdaType] || 'FULL').toLowerCase()} disclosure of this asset to all parties connected to your asset. ${a.owner} may revoke their disclosure at any time.`
                : `${a.owner} has not permitted disclosure of their asset to other parties. To enable disclosure of this asset, contact ${a.owner} to request a policy change.`
              }>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em',
                  color: isOpen ? 'var(--accent-green)' : 'var(--text-dim)',
                  padding: '2px 8px', borderRadius: 5,
                  background: isOpen
                    ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)'
                    : 'color-mix(in srgb, var(--text-dim) 8%, transparent)',
                  border: `1px solid ${isOpen
                    ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                    : 'color-mix(in srgb, var(--text-dim) 15%, transparent)'}`,
                }}>{isOpen ? 'OPEN' : 'CLOSED'}</span>
              </Tip>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {/* Checkbox */}
              {isDone ? (
                <div style={{
                  width: 20, height: 20, borderRadius: 5,
                  background: 'var(--accent-green)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                }}><span style={{ fontSize: 12, color: '#fff' }}>✓</span></div>
              ) : off ? (
                <div style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: '1.5px solid var(--border-hover)',
                  flexShrink: 0, marginTop: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><span style={{ fontSize: 11, color: 'var(--text-dim)' }}>✕</span></div>
              ) : (
                <div style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: `1.5px solid ${isSel ? 'var(--accent-purple, #a78bfa)' : 'var(--border-hover)'}`,
                  background: isSel ? 'var(--accent-purple, #a78bfa)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms', flexShrink: 0, marginTop: 2,
                }}>
                  {isSel && <span style={{ fontSize: 12, color: '#fff' }}>✓</span>}
                </div>
              )}

              <div style={{ flex: 1 }}>
                {/* Row 1: action label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  {isDone ? <>
                    <ChainIcon s={13} />
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-green)' }}>Cascading to {a.cascadeTo || 'downstream'}</span>
                  </> : off ? <>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Cannot disclose this asset</span>
                  </> : <>
                    <ChainIcon s={13} />
                    <span style={{
                      fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: isSel ? 'var(--accent-purple, #a78bfa)' : hov ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      transition: 'color 150ms',
                    }}>Disclose this asset</span>
                  </>}
                </div>

                {/* Row 2: category */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: cat.color, position: 'relative', top: -0.5 }}>{cat.icon}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: cat.color, letterSpacing: '0.06em' }}>{cat.label}</span>
                </div>

                {/* Row 3: name + PIN */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: off ? 'var(--text-dim)' : 'var(--text-primary)' }}>{a.name}</span>
                  <CopyBadge value={a.pin} truncated />
                </div>

                {/* Row 4: owner + DOT */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{a.owner}</span>
                  <CopyBadge value={a.ownerDot} truncated />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
