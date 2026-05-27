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
// Phase 20.4: reuse the Phase 15 PDF.js renderer for the File Details preview
// of qualified-storage files that ship as real PDFs (Phase 20.5: currently
// inrush-current-limiter-datasheet).
import AnnotatedPdfViewer from '../AnnotatedPdfViewer.jsx'

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
        // Phase 9E-parallel.4 (#94 follow-up): sentinel4-assembly-report
        // and propulsion-test-results share 2026-03-15 so the summary's
        // Modified-date collapse path is testable. thermal-analysis-v2
        // retains a distinct date so the range path is also testable.
        { name: 'sentinel4-assembly-report.pdf', size: '2.4 MB', date: '2026-03-15', type: 'pdf' },
        { name: 'propulsion-test-results.pdf', size: '1.8 MB', date: '2026-03-15', type: 'pdf' },
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
        // Phase 20.5: the only qualified-storage file that ships as a real,
        // previewable PDF (served from public/seed-pdfs/). Swapped here from
        // emi-shield-spec.pdf (Phase 20.4) — that filename collides with Alice's
        // existing EMI Shield Assembly Asset, so registering it would create a
        // duplicate card. The Inrush Current Limiter ICL-150 is a genuinely new
        // MicroCo part with no seed Asset, so it registers cleanly. The other
        // six datasheets stay preview-less placeholders — intentional.
        { name: 'inrush-current-limiter-datasheet.pdf', size: '1.9 MB', date: '2026-03-13', type: 'pdf', localPath: '/seed-pdfs/inrush-current-limiter-datasheet.pdf' },
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
    // Phase 20.4: carry the served PDF path forward when the mock entry has
    // one (Phase 20.5: only inrush-current-limiter-datasheet today). makeAsset
    // stores file.localPath, so the registered Asset's File Viewer renders the
    // real PDF. Preview-less files pass `localPath: null` and keep the existing
    // no-preview fallback.
    localPath: file.localPath || null,
    // Carry the display size / type / date through too — V22CreateAssetModal
    // uses these for the "Review & Confirm" step without reformatting.
    displaySize: file.size,
    displayType: file.type,
    displayDate: file.date,
  }
}

/* ─── Local Storage panel (Phase 9A.6 Gate B / #67) ─── */
function LocalStoragePanel({ localFiles, selected, mode, bucket, onChoose, onToggle, onRemove, onSelectAllLocal }) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useCallback((el) => { if (el) el.value = '' }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files?.length) onChoose(e.dataTransfer.files)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '28px 20px', borderRadius: 10, cursor: 'pointer',
            border: `1.5px dashed ${dragOver ? 'var(--accent-indigo)' : 'var(--border)'}`,
            background: dragOver
              ? 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)'
              : 'var(--bg-card)',
            transition: 'all 150ms',
          }}
        >
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--accent-indigo)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Drop files here or click to upload
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textAlign: 'center' }}>
            {/* Phase 9E-parallel.2 (#96): show the real destination path. */}
            Files will be uploaded to{' '}
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {bucket}/uploads
            </span>
            {' '}in your Qualified Storage.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.length && onChoose(e.target.files)}
          />
        </label>
      </div>

      {/* Phase 9E-parallel.2 (#97): Select All / Deselect All toggle for local files. */}
      {localFiles.length > 0 && mode !== 'single' && (() => {
        const readyLocalFiles = localFiles.filter(f => f.status === 'ready')
        if (readyLocalFiles.length === 0) return null
        const allSelected = readyLocalFiles.every(f => selected.has(f.id))
        return (
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '6px 24px 0',
            borderBottom: 'none',
          }}>
            <span
              onClick={() => onSelectAllLocal(!allSelected)}
              style={{
                fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--text-dim)', cursor: 'pointer',
                padding: '2px 4px',
                transition: 'color 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-indigo)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </span>
          </div>
        )
      })()}

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 24px' }}>
        {localFiles.length === 0 ? (
          <div style={{
            padding: '40px 0', textAlign: 'center', fontSize: 12,
            color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
          }}>
            No uploaded files yet. Drop files above to get started.
          </div>
        ) : (
          localFiles.map(file => {
            const isSelected = selected.has(file.id)
            const isReady = file.status === 'ready'
            return (
              <div
                key={file.id}
                onClick={() => isReady && onToggle(file.id)}
                style={{
                  padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: '1px solid var(--border)',
                  cursor: isReady ? 'pointer' : 'default',
                  opacity: isReady ? 1 : 0.7,
                  background: isSelected ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)' : 'transparent',
                  transition: 'background 100ms',
                }}
              >
                {isReady && mode === 'single' ? (
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isSelected ? 'var(--accent-green)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)' }} />}
                  </div>
                ) : isReady ? (
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${isSelected ? 'var(--accent-green)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>✓</span>}
                  </div>
                ) : (
                  <div style={{ width: 18, height: 18, flexShrink: 0 }} />
                )}
                <FileIcon type={(file.name.split('.').pop() || '').toLowerCase()} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  {!isReady && (
                    <div style={{
                      width: '100%', height: 3, marginTop: 6, borderRadius: 2,
                      background: 'var(--bg-raised)', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.round(file.progress * 100)}%`, height: '100%',
                        background: 'var(--accent-indigo)',
                        transition: 'width 60ms linear',
                      }} />
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', width: 80, textAlign: 'right' }}>
                  {file.size}
                </span>
                {isReady ? (
                  <span style={{
                    fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '2px 6px', borderRadius: 3,
                    letterSpacing: '0.06em',
                    color: 'var(--accent-indigo)',
                    background: 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)',
                  }}>JUST UPLOADED</span>
                ) : (
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                  }}>uploading…</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(file.id) }}
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--text-dim)', cursor: 'pointer',
                    fontSize: 14, padding: '0 4px', lineHeight: 1,
                  }}
                  aria-label="Remove"
                >✕</button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
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

  // Phase 9A.6 Gate B (#67): Local Storage tab. Tab state + in-session
  // in-memory "uploaded" files. Real implementation would push to the
  // user's QS bucket; demo just synthesizes metadata + a mock uri.
  const [source, setSource] = useState('qs') // 'qs' | 'local'
  const [localFiles, setLocalFiles] = useState([])
  // Each localFile entry: { id, name, size, type, status: 'uploading'|'ready', progress: 0..1 }

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

  // Phase 9A.6 Gate B (#67): local files selected alongside QS picks.
  // Local-file ids are prefixed `local-` so they don't collide with QS
  // filenames in the `selected` Set.
  const selectedLocalFiles = localFiles.filter(f => f.status === 'ready' && selected.has(f.id))

  const handleFilesChosen = useCallback((fileList) => {
    const newFiles = Array.from(fileList).map((f, i) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      const displayType = ext || 'FILE'
      const sizeKb = Math.max(1, Math.round(f.size / 1024))
      const displaySize = sizeKb >= 1024
        ? `${(sizeKb / 1024).toFixed(1)} MB`
        : `${sizeKb} KB`
      return {
        id: `local-${Date.now()}-${i}-${f.name.replace(/[^\w.-]+/g, '_')}`,
        name: f.name,
        size: displaySize,
        bytes: f.size,
        type: displayType,
        date: new Date().toISOString().slice(0, 10),
        status: 'uploading',
        progress: 0,
      }
    })
    if (newFiles.length === 0) return
    setLocalFiles(prev => [...prev, ...newFiles])
    // Simulate upload — 500–800ms per file, staggered progress updates.
    newFiles.forEach((entry) => {
      const durationMs = 500 + Math.round(Math.random() * 300)
      const started = Date.now()
      let markedReady = false
      const tick = () => {
        const elapsed = Date.now() - started
        const p = Math.min(1, elapsed / durationMs)
        setLocalFiles(prev => prev.map(f =>
          f.id === entry.id
            ? (p >= 1 ? { ...f, status: 'ready', progress: 1 } : { ...f, progress: p })
            : f,
        ))
        // Phase 9E-parallel.2 (#97): default newly-uploaded local files to
        // selected. Add to the selection Set once at the ready transition.
        // Skipped in single mode so a batch of uploads doesn't fight over
        // "which one is selected now"; single-mode users still click to pick.
        if (p >= 1 && !markedReady) {
          markedReady = true
          if (mode !== 'single') {
            setSelected(prev => {
              if (prev.has(entry.id)) return prev
              const next = new Set(prev)
              next.add(entry.id)
              return next
            })
          }
        }
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, [mode])

  const removeLocalFile = useCallback((id) => {
    setLocalFiles(prev => prev.filter(f => f.id !== id))
    setSelected(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const selectedCount = selected.size

  // Phase 9E-parallel.2 (#94): helper for the multi-select summary panel.
  // Formats a byte count as an approximate human size (e.g., "14.7 MB").
  const formatBytesShort = (n) => {
    if (!n || n <= 0) return '0 B'
    if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
    if (n >= 1024) return `${Math.round(n / 1024)} KB`
    return `${n} B`
  }

  // Resolve currently selected items (QS-side + Local-side) back to file
  // records with a unified shape {name, bytes, type, date}. QS-side entries
  // are keyed by `file.name` in the selected Set; local-side entries by
  // `file.id` (the `local-…` prefix disambiguates). Navigation clears the
  // QS selection, so only the current folder's files can resolve on the QS
  // side — local files persist across navigation.
  const resolvedSelectedForSummary = (() => {
    const out = []
    for (const f of files) {
      if (selected.has(f.name)) {
        out.push({ name: f.name, bytes: parseDisplaySizeToBytes(f.size), type: f.type, date: f.date })
      }
    }
    for (const f of localFiles) {
      if (f.status === 'ready' && selected.has(f.id)) {
        out.push({ name: f.name, bytes: f.bytes || 0, type: (f.name.split('.').pop() || '').toLowerCase(), date: f.date })
      }
    }
    return out
  })()

  const summaryTotalBytes = resolvedSelectedForSummary.reduce((a, r) => a + (r.bytes || 0), 0)
  const summaryDates = resolvedSelectedForSummary.map(r => r.date).filter(Boolean).sort()
  const summaryTypes = Array.from(new Set(resolvedSelectedForSummary.map(r => (r.type || '').toUpperCase()).filter(Boolean)))

  const handleSelect = useCallback(() => {
    if (selectedCount === 0) return
    // Map QS picks
    const qsPayloads = selectedFiles.map(selectedFileToV22Payload)
    // Map local picks — synthesize a demo URI under the party's bucket /uploads.
    const bucketUploadBase = `${data.bucket}/uploads`
    const localPayloads = selectedLocalFiles.map(f => ({
      uri: `${bucketUploadBase}/${f.name}`,
      filename: f.name,
      size: f.bytes,
      mimeType: MIME_BY_EXT[(f.name.split('.').pop() || '').toLowerCase()] || 'application/octet-stream',
      hash: null,
      displaySize: f.size,
      displayType: f.type,
      displayDate: f.date,
      source: 'local',
    }))
    const all = [...qsPayloads, ...localPayloads]
    onSelect(mode === 'single' ? all[0] : all)
  }, [selectedFiles, selectedLocalFiles, data.bucket, onSelect, mode, selectedCount])

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
          {/* Phase 9A.6 Gate B (#67): Source tabs — Qualified Storage + Local Storage */}
          <div style={{
            display: 'flex', gap: 2, padding: '8px 8px 0',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-deep)',
            flexShrink: 0,
          }}>
            {[
              { id: 'qs', label: 'Qualified Storage', color: 'var(--accent-green)' },
              { id: 'local', label: 'Local Storage', color: 'var(--accent-indigo)' },
            ].map(tab => {
              const active = source === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (source === tab.id) return
                    // Phase 9E-parallel.3 (#125): clear selection + preview
                    // on tab switch so QS and Local selections are mutually
                    // exclusive. Prevents accidental "3 from QS + 5 from
                    // Local = 8" footer counts. Clean, silent reset.
                    setSelected(new Set())
                    setPreviewFile(null)
                    setSource(tab.id)
                  }}
                  style={{
                    padding: '10px 18px', border: 'none',
                    background: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? tab.color : 'var(--text-dim)',
                    fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: active ? 700 : 500,
                    letterSpacing: '0.04em', cursor: 'pointer',
                    borderTopLeftRadius: 6, borderTopRightRadius: 6,
                    borderBottom: active ? `2px solid ${tab.color}` : '2px solid transparent',
                    transition: 'all 120ms',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          {source === 'local' ? (
            <LocalStoragePanel
              localFiles={localFiles}
              selected={selected}
              mode={mode}
              bucket={data.bucket}
              onChoose={handleFilesChosen}
              onToggle={(id) => {
                setSelected(prev => {
                  const next = new Set(prev)
                  if (mode === 'single') {
                    if (next.has(id)) { next.delete(id) } else { next.clear(); next.add(id) }
                  } else {
                    if (next.has(id)) { next.delete(id) } else { next.add(id) }
                  }
                  return next
                })
              }}
              onSelectAllLocal={(select) => {
                // Phase 9E-parallel.2 (#97): flip all ready local files on/off.
                // Leaves QS-side selection untouched.
                const readyIds = localFiles.filter(f => f.status === 'ready').map(f => f.id)
                setSelected(prev => {
                  const next = new Set(prev)
                  if (select) {
                    for (const id of readyIds) next.add(id)
                  } else {
                    for (const id of readyIds) next.delete(id)
                  }
                  return next
                })
              }}
              onRemove={removeLocalFile}
            />
          ) : (
          <>
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

            {selected.size > 1 && resolvedSelectedForSummary.length > 1 && (
              // Phase 9E-parallel.3 (#94 correction): multi-select summary
              // takes precedence over the single-file preview. Matches
              // macOS Finder column-view behavior — selecting any row still
              // sets previewFile for potential future single-select fallback,
              // but the summary dominates the right pane as long as
              // multiple files remain checked.
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <ShieldIcon size={14} />
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: 'var(--accent-green)', letterSpacing: '0.06em',
                    }}>SELECTION SUMMARY</span>
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                    lineHeight: 1.4,
                  }}>
                    {resolvedSelectedForSummary.length} files selected
                  </div>
                </div>

                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  {[
                    { label: 'Total size', value: formatBytesShort(summaryTotalBytes) },
                    {
                      label: 'Modified',
                      value: summaryDates.length === 0
                        ? '—'
                        : summaryDates[0] === summaryDates[summaryDates.length - 1]
                          ? summaryDates[0]
                          : `${summaryDates[0]} – ${summaryDates[summaryDates.length - 1]}`,
                    },
                    { label: 'Types', value: summaryTypes.length > 0 ? summaryTypes.join(', ') : '—' },
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex', alignItems: 'baseline', gap: 8,
                      padding: '4px 0', fontSize: 11,
                    }}>
                      <span style={{
                        width: 72, flexShrink: 0,
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
                    position: 'relative',
                    width: 80, height: 100,
                    marginBottom: 16,
                  }}>
                    {/* Stacked-file multi-icon — three offset card shapes. */}
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        position: 'absolute',
                        top: 6 - i * 3,
                        left: 6 - i * 3,
                        width: 70,
                        height: 90,
                        borderRadius: 8,
                        border: '2px dashed var(--border)',
                        background: 'color-mix(in srgb, var(--border) 20%, transparent)',
                        display: i === 0 ? 'flex' : 'none',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <span style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          color: 'var(--text-dim)',
                          padding: '2px 6px', borderRadius: 3,
                          background: 'var(--bg-raised)',
                        }}>{resolvedSelectedForSummary.length}</span>
                      </div>
                    ))}
                    {[2, 1].map(i => (
                      <div key={`card-${i}`} style={{
                        position: 'absolute',
                        top: 6 - i * 3,
                        left: 6 - i * 3,
                        width: 70,
                        height: 90,
                        borderRadius: 8,
                        border: '2px dashed var(--border)',
                        background: 'color-mix(in srgb, var(--border) 20%, transparent)',
                      }} />
                    ))}
                  </div>
                  <div style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.6,
                  }}>
                    Preview not available
                    <br />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Select to attach these files
                    </span>
                  </div>
                </div>
              </div>
            )}

            {previewFile && selected.size === 1 && (
              // Phase 9E-parallel.4 (#94 follow-up): single-file preview
              // only renders when exactly one file is selected. Zero
              // selected → pane hidden (even if previewFile persists from
              // a prior row click). Multi-select summary wins the slot
              // when >1 checked.
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

                {previewFile.localPath ? (
                  // Phase 20.4: live PDF.js preview for qualified-storage files
                  // that ship as real PDFs (Phase 20.5: inrush-current-limiter-
                  // datasheet today). Reuses the
                  // Phase 15 AnnotatedPdfViewer — fit-to-container, scrolls
                  // internally for the full multi-page view; no annotation
                  // anchors here (none apply to a not-yet-registered file).
                  <div style={{
                    flex: 1, minHeight: 0, overflow: 'hidden',
                    background: 'var(--bg-deep)',
                  }}>
                    <AnnotatedPdfViewer fileUrl={previewFile.localPath} height="100%" />
                  </div>
                ) : (
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
                )}

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
          </>
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
