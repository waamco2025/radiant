import { useState, useRef } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

const inputStyle = {
  width: '100%', height: 38, padding: '0 14px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
  outline: 'none', marginBottom: 18,
}

export default function AddEvidenceModal({ parentNode, activeParty, onClose, onComplete, _noBackdrop }) {
  const [name, setName] = useState('')
  const [filename, setFilename] = useState('')
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    if (!name) {
      setName(file.name)
    }
  }

  const handleSubmit = () => {
    onComplete({
      name: name || filename,
      filename,
    })
  }

  const content = (
    <Modal width={560}>
      <ModalHeader
        title="Add Evidence"
        subtitle={<>Attach a file reference to <strong style={{ color: 'var(--text-primary)' }}>{parentNode.name}</strong></>}
        onClose={onClose}
      />
      <ModalBody>
        <div style={{
          padding: '14px 16px',
          background: 'color-mix(in srgb, var(--accent-orange, #fb923c) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-orange, #fb923c) 20%, transparent)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text-tertiary)',
          lineHeight: 1.7,
          marginBottom: 22,
        }}>
          Evidence files are stored as child nodes under <strong style={{ color: 'var(--text-primary)' }}>{parentNode.name}</strong>.
          Each evidence node references a single file. After adding evidence, you can run PEP templates to parse structured data from it.
        </div>

        <FieldLabel label="Evidence label" />
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Assembly Test Report, Material Certification..."
          style={inputStyle}
        />

        <FieldLabel label="Select file" required />
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '16px 20px',
            border: `1.5px dashed ${filename ? 'var(--accent-green, #22c55e)' : 'var(--border)'}`,
            borderRadius: 8,
            background: filename
              ? 'color-mix(in srgb, var(--accent-green, #22c55e) 4%, transparent)'
              : 'var(--bg-card)',
            cursor: 'pointer',
            transition: 'all 150ms',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
          onMouseEnter={e => {
            if (!filename) e.currentTarget.style.borderColor = 'var(--border-hover)'
          }}
          onMouseLeave={e => {
            if (!filename) e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          <svg width={20} height={20} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path
              d="M10.5 4.5v6a3 3 0 01-6 0v-7a2 2 0 014 0v6.5a1 1 0 01-2 0V5"
              stroke={filename ? 'var(--accent-green, #22c55e)' : 'var(--text-dim)'}
              strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
          <div>
            {filename ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{filename}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Click to change file</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Choose a file...</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>PDF, image, or any document. File content is not uploaded in this demo.</div>
              </>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </ModalBody>
      <ModalFooter>
        <div />
        <Btn
          label="Add Evidence"
          accent
          disabled={!filename}
          onClick={handleSubmit}
        />
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? content : <Backdrop onClose={onClose}>{content}</Backdrop>
}
