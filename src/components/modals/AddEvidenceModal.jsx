import { useState, useRef } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'
import QualifiedStoragePicker, { CloudIcon } from './QualifiedStoragePicker'

const inputStyle = {
  width: '100%', height: 38, padding: '0 14px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
  outline: 'none', marginBottom: 18,
}

export default function AddEvidenceModal({ parentNode, activeParty, onClose, onComplete, _noBackdrop }) {
  const [name, setName] = useState('')
  const [filename, setFilename] = useState('')
  const [source, setSource] = useState('local')
  const [showQSPicker, setShowQSPicker] = useState(false)
  const [qsFile, setQSFile] = useState(null)
  const [endorsing, setEndorsing] = useState(false)
  const [endorseStep, setEndorseStep] = useState(null)
  const [endorsePin, setEndorsePin] = useState(null)
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

        {/* Source tabs */}
        <div style={{ display: 'flex', marginBottom: 14, borderBottom: '2px solid var(--border)' }}>
          <div
            onClick={() => setSource('local')}
            style={{
              padding: '8px 16px', fontSize: 12, fontFamily: 'var(--font-mono)',
              cursor: 'pointer', fontWeight: 600,
              color: source === 'local' ? 'var(--accent-blue)' : 'var(--text-dim)',
              borderBottom: source === 'local' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>&uarr;</span> Local file
          </div>
          <div
            onClick={() => setSource('qs')}
            style={{
              padding: '8px 16px', fontSize: 12, fontFamily: 'var(--font-mono)',
              cursor: 'pointer', fontWeight: 600,
              color: source === 'qs' ? 'var(--accent-green)' : 'var(--text-dim)',
              borderBottom: source === 'qs' ? '2px solid var(--accent-green)' : '2px solid transparent',
              marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <CloudIcon size={12} /> Qualified Storage
          </div>
        </div>

        {source === 'local' ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '20px', height: 160,
              border: `1.5px dashed ${filename && source === 'local' ? 'var(--accent-green)' : 'var(--border)'}`,
              borderRadius: 8,
              background: filename && source === 'local'
                ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)'
                : 'var(--bg-card)',
              cursor: 'pointer', transition: 'all 150ms',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            {filename && source === 'local' ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{filename}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Click to change file</div>
              </>
            ) : (
              <>
                <svg width={24} height={24} viewBox="0 0 16 16" fill="none" stroke="var(--text-dim)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
                  <path d="M8 2v8M4 6l4-4 4 4" />
                  <path d="M2 12v2h12v-2" />
                </svg>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Choose a file...</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>PDF, image, or any document</div>
              </>
            )}
          </div>
        ) : (
          <div
            onClick={endorsing ? undefined : () => setShowQSPicker(true)}
            style={{
              padding: '20px', height: 160,
              border: `1.5px dashed ${qsFile ? 'var(--accent-green)' : 'var(--border)'}`,
              borderRadius: 8,
              background: qsFile
                ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)'
                : 'var(--bg-card)',
              cursor: endorsing ? 'default' : 'pointer', transition: 'all 150ms',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            {endorsing ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{qsFile.name}</div>
                {endorseStep === 'hashing' && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>Hashing file...</span>
                )}
                {endorseStep === 'endorsing' && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>Endorsing on ledger...</span>
                )}
                {endorseStep === 'done' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-green)',
                      padding: '3px 10px', borderRadius: 4,
                      background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                    }}>
                      &#10003; {endorsePin}
                    </span>
                  </div>
                )}
              </>
            ) : qsFile ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{qsFile.name}</div>
                <div style={{
                  fontSize: 11, color: 'var(--text-dim)', marginTop: 4,
                  maxWidth: 300, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>{qsFile.path} &middot; {qsFile.size}</div>
                {endorsePin && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-green)',
                      padding: '3px 10px', borderRadius: 4,
                      background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                    }}>
                      &#10003; {endorsePin}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 4 }}>Click to change</div>
              </>
            ) : (
              <>
                <svg width={24} height={24} viewBox="0 0 16 16" fill="none" stroke="var(--text-dim)" strokeWidth="1.0" style={{ marginBottom: 6 }}>
                  <path d="M4 11.5a3.5 3.5 0 01-.5-6.96A5 5 0 0113 6a4 4 0 01-1 7.9H4z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Browse Qualified Storage...</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Select a file from your connected AWS S3 bucket</div>
              </>
            )}
          </div>
        )}

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

  return (
    <>
      {_noBackdrop ? content : <Backdrop onClose={onClose}>{content}</Backdrop>}
      {showQSPicker && (
        <QualifiedStoragePicker
          activeParty={activeParty}
          mode="single"
          onSelect={(files) => {
            if (files.length > 0) {
              setQSFile(files[0])
              setFilename(files[0].name)
              if (!name) setName(files[0].name)
              setShowQSPicker(false)
              // Start Hash & Endorse animation
              setEndorsing(true)
              setEndorseStep('hashing')
              setTimeout(() => setEndorseStep('endorsing'), 1000)
              setTimeout(() => {
                setEndorseStep('done')
                setEndorsePin(`PIN-0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`)
              }, 2200)
              setTimeout(() => setEndorsing(false), 3500)
            } else {
              setShowQSPicker(false)
            }
          }}
          onCancel={() => setShowQSPicker(false)}
        />
      )}
    </>
  )
}
