import { useState, useEffect, useCallback } from 'react'

/* ─── Mock File System ─── */
const MOCK_BUCKETS = {
  GovCo: {
    bucket: 's3://govco-qualified-storage',
    folders: {
      '/': ['sentinel-program', 'avionics-data', 'compliance-docs'],
      '/sentinel-program': ['manufacturing-reports', 'test-data'],
      '/sentinel-program/manufacturing-reports': [],
      '/sentinel-program/test-data': [],
      '/avionics-data': ['specifications', 'certifications'],
      '/avionics-data/specifications': [],
      '/avionics-data/certifications': [],
      '/compliance-docs': [],
    },
    files: {
      '/sentinel-program/manufacturing-reports': [
        { name: 'sentinel4-assembly-report.pdf', size: '2.4 MB', date: '2026-03-15', type: 'pdf' },
        { name: 'propulsion-test-results.pdf', size: '1.8 MB', date: '2026-03-12', type: 'pdf' },
        { name: 'thermal-analysis-v2.pdf', size: '3.1 MB', date: '2026-03-10', type: 'pdf' },
      ],
      '/sentinel-program/test-data': [
        { name: 'vibration-test-data.csv', size: '890 KB', date: '2026-03-14', type: 'csv' },
        { name: 'EMI-test-log.csv', size: '1.2 MB', date: '2026-03-11', type: 'csv' },
        { name: 'batch-registration-template.csv', size: '12 KB', date: '2026-03-09', type: 'csv' },
      ],
      '/avionics-data/specifications': [
        { name: 'avionics-module-datasheet.pdf', size: '4.6 MB', date: '2026-03-18', type: 'pdf' },
        { name: 'power-supply-spec.pdf', size: '2.2 MB', date: '2026-03-16', type: 'pdf' },
      ],
      '/avionics-data/certifications': [
        { name: 'DO-178C-compliance.pdf', size: '5.3 MB', date: '2026-03-17', type: 'pdf' },
        { name: 'AS9100-audit-report.pdf', size: '1.9 MB', date: '2026-03-13', type: 'pdf' },
      ],
      '/compliance-docs': [
        { name: 'ITAR-classification-memo.pdf', size: '420 KB', date: '2026-03-20', type: 'pdf' },
        { name: 'EAR-export-review.pdf', size: '680 KB', date: '2026-03-19', type: 'pdf' },
        { name: 'supplier-qualification-matrix.csv', size: '340 KB', date: '2026-03-08', type: 'csv' },
      ],
    },
  },
  MicroCo: {
    bucket: 's3://microco-qualified-storage',
    folders: {
      '/': ['product-data', 'test-reports', 'certifications'],
      '/product-data': ['datasheets', 'design-files'],
      '/product-data/datasheets': [],
      '/product-data/design-files': [],
      '/test-reports': ['electrical', 'environmental'],
      '/test-reports/electrical': [],
      '/test-reports/environmental': [],
      '/certifications': [],
    },
    files: {
      '/product-data/datasheets': [
        { name: 'powerregulationmodule-datasheet.pdf', size: '3.8 MB', date: '2026-03-20', type: 'pdf' },
        { name: 'voltageregulator-datasheet.pdf', size: '2.1 MB', date: '2026-03-18', type: 'pdf' },
        { name: 'emi-shield-spec.pdf', size: '1.4 MB', date: '2026-03-15', type: 'pdf' },
        { name: 'thermal-interface-pad-spec.pdf', size: '980 KB', date: '2026-03-14', type: 'pdf' },
        { name: 'connector-assembly-drawing.pdf', size: '2.6 MB', date: '2026-03-12', type: 'pdf' },
        { name: 'pcb-substrate-stackup.pdf', size: '1.7 MB', date: '2026-03-10', type: 'pdf' },
      ],
      '/product-data/design-files': [
        { name: 'pcb-layout-rev3.zip', size: '18.4 MB', date: '2026-03-19', type: 'zip' },
        { name: 'schematic-capture.zip', size: '8.2 MB', date: '2026-03-17', type: 'zip' },
      ],
      '/test-reports/electrical': [
        { name: 'hipot-test-results.pdf', size: '1.1 MB', date: '2026-03-16', type: 'pdf' },
        { name: 'power-integrity-analysis.pdf', size: '2.3 MB', date: '2026-03-13', type: 'pdf' },
        { name: 'signal-integrity-report.csv', size: '560 KB', date: '2026-03-11', type: 'csv' },
      ],
      '/test-reports/environmental': [
        { name: 'thermal-cycling-results.pdf', size: '1.5 MB', date: '2026-03-15', type: 'pdf' },
        { name: 'humidity-test-log.csv', size: '340 KB', date: '2026-03-09', type: 'csv' },
        { name: 'altitude-test-data.csv', size: '220 KB', date: '2026-03-07', type: 'csv' },
      ],
      '/certifications': [
        { name: 'ISO-9001-certificate.pdf', size: '890 KB', date: '2026-03-21', type: 'pdf' },
        { name: 'RoHS-compliance-cert.pdf', size: '450 KB', date: '2026-03-20', type: 'pdf' },
        { name: 'batch-components.csv', size: '28 KB', date: '2026-03-18', type: 'csv' },
      ],
    },
  },
}

/* ─── File type badge ─── */
function FileIcon({ type }) {
  const config = {
    pdf: { bg: 'color-mix(in srgb, var(--accent-red) 12%, transparent)', color: 'var(--accent-red)', label: 'PDF' },
    csv: { bg: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', color: 'var(--accent-green)', label: 'CSV' },
    zip: { bg: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)', color: 'var(--accent-blue)', label: 'ZIP' },
    txt: { bg: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)', color: 'var(--accent-amber)', label: 'TXT' },
  }
  const c = config[type] || { bg: 'var(--bg-raised)', color: 'var(--text-dim)', label: type?.toUpperCase() || 'FILE' }
  return (
    <span style={{
      fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
      padding: '3px 6px', borderRadius: 3,
      background: c.bg, color: c.color,
      display: 'inline-flex', alignItems: 'center',
    }}>{c.label}</span>
  )
}

/* ─── Shield icon ─── */
function ShieldIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="var(--accent-green)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L2.5 4v4c0 3.5 2.3 5.5 5.5 6.5 3.2-1 5.5-3 5.5-6.5V4L8 1.5z" />
      <path d="M5.5 8l2 2 3-3.5" />
    </svg>
  )
}

/* ─── Cloud icon ─── */
function CloudIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M4 11.5a3.5 3.5 0 01-.5-6.96A5 5 0 0113 6a4 4 0 01-1 7.9H4z" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function QualifiedStoragePicker({ activeParty, mode = 'single', accept, onSelect, onCancel }) {
  const data = MOCK_BUCKETS[activeParty] || MOCK_BUCKETS.GovCo
  const [currentPath, setCurrentPath] = useState('/')
  const [selected, setSelected] = useState(new Set())
  const [step, setStep] = useState('browse') // 'browse' | 'endorse'
  const [endorsePhase, setEndorsePhase] = useState([])

  const folders = data.folders[currentPath] || []
  const allFiles = data.files[currentPath] || []
  const files = accept
    ? allFiles.filter(f => f.name.endsWith(accept))
    : allFiles

  const navigateTo = useCallback((folder) => {
    const newPath = currentPath === '/' ? `/${folder}` : `${currentPath}/${folder}`
    setCurrentPath(newPath)
    setSelected(new Set())
  }, [currentPath])

  const navigateUp = useCallback(() => {
    if (currentPath === '/') return
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/') || '/')
    setSelected(new Set())
  }, [currentPath])

  const navigateToBreadcrumb = useCallback((idx) => {
    const parts = currentPath.split('/').filter(Boolean)
    const newPath = '/' + parts.slice(0, idx).join('/')
    setCurrentPath(newPath === '/' ? '/' : newPath)
    setSelected(new Set())
  }, [currentPath])

  const toggleFile = useCallback((fileName) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (mode === 'single') {
        if (next.has(fileName)) { next.delete(fileName) } else { next.clear(); next.add(fileName) }
      } else {
        if (next.has(fileName)) { next.delete(fileName) } else { next.add(fileName) }
      }
      return next
    })
  }, [mode])

  const toggleAll = useCallback(() => {
    if (selected.size === files.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(files.map(f => f.name)))
    }
  }, [files, selected])

  const selectedFiles = files.filter(f => selected.has(f.name)).map(f => ({
    ...f,
    path: `${data.bucket}${currentPath}/${f.name}`,
  }))

  // Hash & Endorse animation
  useEffect(() => {
    if (step !== 'endorse') return
    setEndorsePhase([])
    selectedFiles.forEach((_, i) => {
      setTimeout(() => {
        setEndorsePhase(prev => [...prev.filter(p => p.idx !== i), { idx: i, step: 'hashing' }])
      }, i * 1200)
      setTimeout(() => {
        setEndorsePhase(prev => prev.map(p => p.idx === i ? { ...p, step: 'endorsing' } : p))
      }, i * 1200 + 800)
      setTimeout(() => {
        setEndorsePhase(prev => prev.map(p => p.idx === i ? {
          ...p, step: 'done',
          pin: `PIN-0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        } : p))
      }, i * 1200 + 1600)
    })
  }, [step])

  const allEndorsed = endorsePhase.length >= selectedFiles.length && endorsePhase.every(p => p.step === 'done')

  // Escape handler
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        if (step === 'endorse') setStep('browse')
        else onCancel()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [step, onCancel])

  const breadcrumbs = ['root', ...currentPath.split('/').filter(Boolean)]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg-deep)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <ShieldIcon size={18} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          Qualified Storage
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>&middot;</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-green)' }}>
          {data.bucket}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onCancel}
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 6, padding: '6px 14px', fontSize: 11,
            fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
            cursor: 'pointer', transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          Close
        </button>
      </div>

      {step === 'browse' ? (
        <>
          {/* Breadcrumb */}
          <div style={{
            padding: '10px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}>
            {breadcrumbs.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span style={{ color: 'var(--text-dim)', margin: '0 4px' }}>/</span>}
                <span
                  onClick={() => navigateToBreadcrumb(i)}
                  style={{
                    color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--accent-indigo)',
                    cursor: i === breadcrumbs.length - 1 ? 'default' : 'pointer',
                    fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                  }}
                >
                  {i === 0 ? data.bucket : crumb}
                </span>
              </span>
            ))}
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px' }}>
            {/* Back button */}
            {currentPath !== '/' && (
              <div
                onClick={navigateUp}
                style={{
                  padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: '1px solid var(--border)', transition: 'color 100ms',
                  color: 'var(--text-dim)',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-indigo)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >
                <span style={{ fontSize: 12 }}>&larr;</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>..</span>
              </div>
            )}

            {/* Folders */}
            {folders.map(folder => (
              <div
                key={folder}
                onClick={() => navigateTo(folder)}
                style={{
                  padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: '1px solid var(--border)', transition: 'background 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 14, color: 'var(--accent-amber)', width: 28, textAlign: 'center', flexShrink: 0 }}>
                  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="var(--accent-amber)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4.5V12a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3.5H3a1 1 0 00-1 1z" />
                  </svg>
                </span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{folder}</span>
              </div>
            ))}

            {/* Select all (multi mode) */}
            {mode === 'multi' && files.length > 0 && (
              <div
                onClick={toggleAll}
                style={{
                  padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: '1px solid var(--border)',
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
                }}
              >
                {selected.size === files.length ? 'Deselect all' : 'Select all'} ({files.length} files)
              </div>
            )}

            {/* Files */}
            {files.map(file => {
              const isSelected = selected.has(file.name)
              return (
                <div
                  key={file.name}
                  onClick={() => toggleFile(file.name)}
                  style={{
                    padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: '1px solid var(--border)', transition: 'background 100ms',
                    background: isSelected ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-raised)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${isSelected ? 'var(--accent-green)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 150ms',
                  }}>
                    {isSelected && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>&#10003;</span>}
                  </div>
                  <FileIcon type={file.type} />
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {file.name}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', width: 80, textAlign: 'right' }}>
                    {file.size}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', width: 90, textAlign: 'right' }}>
                    {file.date}
                  </span>
                </div>
              )
            })}

            {/* Empty state */}
            {folders.length === 0 && files.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                No {accept ? accept.replace('.', '').toUpperCase() + ' ' : ''}files in this folder
              </div>
            )}
          </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <button
              onClick={onCancel}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 18px', fontSize: 12,
                fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              onClick={() => { if (selected.size > 0) setStep('endorse') }}
              disabled={selected.size === 0}
              style={{
                background: selected.size > 0
                  ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                  : 'transparent',
                border: `1px solid ${selected.size > 0 ? 'var(--accent-green)' : 'var(--border)'}`,
                borderRadius: 6, padding: '8px 18px', fontSize: 12,
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: selected.size > 0 ? 'var(--accent-green)' : 'var(--text-dim)',
                cursor: selected.size > 0 ? 'pointer' : 'default',
                opacity: selected.size > 0 ? 1 : 0.4,
              }}
            >
              Select {selected.size} File{selected.size !== 1 ? 's' : ''} &rarr;
            </button>
          </div>
        </>
      ) : (
        /* ─── Hash & Endorse Step ─── */
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: 16,
            }}>
              HASH &amp; ENDORSE ({selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''})
            </div>

            {selectedFiles.map((file, i) => {
              const phase = endorsePhase.find(p => p.idx === i)
              return (
                <div key={file.name} style={{
                  padding: '14px 18px', marginBottom: 8,
                  background: 'var(--bg-card)', borderRadius: 8,
                  border: `1px solid ${phase?.step === 'done' ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'border-color 300ms',
                }}>
                  <FileIcon type={file.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>{file.path}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!phase && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Waiting...</span>}
                    {phase?.step === 'hashing' && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>
                        Hashing...
                      </span>
                    )}
                    {phase?.step === 'endorsing' && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
                        Endorsing on ledger...
                      </span>
                    )}
                    {phase?.step === 'done' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--accent-green)', fontSize: 13 }}>&#10003;</span>
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)',
                          padding: '2px 8px', borderRadius: 4,
                          background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                        }}>
                          {phase.pin}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <button
              onClick={() => { setStep('browse'); setEndorsePhase([]) }}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 18px', fontSize: 12,
                fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >&larr; Back</button>
            <button
              onClick={() => onSelect(selectedFiles)}
              disabled={!allEndorsed}
              style={{
                background: allEndorsed
                  ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                  : 'transparent',
                border: `1px solid ${allEndorsed ? 'var(--accent-green)' : 'var(--border)'}`,
                borderRadius: 6, padding: '8px 18px', fontSize: 12,
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: allEndorsed ? 'var(--accent-green)' : 'var(--text-dim)',
                cursor: allEndorsed ? 'pointer' : 'default',
                opacity: allEndorsed ? 1 : 0.4,
              }}
            >
              Confirm &amp; Return
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export { CloudIcon }
