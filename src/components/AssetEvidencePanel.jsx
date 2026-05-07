// AssetEvidencePanel — Phase 12.4 shared evidence viewer.
//
// Lifted from ExpandedArtifactModal's two evidence-rendering paths:
//   • AssetEvidenceViewer (Phase 11B): file-metadata header + iframe at
//     `file.localPath` + footer with owner + registration date. Used for
//     Full Disclosure and owner (self-eval) views.
//   • Selective parsed-fields table (Phase 11D.2): header showing Asset
//     name + disclosed-field count + ArtifactRow list. The underlying file
//     is not exposed.
//
// Phase 12.4 wires this component into V22RunEvaluationModal and
// V22ParseEvidenceModal's left panels alongside the existing
// ExpandedArtifactModal usage so all three render the same evidence view.
//
// `assetRow` shape:
//   { id, name, asset, disclosureType, disclosedFields? }
// where `disclosureType` ∈ { 'owner', 'full', 'selective', 'proofonly' }
// and `disclosedFields` is required when disclosureType === 'selective'.
//
// Phase 12.6 (#171b): added `fillHeight` prop. When true, the panel's outer
// container is `flex: 1; minHeight: 0` and the iframe / fields list / empty
// placeholder stretches via `flex: 1; minHeight: …` instead of the legacy
// fixed `iframeHeight` cap. This is what V22RunEvaluationModal and
// V22ParseEvidenceModal use so the expanded body stretches to fill the left
// panel column, matching the right panel's height. ExpandedArtifactModal
// keeps the default fixed-height behavior so the modal sizes its tab body
// region the same way it has since Phase 11B.

import CopyBadge from './DetailPanel/shared/CopyBadge.jsx'
// Phase 15.0 (#172 part 1): PDF.js renderer with annotation overlay.
// Opt-in via `usePdfJs` prop. Default behaviour (iframe) preserved for
// every existing call site; Run Eval modal + Eval Result expand + PoE
// expand surfaces opt in.
import AnnotatedPdfViewer from './AnnotatedPdfViewer.jsx'

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} · ${hh}:${min} UTC`
}

export function AssetEvidenceViewer({
  asset,
  iframeHeight = 400,
  fillHeight = false,
  // Phase 15.0 (#172 part 1): opt-in to PDF.js rendering (with annotation
  // overlay) for application/pdf assets. Other MIME types fall back to
  // iframe regardless. Default false preserves every existing call site.
  usePdfJs = false,
  evidenceAnchors = null,
  assetOrdinal = null,
  rsColorByRsId = null,
  // Phase 15.1 (#172 part 2): bidirectional interaction.
  highlightedAnchorId = null,
  onAnchorClick = null,
}) {
  const file = asset?.file || {}
  const hash = file.hash || ''
  // Phase 12.6: `fillHeight` switches between the legacy fixed iframe height
  // (used by ExpandedArtifactModal) and a flex-stretching iframe (used by
  // the Run Eval / Parse modal left panels for height parity with the
  // right column). Header + footer stay natural-height; only the iframe /
  // empty-state placeholder grows.
  const stretchStyle = fillHeight ? { flex: 1, minHeight: 200 } : { height: iframeHeight }
  // Phase 15.0: pick the renderer based on mime + opt-in flag.
  const renderViaPdfJs = usePdfJs && file.mimeType === 'application/pdf' && !!file.localPath
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      ...(fillHeight ? { flex: 1, minHeight: 0 } : {}),
    }}>
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-deep)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '6px 16px',
        fontSize: 11,
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--text-tertiary)' }}>Filename</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{file.filename || '—'}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>Size</span>
        <span style={{ color: 'var(--text-primary)' }}>{formatBytes(file.size)}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>MIME</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{file.mimeType || '—'}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>Hash</span>
        <span style={{ color: 'var(--text-primary)' }}>
          {hash ? <CopyBadge value={hash} truncated /> : '—'}
        </span>
      </div>

      {renderViaPdfJs ? (
        <div style={{ ...(fillHeight ? { flex: 1, minHeight: 200 } : { height: iframeHeight }) }}>
          <AnnotatedPdfViewer
            fileUrl={file.localPath}
            evidenceAnchors={evidenceAnchors || []}
            assetOrdinal={assetOrdinal}
            rsColorByRsId={rsColorByRsId || {}}
            height={fillHeight ? '100%' : iframeHeight}
            highlightedAnchorId={highlightedAnchorId}
            onAnchorClick={onAnchorClick}
          />
        </div>
      ) : file.localPath ? (
        <iframe
          src={file.localPath}
          style={{
            width: '100%', ...stretchStyle, border: '1px solid var(--border)',
            borderRadius: 6, background: 'var(--bg-deep)',
          }}
          title={`Evidence: ${file.filename || asset?.name || 'asset'}`}
        />
      ) : (
        <div style={{
          ...stretchStyle,
          background: 'var(--bg-deep)',
          border: '2px dashed var(--border)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 12,
          textAlign: 'center',
          padding: 24,
        }}>
          Document preview not available
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '4px 16px',
        fontSize: 11,
        color: 'var(--text-tertiary)',
        flexShrink: 0,
      }}>
        <span>Owner</span>
        <span style={{ color: 'var(--text-secondary)' }}>{asset?.owner || '—'}</span>
        <span>Registered</span>
        <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(asset?.registrationDate)}</span>
      </div>
    </div>
  )
}

function ArtifactRow({ row }) {
  const confidence = row.confidence
  const confidenceBadge = typeof confidence === 'number' ? (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.04em',
      color: confidence >= 0.85 ? 'var(--accent-green)' : confidence >= 0.65 ? 'var(--accent-amber)' : 'var(--accent-red)',
      background: 'var(--bg-raised)',
      flexShrink: 0,
    }}>{Math.round(confidence * 100)}%</span>
  ) : null

  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--bg-deep)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {row.label || row.name || row.id || '—'}
        </span>
        {confidenceBadge}
      </div>
      {row.value != null && row.value !== '' && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
          {String(row.value)}
        </div>
      )}
    </div>
  )
}

export function SelectiveDisclosurePanel({ asset, disclosedFields, fillHeight = false }) {
  const fields = disclosedFields || []
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      ...(fillHeight ? { flex: 1, minHeight: 0 } : {}),
    }}>
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-deep)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '6px 16px',
        fontSize: 11,
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--text-tertiary)' }}>Asset</span>
        <span style={{ color: 'var(--text-primary)' }}>{asset?.name || '—'}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>Disclosed fields</span>
        <span style={{ color: 'var(--text-primary)' }}>{fields.length}</span>
      </div>
      {fields.length === 0 ? (
        <div style={{
          fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic',
          ...(fillHeight ? { flex: 1 } : {}),
        }}>
          No parsed fields are disclosed for this Asset under the active Selective Disclosure Agreement.
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          ...(fillHeight ? { flex: 1, minHeight: 0, overflowY: 'auto' } : {}),
        }}>
          {fields.map((f) => (
            <ArtifactRow key={`${f.parseResultId || 'pr'}::${f.id}`} row={f} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AssetEvidencePanel({
  assetRow,
  iframeHeight = 400,
  fillHeight = false,
  // Phase 15.0 (#172 part 1): forward to AssetEvidenceViewer.
  usePdfJs = false,
  evidenceAnchors = null,
  assetOrdinal = null,
  rsColorByRsId = null,
  // Phase 15.1 (#172 part 2): bidirectional interaction.
  highlightedAnchorId = null,
  onAnchorClick = null,
}) {
  if (!assetRow) {
    return (
      <div style={{
        height: 200,
        background: 'var(--bg-deep)',
        border: '2px dashed var(--border)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-dim)',
        fontSize: 12,
        textAlign: 'center',
        padding: 24,
        fontStyle: 'italic',
      }}>
        No Asset selected.
      </div>
    )
  }
  const { asset, disclosureType, disclosedFields } = assetRow
  if (disclosureType === 'owner' || disclosureType === 'full') {
    return (
      <AssetEvidenceViewer
        asset={asset}
        iframeHeight={iframeHeight}
        fillHeight={fillHeight}
        usePdfJs={usePdfJs}
        evidenceAnchors={evidenceAnchors}
        assetOrdinal={assetOrdinal}
        rsColorByRsId={rsColorByRsId}
        highlightedAnchorId={highlightedAnchorId}
        onAnchorClick={onAnchorClick}
      />
    )
  }
  if (disclosureType === 'selective') {
    return <SelectiveDisclosurePanel asset={asset} disclosedFields={disclosedFields} fillHeight={fillHeight} />
  }
  if (disclosureType === 'proofonly') {
    return (
      <div style={{
        height: 200,
        background: 'var(--bg-deep)',
        border: '2px dashed var(--border)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-dim)',
        fontSize: 12,
        textAlign: 'center',
        padding: 24,
        fontStyle: 'italic',
      }}>
        Under proof-only disclosure, Asset details are not available.
      </div>
    )
  }
  return (
    <div style={{
      height: 200,
      background: 'var(--bg-deep)',
      border: '2px dashed var(--border)',
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-dim)',
      fontSize: 12,
      textAlign: 'center',
      padding: 24,
      fontStyle: 'italic',
    }}>
      Evidence not available under this disclosure type.
    </div>
  )
}
