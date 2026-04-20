// V22CreateAssetModal — Phase 9A.3.
//
// Registers a new V2.2 Asset from a single file picked out of the actor's
// Qualified Storage bucket. Per spec §3.2 an Asset = exactly one evidence
// file; the filename is the display name (no separate name field).
//
// Two-step flow:
//   0  Select file  — opens V22QualifiedStoragePicker (mode="single")
//   1  Review       — filename, size, mime, owner, registration timestamp
//
// Nested-modal support: passing `nested` suppresses the backdrop and bumps
// the QS picker's z-index so the parent modal's own z-index doesn't mask
// the picker. Used by V22CreateClaimModal's inline "+ Register new Asset"
// CTA (backlog #34 / Gate B).
//
// Submit: callers receive `{ file }` where file is the V22QualifiedStoragePicker
// payload (uri/filename/size/mimeType/hash + display* siblings). V2App turns
// that into a V2.2 Asset artifact via `makeAsset` + the ownership DA. The
// modal itself doesn't mint ids or call factories — it stays a pure form.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, InfoRow, StepDots,
} from './ModalShared'
import V22QualifiedStoragePicker from './V22QualifiedStoragePicker.jsx'

function displaySize(file) {
  if (file?.displaySize) return file.displaySize
  if (file?.size == null) return '—'
  if (file.size < 1024) return `${file.size} B`
  if (file.size < 1024 * 1024) return `${(file.size / 1024).toFixed(1)} KB`
  return `${(file.size / (1024 * 1024)).toFixed(2)} MB`
}

// Derive a display name from the filename: strip the extension, replace
// separators with spaces. Assets in the seeded dataset use curated names
// ("Power Regulation Module Datasheet" for `powerregulationmodule-datasheet.pdf`)
// but Phase 9A.3's scope deliberately omits a separate name field — the
// filename stem is what the user reads on the card.
function derivedNameFromFilename(filename) {
  if (!filename) return ''
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function V22CreateAssetModal({
  activeParty,
  nested = false,          // true when opened from inside another modal (Gate B)
  onClose,
  onComplete,              // ({ file, displayName }) => void — V2App builds artifacts
}) {
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [showPicker, setShowPicker] = useState(false)

  const displayName = derivedNameFromFilename(file?.filename)

  // QS picker overlay — the picker is itself a fixed full-screen surface,
  // so rendering it as a sibling of the modal content is fine. When the
  // modal is nested (Gate B) we bump the picker's zIndex so it lands above
  // both the nested modal and its parent.
  if (showPicker) {
    return (
      <V22QualifiedStoragePicker
        activeParty={activeParty}
        mode="single"
        onSelect={(payload) => {
          setFile(payload)
          setShowPicker(false)
        }}
        onCancel={() => setShowPicker(false)}
        zIndex={nested ? 10010 : 9999}
      />
    )
  }

  const canReview = !!file

  const handleRegister = () => {
    if (!file) return
    onComplete?.({ file, displayName })
  }

  const content = (
    <Modal width={620}>
      <ModalHeader
        title="Register Asset"
        subtitle={
          <>Register a new Asset under <strong style={{ color: 'var(--text-primary)' }}>{activeParty}</strong> from a file in Qualified Storage.</>
        }
        step={step + 1}
        totalSteps={2}
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
              Every V2.2 Asset references exactly one evidence file from Qualified Storage.
              The file's filename becomes the Asset's display name; you can create Claims and
              run parses against the new Asset immediately after registration.
            </div>

            <FieldLabel label="Evidence file" required />

            {file ? (
              <div style={{
                padding: '12px 14px', borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '3px 6px', borderRadius: 3, letterSpacing: '0.06em',
                  color: 'var(--accent-green)',
                  background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                }}>
                  {(file.displayType || file.mimeType?.split('/')[1] || 'FILE').toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.filename}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {displaySize(file)}{file.displayDate ? ` · ${file.displayDate}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => { setFile(null); setShowPicker(true) }}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '5px 10px', fontSize: 10,
                    fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                    cursor: 'pointer', letterSpacing: '0.04em',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  ✕ Change file
                </button>
              </div>
            ) : (
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
                Select from Qualified Storage
              </button>
            )}
          </>
        )}

        {step === 1 && (
          <div>
            <div style={{
              padding: 18, borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                letterSpacing: '0.12em', color: 'var(--text-tertiary)',
                marginBottom: 10,
              }}>NEW ASSET</div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                marginBottom: 14, lineHeight: 1.3,
              }}>
                {displayName || file?.filename || '—'}
              </div>

              <InfoRow label="Filename" value={file?.filename} />
              <InfoRow label="Size" value={displaySize(file)} />
              <InfoRow label="MIME" value={file?.mimeType || '—'} />
              <InfoRow label="Owner" value={activeParty} />
              <InfoRow label="Registration" value="On submit" />
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              The Asset will render on your canvas with a NEW badge and connect to you
              via an internal (Full) Disclosure Agreement. No counterparty acceptance is
              required — Asset registration is unilateral.
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
            label="Review →"
            accent
            disabled={!canReview}
            onClick={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Btn
            label="Register Asset"
            accent
            onClick={handleRegister}
          />
        )}
      </ModalFooter>
    </Modal>
  )

  return nested ? content : <Backdrop onClose={onClose}>{content}</Backdrop>
}
