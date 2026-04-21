// V22CreateAssetModal — Phase 9A.3, rebuilt in Phase 9A.6 Gate B.
//
// Registers N Assets (N >= 1) in one flow. Each selected file becomes its
// own V2.2 Asset. Per spec §3.2 an Asset = exactly one evidence file.
//
// Three-step flow:
//   0  Select files       — opens V22QualifiedStoragePicker (mode="multi").
//                            Picker returns array of payloads; QS picks + local
//                            uploads merge. Single-file is just N=1.
//   1  Per-file review    — editable label per file, mime badge + size,
//                            per-file hashing sequence (9A.6 #68), remove.
//   2  Final review       — per-file summary list + aggregate credit cost.
//
// Each Asset gets:
//   • a filename-stem default display name (editable in step 1)
//   • a mock sha256 hash computed during step 1's hashing sequence
//   • its own _isNew reveal on the recipient canvas
//
// Nested-modal support: `nested` suppresses the backdrop and bumps the QS
// picker's z-index. V22CreateClaimModal and AmendClaimModal use this mode
// for their inline "+ Register new Asset…" CTA.
//
// Submit: `onComplete({ files: [{ file, displayName, hash }] })`. The caller
// (V2App) iterates and produces one Asset per entry via
// `makeAssetRegistrationArtifacts`. Legacy single-file callers (none after
// 9A.6, but preserved) can use the first entry.

import { useState, useEffect, useRef } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, InfoRow, StepDots, CreditCostRow, CopyBadge,
} from './ModalShared'
import V22QualifiedStoragePicker from './V22QualifiedStoragePicker.jsx'

function displaySize(file) {
  if (file?.displaySize) return file.displaySize
  if (file?.size == null) return '—'
  if (file.size < 1024) return `${file.size} B`
  if (file.size < 1024 * 1024) return `${(file.size / 1024).toFixed(1)} KB`
  return `${(file.size / (1024 * 1024)).toFixed(2)} MB`
}

function derivedNameFromFilename(filename) {
  if (!filename) return ''
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Deterministic mock sha256-looking hex, seeded from filename + size so the
// same file always produces the same mock hash. Real implementation would
// hash file bytes — this is demo-grade per the 9A.6 task.
function mockHashFor(file) {
  const seed = `${file.filename || file.name || ''}::${file.size ?? file.bytes ?? 0}`
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  // Expand 32-bit seed into 64-char hex via a tiny xorshift.
  let state = h >>> 0 || 1
  let out = ''
  for (let i = 0; i < 64; i++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    out += (state & 0xf).toString(16)
  }
  return `sha256:${out}`
}

// Phase 9A.6 Gate B (#68): per-file hashing sequence. Timing + motion
// pattern-matches the V2.2 processing UIs (V22RunEvaluationModal's
// processing stage), since no dedicated V2.1 HashingSequence reference
// was provided for this phase.
const HASH_DURATION_MS = 900

function HashingRow({ phase, hashValue, onComplete, file }) {
  const tickRef = useRef(null)
  useEffect(() => {
    if (phase !== 'hashing') return
    const start = Date.now()
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const elapsed = Date.now() - start
      if (elapsed >= HASH_DURATION_MS) {
        onComplete(mockHashFor(file))
        return
      }
      // Rotate the scrolling hex chars for motion feel
      tickRef.current = requestAnimationFrame(tick)
    }
    tickRef.current = requestAnimationFrame(tick)
    return () => { cancelled = true; if (tickRef.current) cancelAnimationFrame(tickRef.current) }
    // onComplete is intentionally excluded — the setter closure is stable for
    // the duration we care about (one hashing tick).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  if (phase === 'pending') {
    return (
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
        Pending
      </span>
    )
  }
  if (phase === 'hashing') {
    // Motion: spinning hex dots + scrolling hex characters
    const scroll = 'abcdef0123456789'
    const offset = Math.floor((Date.now() / 80) % scroll.length)
    const hexDance = scroll.slice(offset) + scroll.slice(0, offset)
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
      }}>
        <span style={{
          display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
          border: '1.5px solid var(--accent-indigo)',
          borderTopColor: 'transparent',
          animation: 'spin 600ms linear infinite',
        }} />
        <span style={{ letterSpacing: '0.04em', opacity: 0.75 }}>
          HASHING {hexDance.slice(0, 6)}…
        </span>
      </span>
    )
  }
  // complete
  return (
    <CopyBadge value={hashValue} truncated />
  )
}

export default function V22CreateAssetModal({
  activeParty,
  credits = Infinity,
  creditsPerAsset = 0,
  nested = false,
  onClose,
  onComplete,              // ({ files }) => void — files: [{ file, displayName, hash }]
}) {
  const [step, setStep] = useState(0)
  // Each row: { id, file, label, hashPhase: 'pending'|'hashing'|'complete', hash }
  const [rows, setRows] = useState([])
  const [showPicker, setShowPicker] = useState(false)

  const handlePickerSelect = (payload) => {
    setShowPicker(false)
    // Picker returns array in multi-mode; wrap singles for consistency.
    const files = Array.isArray(payload) ? payload : [payload]
    const newRows = files.map((f, i) => ({
      id: `row-${Date.now()}-${i}-${(f.filename || 'file').replace(/[^\w.-]+/g, '_')}`,
      file: f,
      label: derivedNameFromFilename(f.filename),
      hashPhase: 'hashing', // start hashing immediately after selection
      hash: null,
    }))
    setRows(newRows)
    setStep(1)
  }

  const setRowLabel = (id, label) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, label: label.slice(0, 100) } : r))
  }

  const setRowHash = (id, hash) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, hashPhase: 'complete', hash } : r))
  }

  const removeRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  if (showPicker) {
    return (
      <V22QualifiedStoragePicker
        activeParty={activeParty}
        mode="multi"
        onSelect={handlePickerSelect}
        onCancel={() => setShowPicker(false)}
        zIndex={10010}
      />
    )
  }

  const allHashed = rows.length > 0 && rows.every(r => r.hashPhase === 'complete')
  const allLabeled = rows.every(r => r.label.trim().length > 0)
  const canReview = rows.length > 0 && allHashed && allLabeled
  const totalCost = creditsPerAsset * rows.length
  const hasSufficientCredits = credits >= totalCost

  const handleRegister = () => {
    if (!canReview) return
    if (!hasSufficientCredits) return
    onComplete?.({
      files: rows.map(r => ({
        file: { ...r.file, hash: r.hash },
        displayName: r.label.trim(),
        hash: r.hash,
      })),
    })
  }

  const content = (
    <Modal width={720}>
      <ModalHeader
        title={rows.length > 1 ? `Register ${rows.length} Assets` : 'Register Asset'}
        subtitle={
          <>Register {rows.length > 1 ? `${rows.length} new Assets` : 'a new Asset'} under <strong style={{ color: 'var(--text-primary)' }}>{activeParty}</strong> from files in Qualified Storage.</>
        }
        step={step + 1}
        totalSteps={3}
        onClose={onClose}
      />
      <ModalBody>
        {step === 0 && (
          <>
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 18,
              background: 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
              fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
            }}>
              Every V2.2 Asset references exactly one evidence file. Select one or many
              — each file becomes its own Asset. You'll be able to edit display names
              and watch each file get hashed before final confirmation.
            </div>
            <FieldLabel label="Evidence files" required />
            <button
              onClick={() => setShowPicker(true)}
              style={{
                width: '100%', padding: '20px 0', borderRadius: 8, cursor: 'pointer',
                border: '1.5px dashed var(--border)',
                background: 'var(--bg-card)', color: 'var(--text-tertiary)',
                fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'border-color 150ms, color 150ms, background 150ms',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-green)'
                e.currentTarget.style.color = 'var(--accent-green)'
                e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green) 4%, transparent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-tertiary)'
                e.currentTarget.style.background = 'var(--bg-card)'
              }}
            >
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 11.5a3.5 3.5 0 01-.5-6.96A5 5 0 0113 6a4 4 0 01-1 7.9H4z" />
              </svg>
              Open Qualified Storage
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
              {rows.length} file{rows.length === 1 ? '' : 's'} selected. Each file's display name
              defaults to its filename stem — edit to taste. The hash is computed as each file
              registers.
            </div>
            <div style={{
              maxHeight: 380, overflowY: 'auto',
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--bg-card)',
            }}>
              {rows.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    padding: '12px 14px',
                    borderBottom: i < rows.length - 1 ? '1px solid var(--border-faint)' : 'none',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '3px 6px', borderRadius: 3, letterSpacing: '0.06em',
                      color: 'var(--accent-green)',
                      background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                    }}>
                      {(r.file.displayType || r.file.mimeType?.split('/')[1] || 'FILE').toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.file.filename}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {displaySize(r.file)}{r.file.source === 'local' ? ' · Uploaded' : ''}
                      </div>
                    </div>
                    <HashingRow
                      phase={r.hashPhase}
                      hashValue={r.hash}
                      file={r.file}
                      onComplete={(h) => setRowHash(r.id, h)}
                    />
                    <button
                      onClick={() => removeRow(r.id)}
                      style={{
                        background: 'transparent', border: 'none',
                        color: 'var(--text-dim)', cursor: 'pointer',
                        fontSize: 14, padding: '0 4px', lineHeight: 1,
                      }}
                      title="Remove this file from the batch"
                      aria-label="Remove"
                    >✕</button>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={r.label}
                      onChange={(e) => setRowLabel(r.id, e.target.value)}
                      placeholder="Display name"
                      maxLength={100}
                      style={{
                        width: '100%', padding: '7px 10px', borderRadius: 6,
                        border: `1px solid ${r.label.trim() ? 'var(--border)' : 'var(--accent-red)'}`,
                        background: 'var(--bg-deep)',
                        color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 12,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {!allHashed && (
              <div style={{
                marginTop: 10, fontSize: 11, color: 'var(--accent-amber)',
                fontStyle: 'italic', lineHeight: 1.5,
              }}>
                Hashing in progress — Continue enables when every file is hashed.
              </div>
            )}
            <button
              onClick={() => setShowPicker(true)}
              style={{
                width: '100%', padding: '9px 14px', marginTop: 10, borderRadius: 6, cursor: 'pointer',
                border: '1px dashed var(--accent-green)',
                background: 'transparent',
                color: 'var(--accent-green)',
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              + Add more files…
            </button>
          </>
        )}

        {step === 2 && (
          <div>
            <div style={{
              padding: 18, borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                letterSpacing: '0.12em', color: 'var(--text-tertiary)',
                marginBottom: 10,
              }}>{rows.length > 1 ? 'NEW ASSETS' : 'NEW ASSET'}</div>
              <InfoRow label="Count" value={String(rows.length)} />
              <InfoRow label="Owner" value={activeParty} />
              <InfoRow label="Registration" value="On submit" />
            </div>
            <div style={{
              marginTop: 12,
              borderRadius: 6, overflow: 'hidden',
              border: '1px solid var(--border)', background: 'var(--bg-deep)',
            }}>
              {rows.map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                    background: 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)',
                    color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)',
                  }}>ASSET</span>
                  <span style={{
                    fontSize: 11, color: 'var(--text-primary)', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.label.trim() || r.file.filename}
                  </span>
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                  }}>
                    {displaySize(r.file)}
                  </span>
                </div>
              ))}
            </div>
            {creditsPerAsset > 0 && (
              <CreditCostRow cost={totalCost} credits={credits} sufficient={hasSufficientCredits} />
            )}
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              {rows.length > 1 ? 'Each Asset' : 'The Asset'} will render on your canvas with a NEW badge
              and connect to you via an internal (Full) Disclosure Agreement. No counterparty
              acceptance is required — Asset registration is unilateral.
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={() => setStep(s => Math.max(0, s - 1))} />}
          <StepDots current={step} total={3} />
        </div>
        {step === 0 && (
          <Btn
            label="Review →"
            accent
            disabled={rows.length === 0}
            onClick={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Btn
            label="Review →"
            accent
            disabled={!canReview}
            onClick={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Btn
            label={
              !hasSufficientCredits ? 'Insufficient Credits'
                : rows.length > 1 ? `Register ${rows.length} Assets` : 'Register Asset'
            }
            accent
            disabled={!hasSufficientCredits}
            onClick={handleRegister}
          />
        )}
      </ModalFooter>
    </Modal>
  )

  return nested ? content : <Backdrop onClose={onClose}>{content}</Backdrop>
}
