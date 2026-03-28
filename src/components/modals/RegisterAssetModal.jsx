import { useState, useRef } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow, CopyBadge,
} from './ModalShared'
import QualifiedStoragePicker from './QualifiedStoragePicker'
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

const tabStyle = (active) => ({
  flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
  cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-display)',
  fontWeight: active ? 600 : 400,
  background: active ? 'var(--accent-indigo)' : 'transparent',
  color: active ? '#fff' : 'var(--text-tertiary)',
  transition: 'all 180ms',
})

// ── Mock data generation ──

function generateMockResults(parentNode, activeParty, debugErrors, nodeMap) {
  if (!debugErrors) {
    return [
      { row: 1, parentPin: parentNode.pin, parentName: parentNode.name, name: 'Thermal Sensor Array', category: 'product', evidenceUri: '', status: 'valid', error: null },
      { row: 2, parentPin: parentNode.pin, parentName: parentNode.name, name: 'Assembly Test Report', category: 'product', evidenceUri: 'provenance://evidence/atr-7f2a.pdf', status: 'valid', error: null },
      { row: 3, parentPin: parentNode.pin, parentName: parentNode.name, name: 'Quality Inspection Process', category: 'process', evidenceUri: '', status: 'valid', error: null },
      { row: 4, parentPin: parentNode.pin, parentName: parentNode.name, name: 'Environmental Test Chamber', category: 'place', evidenceUri: 'provenance://evidence/env-tc-9d1b.pdf', status: 'valid', error: null },
    ]
  }

  const evidenceChildPin = (() => {
    for (const n of Object.values(nodeMap)) {
      if (n.isEvidence) return n.pin
    }
    return 'PIN-0xdead...beef'
  })()

  const notOwnedNode = Object.values(nodeMap).find(n => n.owner && n.owner !== activeParty)

  return [
    { row: 1, parentPin: parentNode.pin, parentName: parentNode.name, name: 'Thermal Sensor Array', category: 'product', evidenceUri: '', status: 'valid', error: null },
    { row: 2, parentPin: 'PIN-0x0000...ffff', parentName: null, name: 'Ghost Component', category: 'product', evidenceUri: '', status: 'error', error: 'Parent PIN not found on your network' },
    { row: 3, parentPin: notOwnedNode?.pin || 'PIN-0xaaaa...bbbb', parentName: null, name: 'Unauthorized Part', category: 'product', evidenceUri: '', status: 'error', error: 'Parent PIN not found on your network' },
    { row: 4, parentPin: evidenceChildPin, parentName: 'Evidence Node', name: 'Bad Attachment', category: 'product', evidenceUri: '', status: 'error', error: 'Cannot attach assets to an evidence node' },
    { row: 5, parentPin: parentNode.pin, parentName: parentNode.name, name: 'Mystery Object', category: 'widget', evidenceUri: '', status: 'error', error: "Invalid category 'widget' — must be product, process, place, or person" },
    { row: 6, parentPin: parentNode.pin, parentName: parentNode.name, name: '', category: 'product', evidenceUri: '', status: 'error', error: 'Asset name is required' },
  ]
}

// ── Bulk sub-steps ──

function BulkUploadStep({ bulkFile, bulkSource, onSelectFile, onQSSelect, onSourceChange, debugErrors, setDebugErrors, parentNode, bulkFileRef }) {
  return (
    <div>
      <div style={{
        padding: '14px 16px',
        background: 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
        borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
        marginBottom: 20,
      }}>
        Upload a CSV file to register multiple assets at once. Each row creates a new asset
        connected to an existing node on your network via its Parent PIN.
      </div>

      <FieldLabel label="CSV format" />
      <div style={{
        padding: '14px 16px', borderRadius: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        marginBottom: 8, overflowX: 'auto',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1fr',
          gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8,
          paddingBottom: 8, borderBottom: '1px solid var(--border)',
        }}>
          <span>parent_pin</span>
          <span>name</span>
          <span>category</span>
          <span>evidence_uri</span>
        </div>
        {/* Example rows */}
        {[
          { name: 'Thermal Sensor Array', cat: 'product', uri: '' },
          { name: 'Assembly Test Report', cat: 'product', uri: 'provenance://evidence/atr-001.pdf' },
          { name: 'Quality Inspection Log', cat: 'process', uri: '' },
        ].map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1fr',
            gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-dim)', lineHeight: 1.8,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {parentNode.pin.slice(0, 10)}...{parentNode.pin.slice(-4)}
            </span>
            <span>{row.name}</span>
            <span>{row.cat}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.uri || '—'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, fontStyle: 'italic' }}>
        Use full PINs in the actual CSV file — truncated here for readability.
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-tertiary)' }}>Columns:</strong> parent_pin (required) · name (required) · category (required: product, process, place, person) · evidence_uri (optional)
      </div>

      <FieldLabel label="Select CSV file" required />

      {/* Source tabs */}
      <div style={{ display: 'flex', marginBottom: 14, borderBottom: '2px solid var(--border)' }}>
        <div
          onClick={() => onSourceChange?.('local')}
          style={{
            padding: '8px 16px', fontSize: 12, fontFamily: 'var(--font-mono)',
            cursor: 'pointer', fontWeight: 600,
            color: bulkSource === 'local' ? 'var(--accent-blue)' : 'var(--text-dim)',
            borderBottom: bulkSource === 'local' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M8 2v8M4 6l4-4 4 4" />
            <path d="M2 12v2h12v-2" />
          </svg>
          Local file
        </div>
        <div
          onClick={() => onSourceChange?.('qs')}
          style={{
            padding: '8px 16px', fontSize: 12, fontFamily: 'var(--font-mono)',
            cursor: 'pointer', fontWeight: 600,
            color: bulkSource === 'qs' ? 'var(--accent-green)' : 'var(--text-dim)',
            borderBottom: bulkSource === 'qs' ? '2px solid var(--accent-green)' : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M4 11.5a3.5 3.5 0 01-.5-6.96A5 5 0 0113 6a4 4 0 01-1 7.9H4z" />
          </svg>
          Qualified Storage
        </div>
      </div>

      {bulkSource === 'local' ? (
        <div
          onClick={() => bulkFileRef.current?.click()}
          style={{
            padding: '20px', minHeight: 80,
            border: `1.5px dashed ${bulkFile && bulkSource === 'local' ? 'var(--accent-green)' : 'var(--border)'}`,
            borderRadius: 8,
            background: bulkFile && bulkSource === 'local'
              ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)'
              : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 150ms',
            textAlign: 'center',
          }}
        >
          {bulkFile && bulkSource === 'local' ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{bulkFile}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Click to change file</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 24, color: 'var(--text-dim)', marginBottom: 6 }}>&uarr;</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Choose a CSV file...</div>
            </>
          )}
        </div>
      ) : (
        <div
          onClick={() => onQSSelect?.()}
          style={{
            padding: '20px', minHeight: 80,
            border: `1.5px dashed ${bulkFile && bulkSource === 'qs' ? 'var(--accent-green)' : 'var(--border)'}`,
            borderRadius: 8,
            background: bulkFile && bulkSource === 'qs'
              ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)'
              : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 150ms',
            textAlign: 'center',
          }}
          onMouseEnter={e => { if (!(bulkFile && bulkSource === 'qs')) e.currentTarget.style.borderColor = 'var(--border-hover)' }}
          onMouseLeave={e => { if (!(bulkFile && bulkSource === 'qs')) e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          {bulkFile && bulkSource === 'qs' ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{bulkFile}</div>
              <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 4 }}>Click to change</div>
            </>
          ) : (
            <>
              <svg width={24} height={24} viewBox="0 0 16 16" fill="none" stroke="var(--text-dim)" strokeWidth="1.0" style={{ display: 'block', margin: '0 auto 6px' }}>
                <path d="M4 11.5a3.5 3.5 0 01-.5-6.96A5 5 0 0113 6a4 4 0 01-1 7.9H4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Browse Qualified Storage...</div>
            </>
          )}
        </div>
      )}
      <input
        ref={bulkFileRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={onSelectFile}
      />

      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          onClick={() => setDebugErrors(prev => !prev)}
          style={{
            width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
            background: debugErrors ? 'var(--accent-red)' : 'var(--border)',
            position: 'relative', transition: 'background 150ms',
          }}
        >
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: '#fff', position: 'absolute', top: 2,
            left: debugErrors ? 16 : 2, transition: 'left 150ms',
          }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
          Simulate errors (demo)
        </span>
      </div>
    </div>
  )
}

function BulkReviewStep({ results }) {
  const validCount = results.filter(r => r.status === 'valid').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
        padding: '12px 16px', borderRadius: 8,
        background: errorCount > 0
          ? 'color-mix(in srgb, var(--accent-amber) 6%, transparent)'
          : 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
        border: `1px solid ${errorCount > 0 ? 'color-mix(in srgb, var(--accent-amber) 20%, transparent)' : 'color-mix(in srgb, var(--accent-green) 20%, transparent)'}`,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: errorCount > 0 ? 'var(--accent-amber)' : 'var(--accent-green)',
        }}>
          {validCount} of {results.length} valid
        </span>
        {errorCount > 0 && (
          <span style={{ fontSize: 12, color: 'var(--accent-red)' }}>
            · {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 1fr 80px 1fr',
          padding: '8px 12px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
          color: 'var(--text-dim)', letterSpacing: '0.04em',
        }}>
          <span>#</span>
          <span>PARENT</span>
          <span>ASSET NAME</span>
          <span>CATEGORY</span>
          <span>STATUS</span>
        </div>

        {results.map((r, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 1fr 80px 1fr',
            padding: '10px 12px',
            borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
            background: r.status === 'error'
              ? 'color-mix(in srgb, var(--accent-red) 3%, transparent)'
              : 'transparent',
            alignItems: 'center',
            fontSize: 12,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>{r.row}</span>
            <div style={{ paddingRight: 8 }}>
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: r.status === 'error' ? 'var(--text-dim)' : 'var(--text-primary)',
              }}>
                {r.parentName || 'Unknown'}
              </div>
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)',
                color: 'var(--text-dim)', marginTop: 2,
              }}>
                {r.parentPin?.slice(0, 10)}...{r.parentPin?.slice(-4)}
              </div>
            </div>
            <span style={{
              color: r.status === 'error' ? 'var(--text-dim)' : 'var(--text-primary)',
              fontWeight: r.status === 'valid' ? 600 : 400,
              textDecoration: r.status === 'error' ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              paddingRight: 8,
            }}>
              {r.name || '(empty)'}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: r.status === 'error' ? 'var(--text-dim)' : 'var(--text-tertiary)',
            }}>
              {r.category}
            </span>
            <span>
              {r.status === 'valid' ? (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-green)' }}>
                  ✓ Valid
                </span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--accent-red)', lineHeight: 1.4 }}>
                  {r.error}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {errorCount > 0 && (
        <div style={{
          marginTop: 14, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7,
        }}>
          Rows with errors will be skipped. Only the {validCount} valid asset{validCount !== 1 ? 's' : ''} will be imported.
        </div>
      )}
    </div>
  )
}

function BulkConfirmStep({ results }) {
  const validResults = results.filter(r => r.status === 'valid')
  return (
    <div style={{ padding: '52px 36px', textAlign: 'center' }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 22px', border: '2px solid var(--accent-green)',
      }}>
        <span style={{ fontSize: 26, color: 'var(--accent-green)' }}>✓</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
        {validResults.length} Asset{validResults.length !== 1 ? 's' : ''} Registered
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 28 }}>
        {validResults.length} new asset{validResults.length !== 1 ? 's have' : ' has'} been created and connected to your network.
      </div>
      <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28, textAlign: 'left' }}>
        {validResults.map((r, i) => (
          <InfoRow key={i} label={r.parentName} value={
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
          } />
        ))}
      </div>
    </div>
  )
}

// ── Main modal ──

export default function RegisterAssetModal({ parentNode, activeParty, nodeMap, onClose, onComplete, onBack, _noBackdrop }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [category, setCategory] = useState(null)
  const [desc, setDesc] = useState('')
  const [completed, setCompleted] = useState(false)
  const [generatedPin, setGeneratedPin] = useState(null)
  const [txHash] = useState(() => Math.random().toString(16).slice(2, 6))

  // Mode: single vs bulk
  const [mode, setMode] = useState('single')

  // Bulk state
  const [bulkStep, setBulkStep] = useState(0)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkSource, setBulkSource] = useState('local')
  const [bulkResults, setBulkResults] = useState([])
  const [debugErrors, setDebugErrors] = useState(false)
  const [showQSPicker, setShowQSPicker] = useState(false)
  const bulkFileRef = useRef(null)

  const cat = ASSET_CATEGORIES.find(c => c.id === category)
  const canProceed = name.trim() && category

  const handleRegister = () => {
    const pin = makePin('new-' + name.toLowerCase().replace(/\s+/g, '-'))
    setGeneratedPin(pin)
    setCompleted(true)
  }

  const handleBulkFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) { setBulkFile(file.name); setBulkSource('local') }
  }

  const handleBulkValidate = () => {
    const results = generateMockResults(parentNode, activeParty, debugErrors, nodeMap || {})
    setBulkResults(results)
    setBulkStep(1)
  }

  const handleBulkImport = () => {
    setBulkStep(2)
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
            <InfoRow label="PIN" value={<CopyBadge value={generatedPin} truncated />} />
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

  const validBulkCount = bulkResults.filter(r => r.status === 'valid').length

  const formContent = (
    <Modal width={780}>
      <ModalHeader
        title="Register Asset"
        subtitle={
          <span>
            Create {mode === 'bulk' ? 'assets' : 'a new asset'} on your network under{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{parentNode.name}</strong>
          </span>
        }
        step={mode === 'single' ? step + 1 : undefined}
        totalSteps={mode === 'single' ? 2 : undefined}
        onClose={onClose}
      />
      <ModalBody>
        {/* Step 0: tab selector + single or bulk content */}
        {(mode === 'single' ? step === 0 : bulkStep === 0) && (
          <>
            <div style={{
              display: 'flex', gap: 4, marginBottom: 20,
              background: 'var(--bg-surface)', borderRadius: 8,
              padding: 4, border: '1px solid var(--border)',
            }}>
              <button onClick={() => setMode('single')} style={tabStyle(mode === 'single')}>
                Single
              </button>
              <button onClick={() => setMode('bulk')} style={tabStyle(mode === 'bulk')}>
                Bulk Import
              </button>
            </div>

            {mode === 'single' && (
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

            {mode === 'bulk' && (
              <BulkUploadStep
                bulkFile={bulkFile}
                bulkSource={bulkSource}
                onSelectFile={handleBulkFileSelect}
                onQSSelect={() => setShowQSPicker(true)}
                onSourceChange={setBulkSource}
                debugErrors={debugErrors}
                setDebugErrors={setDebugErrors}
                parentNode={parentNode}
                bulkFileRef={bulkFileRef}
              />
            )}
          </>
        )}

        {/* Single step 1: review */}
        {mode === 'single' && step === 1 && (
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

        {/* Bulk step 1: review table */}
        {mode === 'bulk' && bulkStep === 1 && (
          <BulkReviewStep results={bulkResults} />
        )}

        {/* Bulk step 2: confirmation */}
        {mode === 'bulk' && bulkStep === 2 && (
          <BulkConfirmStep results={bulkResults} />
        )}
      </ModalBody>
      <ModalFooter>
        {mode === 'single' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {step === 0 && onBack && <Btn label="← Methods" onClick={onBack} />}
              {step > 0 && <Btn label="← Back" onClick={() => setStep(0)} />}
              <StepDots current={step} total={2} />
            </div>
            {step === 0 && <Btn label="Next → Review" accent disabled={!canProceed} onClick={() => setStep(1)} />}
            {step === 1 && <Btn label="Register Asset" accent onClick={handleRegister} />}
          </>
        )}
        {mode === 'bulk' && bulkStep === 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {onBack && <Btn label="← Methods" onClick={onBack} />}
            </div>
            <Btn label="Upload & Validate" accent disabled={!bulkFile} onClick={handleBulkValidate} />
          </>
        )}
        {mode === 'bulk' && bulkStep === 1 && (
          <>
            <Btn label="← Back" onClick={() => setBulkStep(0)} />
            {validBulkCount > 0 ? (
              <Btn
                label={`Import ${validBulkCount} Asset${validBulkCount !== 1 ? 's' : ''}`}
                accent
                onClick={handleBulkImport}
              />
            ) : (
              <Btn label="No valid assets to import" disabled />
            )}
          </>
        )}
        {mode === 'bulk' && bulkStep === 2 && (
          <>
            <div />
            <Btn label="Done" accent onClick={() => {
              onComplete({
                bulk: true,
                assets: bulkResults.filter(r => r.status === 'valid'),
              })
            }} />
          </>
        )}
      </ModalFooter>
    </Modal>
  )
  return (
    <>
      {_noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>}
      {showQSPicker && (
        <QualifiedStoragePicker
          activeParty={activeParty}
          mode="single"
          accept=".csv"
          onSelect={(files) => {
            if (files.length > 0) {
              setBulkFile(files[0].name)
              setBulkSource('qs')
            }
            setShowQSPicker(false)
          }}
          onCancel={() => setShowQSPicker(false)}
        />
      )}
    </>
  )
}
