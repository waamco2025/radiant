// V22QualifiedStoragePicker — Phase 9A.3.
//
// Ported from V2.1's QualifiedStoragePicker (in references/). V2.2 additions:
//   • Carol @ AuditCo bucket added alongside GovCo + MicroCo.
//   • `accept` stays but the V2.2 Create Asset flow doesn't filter today.
//   • 'single' and 'multi' modes retained. V2.2's V22CreateAssetModal uses
//     'single'; 'multi' is kept for any future flow that wants N files at
//     once (e.g., a batch-register variant).
//
// Mock-only: nothing really hits S3. Per-party file lists are tuned to
// match the demo scenarios (e.g., Bob's bucket ties to Sentinel-4 assets,
// Alice's to PRM / VReg / EMI parts, Carol's to audit evidence).

import { useState, useEffect, useCallback } from 'react'

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
      ],
    },
  },
  AuditCo: {
    bucket: 's3://auditco-qualified-storage',
    folders: {
      '/': ['engagements', 'standards', 'workpapers'],
      '/engagements': ['open', 'closed'],
      '/engagements/open': [],
      '/engagements/closed': [],
      '/standards': [],
      '/workpapers': [],
    },
    files: {
      '/engagements/open': [
        { name: 'microco-prm-engagement-memo.pdf', size: '540 KB', date: '2026-03-18', type: 'pdf' },
        { name: 'govco-vendor-audit-scope.pdf', size: '820 KB', date: '2026-03-15', type: 'pdf' },
      ],
      '/engagements/closed': [
        { name: 'supplier-audit-2025-Q4.pdf', size: '1.3 MB', date: '2026-01-10', type: 'pdf' },
        { name: 'compliance-review-closeout.pdf', size: '620 KB', date: '2025-12-18', type: 'pdf' },
      ],
      '/standards': [
        { name: 'auditco-prm-audit-checklist.pdf', size: '380 KB', date: '2026-02-04', type: 'pdf' },
        { name: 'iso-19011-guideline.pdf', size: '1.1 MB', date: '2025-11-02', type: 'pdf' },
      ],
      '/workpapers': [
        { name: 'thermal-margin-analysis.csv', size: '240 KB', date: '2026-03-17', type: 'csv' },
        { name: 'document-provenance-log.csv', size: '180 KB', date: '2026-03-12', type: 'csv' },
        { name: 'independent-lab-cross-reference.pdf', size: '890 KB', date: '2026-03-08', type: 'pdf' },
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

// Mime-type guess from file extension — used when the picker hands a file
// back into a V2.2 Asset factory call (makeAsset needs a mimeType field).
const MIME_BY_EXT = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  zip: 'application/zip',
  txt: 'text/plain',
  md: 'text/markdown',
}

// Parse "3.8 MB" / "420 KB" / "12 B" into approximate bytes — V2.2's Asset
// model stores file.size in bytes per spec §3.2. Mock picker uses display
// strings, so we normalise on the way out.
function parseDisplaySizeToBytes(sizeStr) {
  if (!sizeStr) return 0
  const m = String(sizeStr).trim().match(/^([\d.]+)\s*(KB|MB|GB|B)?$/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = (m[2] || 'B').toUpperCase()
  if (unit === 'GB') return Math.round(n * 1024 * 1024 * 1024)
  if (unit === 'MB') return Math.round(n * 1024 * 1024)
  if (unit === 'KB') return Math.round(n * 1024)
  return Math.round(n)
}

function selectedFileToV22Payload(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  return {
    uri: file.path,
    filename: file.name,
    size: parseDisplaySizeToBytes(file.size),
    mimeType: MIME_BY_EXT[ext] || 'application/octet-stream',
    hash: null,
    // Carry the display size / type / date through too — V22CreateAssetModal
    // uses these for the "Review & Confirm" step without reformatting.
    displaySize: file.size,
    displayType: file.type,
    displayDate: file.date,
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function V22QualifiedStoragePicker({
  activeParty,
  mode = 'single',
  accept,
  onSelect,
  onCancel,
  zIndex = 9999,
}) {
  const data = MOCK_BUCKETS[activeParty] || MOCK_BUCKETS.GovCo
  const [currentPath, setCurrentPath] = useState('/')
  const [selected, setSelected] = useState(new Set())
  const [previewFile, setPreviewFile] = useState(null)

  const folders = data.folders[currentPath] || []
  const allFiles = data.files[currentPath] || []
  const files = accept
    ? allFiles.filter(f => f.name.endsWith(accept))
    : allFiles

  const navigateTo = useCallback((folder) => {
    const newPath = currentPath === '/' ? `/${folder}` : `${currentPath}/${folder}`
    setCurrentPath(newPath)
    setSelected(new Set())
    setPreviewFile(null)
  }, [currentPath])

  const navigateUp = useCallback(() => {
    if (currentPath === '/') return
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/') || '/')
    setSelected(new Set())
    setPreviewFile(null)
  }, [currentPath])

  const navigateToBreadcrumb = useCallback((idx) => {
    const parts = currentPath.split('/').filter(Boolean)
    const newPath = '/' + parts.slice(0, idx).join('/')
    setCurrentPath(newPath === '/' ? '/' : newPath)
    setSelected(new Set())
    setPreviewFile(null)
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

  const handleSelect = useCallback(() => {
    if (selectedFiles.length === 0) return
    const payloads = selectedFiles.map(selectedFileToV22Payload)
    // 'single' mode hands back the lone payload (unwrapped); 'multi' hands
    // back the array. Matches the V2.1 picker's convention.
    onSelect(mode === 'single' ? payloads[0] : payloads)
  }, [selectedFiles, onSelect, mode])

  // Escape handler — captures at document level so nested picker-inside-
  // modal usage still escapes the picker before the modal's own Backdrop
  // listener sees the event.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onCancel])

  const breadcrumbs = ['root', ...currentPath.split('/').filter(Boolean)]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex,
      background: 'var(--bg-deep)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header — full width */}
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
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-green)' }}>
          {data.bucket}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 6,
            background: 'color-mix(in srgb, #FF9900 8%, transparent)',
            border: '1px solid color-mix(in srgb, #FF9900 20%, transparent)',
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#FF9900" strokeWidth="1.5" fill="color-mix(in srgb, #FF9900 10%, transparent)" strokeLinejoin="round" />
              <path d="M3 7l9 5 9-5" stroke="#FF9900" strokeWidth="1.2" />
              <path d="M12 12v10" stroke="#FF9900" strokeWidth="1.2" />
            </svg>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FF9900', letterSpacing: '0.03em' }}>
              Amazon S3
            </span>
          </div>
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
      </div>

      {/* File browser — centered fixed-size container */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{
          width: 1100, height: '85%', maxHeight: 800,
          background: 'var(--bg-surface)',
          borderRadius: 10,
          border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Breadcrumb */}
          <div style={{
            padding: '10px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
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
            {accept && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
                Showing {accept} files only
              </span>
            )}
          </div>

          {/* File list + preview pane */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
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
                  <span style={{ fontSize: 12 }}>←</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>..</span>
                </div>
              )}

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

              {files.map(file => {
                const isSelected = selected.has(file.name)
                const isFocused = previewFile?.name === file.name
                return (
                  <div
                    key={file.name}
                    onClick={() => {
                      const wasSelected = selected.has(file.name)
                      toggleFile(file.name)
                      if (mode === 'single' && wasSelected) {
                        setPreviewFile(null)
                      } else {
                        setPreviewFile(file)
                      }
                    }}
                    style={{
                      padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                      borderBottom: '1px solid var(--border)', transition: 'background 100ms',
                      background: isFocused
                        ? 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)'
                        : isSelected
                          ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)'
                          : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected && !isFocused) e.currentTarget.style.background = 'var(--bg-raised)' }}
                    onMouseLeave={e => { if (!isSelected && !isFocused) e.currentTarget.style.background = 'transparent' }}
                  >
                    {mode === 'single' ? (
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${isSelected ? 'var(--accent-green)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 150ms',
                      }}>
                        {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)' }} />}
                      </div>
                    ) : (
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid ${isSelected ? 'var(--accent-green)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--accent-green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 150ms',
                      }}>
                        {isSelected && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>✓</span>}
                      </div>
                    )}
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

              {folders.length === 0 && files.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                  No {accept ? accept.replace('.', '').toUpperCase() + ' ' : ''}files in this folder
                </div>
              )}
            </div>

            {previewFile && (
              <div style={{
                width: 380, flexShrink: 0,
                borderLeft: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <ShieldIcon size={14} />
                        <span style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          color: 'var(--accent-green)', letterSpacing: '0.06em',
                        }}>FILE DETAILS</span>
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                        wordBreak: 'break-all', lineHeight: 1.4,
                      }}>
                        {previewFile.name}
                      </div>
                    </div>
                    <span
                      onClick={() => setPreviewFile(null)}
                      style={{
                        fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer',
                        padding: '0 2px', lineHeight: 1, flexShrink: 0,
                      }}
                    >✕</span>
                  </div>
                </div>

                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  {[
                    { label: 'Type', value: previewFile.type?.toUpperCase() || 'FILE' },
                    { label: 'Size', value: previewFile.size },
                    { label: 'Modified', value: previewFile.date },
                    { label: 'Path', value: `${data.bucket}${currentPath}/${previewFile.name}` },
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex', alignItems: 'baseline', gap: 8,
                      padding: '4px 0', fontSize: 11,
                    }}>
                      <span style={{
                        width: 60, flexShrink: 0,
                        color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                      }}>{row.label}</span>
                      <span style={{
                        flex: 1, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
                        wordBreak: 'break-all',
                      }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '24px 16px',
                  color: 'var(--text-dim)',
                }}>
                  <div style={{
                    width: 80, height: 100, borderRadius: 8,
                    border: '2px dashed var(--border)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                    background: 'color-mix(in srgb, var(--border) 20%, transparent)',
                  }}>
                    <FileIcon type={previewFile.type} />
                  </div>
                  <div style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.6,
                  }}>
                    Preview not available
                    <br />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Select to attach this file
                    </span>
                  </div>
                </div>

                <div style={{
                  padding: '10px 16px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  flexShrink: 0,
                }}>
                  <div style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    color: 'var(--accent-green)', letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}>LEDGER STATUS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent-green)',
                    }} />
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                    }}>
                      Hashed & endorsed on-chain
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
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
          onClick={handleSelect}
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
          {mode === 'single'
            ? 'Select File →'
            : `Select ${selected.size} File${selected.size !== 1 ? 's' : ''} →`
          }
        </button>
      </div>
    </div>
  )
}
