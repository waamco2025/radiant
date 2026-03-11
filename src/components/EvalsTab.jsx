import { SH } from './detailPanelUtils';

export default function EvalsTab({ node, onOpenEvalModal, approvalStates, showApproveConfirm, setShowApproveConfirm, showRejectConfirm, setShowRejectConfirm, approvalNotes, setApprovalNotes, onApproveAsset, onRejectAsset, evidenceRequests, reviewingReqId, setReviewingReqId, rejectNotes, setRejectNotes, onReviewEvidence }) {
  /* Build set of most-recent failed eval IDs per checklist for re-evaluate button gating */
  const latestFailedEvalIds = (() => {
    const ids = new Set();
    if (!node.evaluations?.length) return ids;
    const seen = new Set();
    // Walk evaluations in reverse (most recent first)
    for (let i = node.evaluations.length - 1; i >= 0; i--) {
      const ev = node.evaluations[i];
      if (seen.has(ev.checklistId)) continue;
      seen.add(ev.checklistId);
      if (ev.overallResult === 'fail') ids.add(ev.id);
    }
    return ids;
  })();

  return <>
    {/* Evaluation records */}
    {node.evaluations?.length > 0 && <div style={{ marginBottom: 10, marginTop: 4 }}>
      <div style={SH}>EVALUATIONS ({node.evaluations.length})</div>
      {node.evaluations.map((ev, i) => {
        const passed = ev.overallResult === 'pass';
        const nodeReqs = (evidenceRequests || []).filter(r => r.nodeId === node.id);
        const isLatestFailed = latestFailedEvalIds.has(ev.id);
        const hasAcceptedEvidence = isLatestFailed && nodeReqs.some(r => r.checklist === ev.checklist && (r.status === 'accepted' || r.status === 'resolved'));
        const acceptedCount = isLatestFailed ? nodeReqs.filter(r => r.checklist === ev.checklist && (r.status === 'accepted' || r.status === 'resolved')).length : 0;
        return <div key={ev.id || i} style={{ padding: '8px 10px', background: 'var(--bg-deep)', border: `1px solid color-mix(in srgb, ${passed ? 'var(--accent-green)' : 'var(--accent-red)'} 13%, transparent)`, borderRadius: 5, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600 }}>{ev.checklist}</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: passed ? 'var(--accent-green)' : 'var(--accent-red)', textTransform: 'uppercase' }}>{ev.overallResult}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {ev.requirementCount} requirements · {ev.passCount} passed · {ev.failCount} failed
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{ev.date}</div>
          {hasAcceptedEvidence && onOpenEvalModal && <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 8, color: 'var(--accent-green)', fontFamily: 'monospace', marginBottom: 4 }}>{acceptedCount} evidence submission{acceptedCount !== 1 ? 's' : ''} available</div>
            <button
              onClick={() => onOpenEvalModal(node, ev.checklistId)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.background = 'var(--accent-green-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-green) 33%, transparent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green-bg) 3%, transparent)'; }}
              style={{ width: '100%', padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'color-mix(in srgb, var(--accent-green-bg) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 33%, transparent)', borderRadius: 4, color: 'var(--accent-green)', cursor: 'pointer', transition: 'border-color .2s, background .2s' }}>
              Re-evaluate with Evidence
            </button>
          </div>}
        </div>;
      })}
    </div>}

    {/* Run Evaluation button */}
    {onOpenEvalModal && !['program','system'].includes(node.type) && <button
      onClick={() => onOpenEvalModal(node)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-amber)'; e.currentTarget.style.background = 'var(--accent-amber-bg)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-amber) 33%, transparent)'; e.currentTarget.style.background = 'transparent'; }}
      style={{ width: '100%', height: 36, padding: 0, marginBottom: 10, background: 'transparent', border: '1px solid color-mix(in srgb, var(--accent-amber) 33%, transparent)', borderRadius: 5, color: 'var(--accent-amber)', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      Run Evaluation</button>}

    {/* Approval controls */}
    {(() => {
      const approval = approvalStates?.[node.id];
      if (['customer','program','system'].includes(node.type)) return null;
      if (approval?.status === 'approved' || approval?.status === 'rejected') return null;
      const hasEval = node.evaluations?.length > 0;
      return <>
        <div style={{ marginBottom: 10 }}>
          <div style={SH}>APPROVAL</div>
          {hasEval && !showApproveConfirm && <button onClick={() => setShowApproveConfirm(true)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.background = 'var(--accent-green-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-green) 33%, transparent)'; e.currentTarget.style.background = 'transparent'; }}
            style={{ width: '100%', height: 32, background: 'transparent', border: '1px solid color-mix(in srgb, var(--accent-green) 33%, transparent)', borderRadius: 5, color: 'var(--accent-green)', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s' }}>Approve Asset</button>}
          {!hasEval && <button disabled style={{ width: '100%', height: 32, background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 10, fontFamily: 'monospace', fontWeight: 600, cursor: 'not-allowed', opacity: 0.5 }} title="Run an evaluation first">Approve Asset</button>}
          {showApproveConfirm && <div style={{ marginTop: 8, padding: '10px', background: 'var(--bg-deep)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', borderRadius: 6 }}>
            <div style={{ fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 6 }}>CONFIRM APPROVAL</div>
            <textarea value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} rows={2} placeholder="Notes (optional)..."
              style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowApproveConfirm(false)} style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { if (onApproveAsset) onApproveAsset(node.id, approvalNotes); setShowApproveConfirm(false); setApprovalNotes(''); }}
                style={{ flex: 2, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 27%, transparent)', borderRadius: 4, color: 'var(--accent-green)', cursor: 'pointer' }}>Confirm Approve</button>
            </div>
          </div>}
        </div>
        {/* Reject — separated into danger zone */}
        <div style={{ marginBottom: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.06em', marginBottom: 6 }}>DANGER ZONE</div>
          {!showRejectConfirm && <button onClick={() => setShowRejectConfirm(true)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            style={{ width: '100%', height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, color .2s' }}>Reject & Remove from Network</button>}
          {showRejectConfirm && <div style={{ padding: '10px', background: 'var(--bg-deep)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)', borderRadius: 6 }}>
            <div style={{ fontSize: 9, color: 'var(--accent-red)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 6 }}>CONFIRM REJECTION</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>This will permanently remove this node from your supply network.</div>
            <textarea value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} rows={2} placeholder="Reason for rejection (required)..."
              style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowRejectConfirm(false)} style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
              <button disabled={!approvalNotes.trim()} onClick={() => { if (onRejectAsset) onRejectAsset(node.id, approvalNotes); setShowRejectConfirm(false); setApprovalNotes(''); }}
                style={{ flex: 2, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: approvalNotes.trim() ? 'color-mix(in srgb, var(--accent-red) 8%, transparent)' : 'var(--bg-surface)', border: `1px solid ${approvalNotes.trim() ? 'color-mix(in srgb, var(--accent-red) 27%, transparent)' : 'var(--border)'}`, borderRadius: 4, color: approvalNotes.trim() ? 'var(--accent-red)' : 'var(--text-muted)', cursor: approvalNotes.trim() ? 'pointer' : 'not-allowed', opacity: approvalNotes.trim() ? 1 : 0.5 }}>Confirm Reject</button>
            </div>
          </div>}
        </div>
      </>;
    })()}

    {/* Evidence request cards (buyer review) */}
    {(() => {
      const nodeReqs = (evidenceRequests || []).filter(r => r.nodeId === node.id);
      if (!nodeReqs.length) return null;
      const pendingCount = nodeReqs.filter(r => r.status === 'pending').length;
      const awaitingCount = nodeReqs.filter(r => r.status === 'submitted' || r.status === 'resubmitted').length;
      const acceptedCount = nodeReqs.filter(r => r.status === 'accepted').length;
      const resolvedCount = nodeReqs.filter(r => r.status === 'resolved').length;
      const rejectedCount = nodeReqs.filter(r => r.status === 'rejected').length;
      const statusColors = { pending: 'var(--accent-amber)', submitted: 'var(--accent-cyan)', resubmitted: 'var(--accent-cyan)', accepted: 'var(--accent-green)', rejected: 'var(--accent-red)', resolved: 'var(--text-tertiary)' };
      const statusIcons = { pending: '◌', submitted: '↑', resubmitted: '↑', accepted: '✓', rejected: '✗', resolved: '✓' };
      const statusLabels = { pending: 'PENDING', submitted: 'SUBMITTED', resubmitted: 'RESUBMITTED', accepted: 'ACCEPTED', rejected: 'REJECTED', resolved: 'USED' };
      return <div style={{ marginBottom: 10 }}>
        <div style={SH}>EVIDENCE REQUESTS ({nodeReqs.length})</div>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pendingCount > 0 && <span style={{ color: 'var(--accent-amber)' }}>{pendingCount} pending</span>}
          {awaitingCount > 0 && <span style={{ color: 'var(--accent-cyan)' }}>{awaitingCount} submitted</span>}
          {acceptedCount > 0 && <span style={{ color: 'var(--accent-green)' }}>{acceptedCount} accepted</span>}
          {resolvedCount > 0 && <span style={{ color: 'var(--text-tertiary)' }}>{resolvedCount} used in re-eval</span>}
          {rejectedCount > 0 && <span style={{ color: 'var(--accent-red)' }}>{rejectedCount} rejected</span>}
        </div>
        {nodeReqs.map(r => {
          const sColor = statusColors[r.status] || 'var(--accent-indigo)';
          const sIcon = statusIcons[r.status] || '◌';
          const sLabel = statusLabels[r.status] || r.status.toUpperCase();
          const isReviewing = reviewingReqId === r.id;
          return <div key={r.id} style={{ padding: '8px 10px', background: 'var(--bg-deep)', border: '1px solid ' + `color-mix(in srgb, ${sColor} 13%, transparent)`, borderRadius: 5, marginBottom: 4, opacity: r.status === 'resolved' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: sColor, fontFamily: 'monospace', fontWeight: 700 }}>◧</span>
              <span style={{ fontSize: 10, color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
              <span style={{ fontSize: 8, color: sColor, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{sIcon} {sLabel}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.checklist} · Requested {new Date(r.requestedAt).toLocaleDateString()}</div>

            {/* Previous responses (evidence trail) */}
            {r.previousResponses?.length > 0 && <div style={{ marginTop: 5, paddingTop: 4, borderTop: '1px solid var(--border)22' }}>
              <div style={{ fontSize: 8, color: 'var(--border-hover)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 3 }}>PRIOR SUBMISSIONS ({r.previousResponses.length})</div>
              {r.previousResponses.map((pr, pi) =>
                <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 2, opacity: 0.7 }}>
                  <span>📎</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.fileName}</span>
                  <span>{pr.submittedAt ? new Date(pr.submittedAt).toLocaleDateString() : ''}</span>
                </div>
              )}
            </div>}

            {/* Submitted/resubmitted: show file + Re-Evaluate / Cancel buttons */}
            {(r.status === 'submitted' || r.status === 'resubmitted') && <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                <span>📎</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.response?.fileName}</span>
                <span style={{ color: 'var(--text-muted)' }}>· {r.response?.submittedAt ? new Date(r.response.submittedAt).toLocaleDateString() : ''}</span>
              </div>
              {r.response?.notes && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 3, fontStyle: 'italic' }}>{r.response.notes}</div>}
              {!isReviewing && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => {
                  if (onReviewEvidence) onReviewEvidence(r.id, 'accepted');
                  if (onOpenEvalModal && r.checklistId) onOpenEvalModal(node, r.checklistId);
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.background = 'var(--accent-green-bg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-green) 33%, transparent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green) 6%, transparent)'; }}
                  style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 33%, transparent)', borderRadius: 4, color: 'var(--accent-green)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>Re-Evaluate</button>
                <button onClick={() => { setReviewingReqId(r.id); setRejectNotes(''); }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'transparent'; }}
                  style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border-hover)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>Cancel</button>
              </div>}
              {isReviewing && <div style={{ marginTop: 6 }}>
                <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} rows={2} placeholder="Reason for rejection..."
                  style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setReviewingReqId(null)} style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => { if (onReviewEvidence) onReviewEvidence(r.id, 'rejected', rejectNotes); setReviewingReqId(null); }}
                    style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 27%, transparent)', borderRadius: 4, color: 'var(--accent-red)', cursor: 'pointer' }}>Confirm Reject</button>
                </div>
              </div>}
            </div>}
            {r.status === 'accepted' && <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace' }}>✓ Evidence accepted</div>
              {r.response?.fileName && <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>📎 {r.response.fileName}</div>}
            </div>}
            {r.status === 'resolved' && <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>✓ Evidence used in re-evaluation</div>
              {r.response?.fileName && <div style={{ fontSize: 8, color: 'var(--border-hover)', fontFamily: 'monospace', marginTop: 2 }}>📎 {r.response.fileName}</div>}
              {r.resolvedAt && <div style={{ fontSize: 8, color: 'var(--border-hover)', fontFamily: 'monospace', marginTop: 1 }}>Resolved {new Date(r.resolvedAt).toLocaleDateString()}</div>}
            </div>}
          </div>;
        })}
      </div>;
    })()}
  </>;
}
