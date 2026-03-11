import { SDA_TYPE_COLORS, SDA_LINE_DASH, SDA_STATUS_COLORS } from './detailPanelUtils';

import { useState } from 'react';

const SDA_FIELDS = [
  { key: 'part_identification', label: 'Part Identification', locked: true },
  { key: 'certifications', label: 'Certifications', locked: true },
  { key: 'shipment_details', label: 'Shipment Details' },
  { key: 'material_specs', label: 'Material Specs' },
  { key: 'processing_specs', label: 'Processing Specs' },
  { key: 'test_results', label: 'Test Results' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'supplier_identity', label: 'Supplier Identity' },
];

const PREDICATES = [
  { key: 'provenance_claimed', label: 'Provenance', cat: 'Provenance' },
  { key: 'supplied_by', label: 'Supplied By', cat: 'Provenance' },
  { key: 'quality_approved', label: 'Quality Approved', cat: 'Quality' },
  { key: 'inspected', label: 'Inspected', cat: 'Quality' },
  { key: 'calibrated', label: 'Calibrated', cat: 'Calibration' },
  { key: 'certified', label: 'Certified', cat: 'Qualification' },
  { key: 'material_tested', label: 'Material Tested', cat: 'Transformation' },
  { key: 'assembled_from', label: 'Assembled From', cat: 'Transformation' },
  { key: 'risk_assessed', label: 'Risk Assessed', cat: 'Other' },
];

export default function SupplierAssetSection({ node, sdaList, disclosureOffers, showOfferCreate, setShowOfferCreate, offerType, setOfferType, offerFields, setOfferFields, onCreateOffer, onRevokeOffer, onSupplierRevokeSDA, evidenceRequests, respondingToReq, setRespondingToReq, evidenceFileName, setEvidenceFileName, evidenceNotes, setEvidenceNotes, onSubmitEvidence, disclosureRequests, onApproveDisclosureRequest, onDeclineDisclosureRequest, decliningReqId, setDecliningReqId, declineReason, setDeclineReason, onAddAttestation, onRevokeAttestation, cascadeRequests, onAcceptCascade, onDeclineCascade }) {
  const [revokingOfferId, setRevokingOfferId] = useState(null);
  const [revokeOfferReason, setRevokeOfferReason] = useState('');
  const [revokingSdaId, setRevokingSdaId] = useState(null);
  const [revokeSdaReason, setRevokeSdaReason] = useState('');
  const [showManageAtts, setShowManageAtts] = useState(false);
  const [addingClaim, setAddingClaim] = useState(false);
  const [newPredicate, setNewPredicate] = useState('provenance_claimed');
  const [revokingAttIdx, setRevokingAttIdx] = useState(null);
  const [revokeAttReason, setRevokeAttReason] = useState('');
  const [acceptingCascadeId, setAcceptingCascadeId] = useState(null);
  const [cascUpstreamName, setCascUpstreamName] = useState('');
  const [cascUpstreamType, setCascUpstreamType] = useState('component');
  const [cascPolicy, setCascPolicy] = useState('open');
  /* All disclosure requests visible to supplier (org-level concern, not per-asset) */
  const nodeReqs = (disclosureRequests || []).filter(r => r.status !== 'declined');

  return <>
    {/* ═══ Supplier asset: SDA section (above claims, outside filtering) ═══ */}
    {sdaList.length > 0 && <div style={{ marginBottom: 8 }}>
      {sdaList.length > 1 && <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--border-hover)', letterSpacing: '.06em', marginBottom: 6 }}>DISCLOSURE AGREEMENTS ({sdaList.length})</div>}
      {sdaList.map((sda, idx) => {
        const tc = SDA_TYPE_COLORS[sda.type] || 'var(--text-muted)';
        const sc = SDA_STATUS_COLORS[sda.status] || 'var(--text-tertiary)';
        const dash = SDA_LINE_DASH[sda.type] || 'none';
        return <div key={sda.id || idx} style={{ padding: '10px 12px', background: 'var(--bg-deep)', border: `1px solid color-mix(in srgb, ${tc} 20%, transparent)`, borderRadius: 6, marginBottom: idx < sdaList.length - 1 ? 6 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '.06em' }}>DISCLOSURE AGREEMENT</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: tc, textTransform: 'uppercase' }}>{sda.type}</span>
              <span style={{ fontSize: 9, color: sc, fontFamily: 'monospace' }}>● {sda.status}</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-primary)' }}>{sda.discloser}</span>
            <svg width="24" height="8" style={{ flexShrink: 0 }}><line x1="0" y1="4" x2="24" y2="4" stroke={tc} strokeWidth="2" strokeDasharray={dash} /></svg>
            <span style={{ color: 'var(--text-primary)' }}>{sda.receiver}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
            Created {sda.created}{sda.expires ? ` · Expires ${sda.expires}` : ' · No expiry'}
          </div>
          {sda.type === 'selective' && sda.redactedFields?.length > 0 && <div style={{ marginTop: 5, fontSize: 9, color: 'var(--accent-amber)', fontFamily: 'monospace' }}>
            {sda.redactedFields.length} field categor{sda.redactedFields.length === 1 ? 'y' : 'ies'} redacted from this disclosure
          </div>}
          {sda.type === 'derivative' && sda.sourceEvalId && <div style={{ marginTop: 5, fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace' }}>
            Eval ref: {sda.sourceEvalId} · Result: {sda.evalResult}
          </div>}
          {sda.status === 'revoked' && sda.revokeReason && <div style={{ marginTop: 5, fontSize: 9, color: 'var(--accent-red)', fontFamily: 'monospace', fontStyle: 'italic' }}>Revoked: {sda.revokeReason}</div>}
          {onSupplierRevokeSDA && sda.status === 'active' && <>
            {revokingSdaId !== sda.id
              ? <button onClick={(e) => { e.stopPropagation(); setRevokingSdaId(sda.id); setRevokeSdaReason(''); }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  style={{ marginTop: 6, width: '100%', padding: '4px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', transition: 'color .15s, border-color .15s' }}>
                  Revoke SDA</button>
              : <div style={{ marginTop: 6, padding: '8px', background: 'var(--accent-red-bg)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: 'var(--accent-red)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 4 }}>CONFIRM SDA REVOCATION</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.5 }}>This will revoke this disclosure agreement. The node will remain visible with a REVOKED status.</div>
                  <textarea value={revokeSdaReason} onChange={e => setRevokeSdaReason(e.target.value)} rows={2} placeholder="Reason for revocation (required)..."
                    style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 4 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setRevokingSdaId(null); setRevokeSdaReason(''); }}
                      style={{ flex: 1, padding: '4px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                    <button disabled={!revokeSdaReason.trim()} onClick={() => { onSupplierRevokeSDA(node.id, sda.id, revokeSdaReason); setRevokingSdaId(null); setRevokeSdaReason(''); }}
                      style={{ flex: 2, padding: '4px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: revokeSdaReason.trim() ? 'color-mix(in srgb, var(--accent-red) 8%, transparent)' : 'var(--bg-surface)', border: `1px solid ${revokeSdaReason.trim() ? 'color-mix(in srgb, var(--accent-red) 27%, transparent)' : 'var(--border)'}`, borderRadius: 4, color: revokeSdaReason.trim() ? 'var(--accent-red)' : 'var(--text-muted)', cursor: revokeSdaReason.trim() ? 'pointer' : 'not-allowed', opacity: revokeSdaReason.trim() ? 1 : 0.5 }}>Confirm Revoke</button>
                  </div>
                </div>
            }
          </>}
        </div>;
      })}
    </div>}

    {/* ═══ Supplier asset: cascade requests ═══ */}
    {(() => {
      const nodeCasc = (cascadeRequests || []).filter(r => r.requesterNodeId === node.id || r.supplierOrg === node.supplier);
      if (!nodeCasc.length || !onAcceptCascade) return null;
      return <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--border-hover)', letterSpacing: '.06em', marginBottom: 6 }}>CASCADE REQUESTS ({nodeCasc.length})</div>
        {nodeCasc.map(cr => {
          const isPending = cr.status === 'pending';
          const isAccepted = cr.status === 'accepted';
          const isAccepting = acceptingCascadeId === cr.id;
          return <div key={cr.id} style={{ padding: '10px 12px', background: 'var(--bg-deep)', border: `1px solid color-mix(in srgb, var(--accent-sda-cascade) 20%, transparent)`, borderRadius: 6, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-sda-cascade)', letterSpacing: '.06em' }}>CASCADE REQUEST</span>
              <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: isPending ? 'var(--accent-sda-cascade)' : isAccepted ? 'var(--accent-green)' : 'var(--text-muted)', textTransform: 'uppercase' }}>{cr.status}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>
              Buyer requests upstream visibility for <span style={{ color: 'var(--text-primary)' }}>{cr.requesterNodeName}</span>
            </div>
            {cr.message && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4, lineHeight: 1.5 }}>{cr.message}</div>}

            {isPending && !isAccepting && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => { setAcceptingCascadeId(cr.id); setCascUpstreamName(''); setCascUpstreamType('component'); setCascPolicy('open'); }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-sda-cascade)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-sda-cascade) 33%, transparent)'; }}
                style={{ flex: 2, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid color-mix(in srgb, var(--accent-sda-cascade) 33%, transparent)', borderRadius: 4, color: 'var(--accent-sda-cascade)', cursor: 'pointer', transition: 'border-color .15s' }}>Accept Cascade</button>
              <button onClick={() => onDeclineCascade(cr.id, 'Declined by supplier')}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', transition: 'color .15s, border-color .15s' }}>Decline</button>
            </div>}

            {isPending && isAccepting && <div style={{ marginTop: 6, padding: '8px', background: 'color-mix(in srgb, var(--accent-sda-cascade) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-sda-cascade) 15%, transparent)', borderRadius: 6 }}>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, fontFamily: 'monospace' }}>Upstream Asset Name *</div>
                <input value={cascUpstreamName} onChange={e => setCascUpstreamName(e.target.value)} placeholder="e.g. Raw Material Supplier"
                  className="dim-ph"
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-display)' }} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, fontFamily: 'monospace' }}>Asset Type</div>
                <select value={cascUpstreamType} onChange={e => setCascUpstreamType(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace' }}>
                  <option value="component">Component</option>
                  <option value="rawsource">Raw Source</option>
                  <option value="subsystem">Subsystem</option>
                  <option value="assembly">Assembly</option>
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, fontFamily: 'monospace' }}>Cascade Policy</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['open', 'scoped'].map(p => <button key={p} onClick={() => setCascPolicy(p)}
                    style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: cascPolicy === p ? 'color-mix(in srgb, var(--accent-sda-cascade) 12%, transparent)' : 'transparent', border: `1px solid ${cascPolicy === p ? 'var(--accent-sda-cascade)' : 'var(--border)'}`, borderRadius: 4, color: cascPolicy === p ? 'var(--accent-sda-cascade)' : 'var(--text-muted)', cursor: 'pointer', textTransform: 'capitalize' }}>{p}</button>)}
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'monospace', lineHeight: 1.4 }}>
                  {cascPolicy === 'open' ? 'Anyone downstream can see this disclosure' : 'Only this buyer\'s network can see this'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setAcceptingCascadeId(null)}
                  style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                <button disabled={!cascUpstreamName.trim()} onClick={() => { onAcceptCascade(cr.id, cascUpstreamName.trim(), cascUpstreamType, cascPolicy); setAcceptingCascadeId(null); }}
                  style={{ flex: 2, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: cascUpstreamName.trim() ? 'color-mix(in srgb, var(--accent-sda-cascade) 10%, transparent)' : 'var(--bg-surface)', border: `1px solid ${cascUpstreamName.trim() ? 'var(--accent-sda-cascade)' : 'var(--border)'}`, borderRadius: 4, color: cascUpstreamName.trim() ? 'var(--accent-sda-cascade)' : 'var(--text-muted)', cursor: cascUpstreamName.trim() ? 'pointer' : 'not-allowed', opacity: cascUpstreamName.trim() ? 1 : 0.5 }}>Propagate Upstream ↯</button>
              </div>
            </div>}

            {isAccepted && <div style={{ marginTop: 4, fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace' }}>
              ✓ {cr.upstreamAssetName} · <span style={{ color: 'var(--accent-sda-cascade)' }}>{cr.cascadePolicy}</span>
            </div>}
          </div>;
        })}
      </div>;
    })()}

    {/* ═══ Supplier asset: action scaffolds ═══ */}
    <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {!showManageAtts
        ? <button onClick={() => setShowManageAtts(true)} style={{ width: '100%', height: 36, padding: 0, background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'border-color .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>Manage Attestations</button>
        : <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.06em' }}>ATTESTATIONS ({(node.rawAttestations || []).length})</span>
              <button onClick={() => { setShowManageAtts(false); setAddingClaim(false); setRevokingAttIdx(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
            </div>
            {/* Attestation list */}
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
              {(node.rawAttestations || []).map((att, i) => {
                const isRevoked = att.status === 'revoked';
                const isRevoking = revokingAttIdx === i;
                return <div key={i} style={{ padding: '6px 0', borderBottom: i < (node.rawAttestations||[]).length - 1 ? '1px solid var(--border)' : 'none', opacity: isRevoked ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-primary)', flex: 1, fontWeight: 600 }}>{att.predicate.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 8, fontFamily: 'monospace', color: isRevoked ? 'var(--accent-red)' : att.status === 'verified' ? 'var(--accent-green)' : 'var(--accent-amber)', fontWeight: 700 }}>{(att.status || 'pending').toUpperCase()}</span>
                    {!isRevoked && !isRevoking && onRevokeAttestation && <button onClick={() => { setRevokingAttIdx(i); setRevokeAttReason(''); }}
                      style={{ fontSize: 8, fontFamily: 'monospace', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}>revoke</button>}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>{att.actor?.name || 'Unknown'} · {att.timestamp ? new Date(att.timestamp).toLocaleDateString() : 'N/A'}</div>
                  {isRevoking && <div style={{ marginTop: 6, padding: 6, background: 'color-mix(in srgb, var(--accent-red) 4%, transparent)', borderRadius: 4 }}>
                    <textarea value={revokeAttReason} onChange={e => setRevokeAttReason(e.target.value)} rows={2} placeholder="Reason for revocation (required)..."
                      style={{ width: '100%', padding: '4px 6px', fontSize: 9, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 4 }} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setRevokingAttIdx(null)}
                        style={{ flex: 1, padding: '3px 0', fontSize: 8, fontFamily: 'monospace', background: 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                      <button disabled={!revokeAttReason.trim()} onClick={() => { onRevokeAttestation(node.id, i, revokeAttReason); setRevokingAttIdx(null); setRevokeAttReason(''); }}
                        style={{ flex: 2, padding: '3px 0', fontSize: 8, fontFamily: 'monospace', fontWeight: 600, background: revokeAttReason.trim() ? 'color-mix(in srgb, var(--accent-red) 8%, transparent)' : 'var(--bg-surface)', border: `1px solid ${revokeAttReason.trim() ? 'color-mix(in srgb, var(--accent-red) 27%, transparent)' : 'var(--border)'}`, borderRadius: 3, color: revokeAttReason.trim() ? 'var(--accent-red)' : 'var(--text-muted)', cursor: revokeAttReason.trim() ? 'pointer' : 'not-allowed', opacity: revokeAttReason.trim() ? 1 : 0.5 }}>Confirm Revoke</button>
                    </div>
                  </div>}
                </div>;
              })}
              {(node.rawAttestations || []).length === 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>No attestations yet</div>}
            </div>
            {/* Add claim */}
            {!addingClaim
              ? <button onClick={() => setAddingClaim(true)} style={{ width: '100%', padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', borderRadius: 4, color: 'var(--accent-green)', cursor: 'pointer' }}>+ Add Claim</button>
              : <div style={{ padding: 8, background: 'color-mix(in srgb, var(--accent-green) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 15%, transparent)', borderRadius: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>NEW CLAIM</div>
                  <select value={newPredicate} onChange={e => setNewPredicate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: 10, fontFamily: 'monospace', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', outline: 'none', marginBottom: 6 }}>
                    {PREDICATES.map(p => <option key={p.key} value={p.key}>{p.label} ({p.cat})</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setAddingClaim(false)}
                      style={{ flex: 1, padding: '4px 0', fontSize: 9, fontFamily: 'monospace', background: 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => { if (onAddAttestation) onAddAttestation(node.id, newPredicate); setAddingClaim(false); }}
                      style={{ flex: 2, padding: '4px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'var(--accent-green)', border: '1px solid var(--accent-green)', borderRadius: 3, color: 'var(--text-bright)', cursor: 'pointer' }}>Submit Claim</button>
                  </div>
                </div>}
          </div>}

      {/* Disclosure Offer */}
      {(()=>{
        const activeOffer = (disclosureOffers || []).find(o => o.assetId === node.id && o.status !== 'revoked');
        const revokedOffer = !activeOffer ? (disclosureOffers || []).find(o => o.assetId === node.id && o.status === 'revoked') : null;
        const existingOffer = activeOffer || revokedOffer;
        if (existingOffer && !showOfferCreate) {
          const isRevoked = existingOffer.status === 'revoked';
          const oc = existingOffer.disclosureTypes[0] === 'full' ? 'var(--accent-sda-full)' : existingOffer.disclosureTypes[0] === 'selective' ? 'var(--accent-amber)' : 'var(--accent-green)';
          return <div style={{ background: isRevoked ? 'var(--bg-deep)' : 'color-mix(in srgb, var(--accent-indigo) 3%, transparent)', border: `1px solid ${isRevoked ? 'color-mix(in srgb, var(--accent-red) 13%, transparent)' : 'color-mix(in srgb, var(--accent-indigo) 20%, transparent)'}`, borderRadius: 4, padding: '8px 10px', opacity: isRevoked ? 0.7 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: isRevoked ? 'var(--text-muted)' : 'var(--accent-indigo)', letterSpacing: '.06em' }}>DISCLOSURE OFFER</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: `color-mix(in srgb, ${oc} 8%, transparent)`, color: oc, border: `1px solid color-mix(in srgb, ${oc} 20%, transparent)` }}>{existingOffer.disclosureTypes[0]}</span>
                {isRevoked && <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-red)' }}>REVOKED</span>}
              </div>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>Created {existingOffer.createdAt?.slice(0, 10)}</div>
            {isRevoked && existingOffer.revokeReason && <div style={{ fontSize: 9, color: 'var(--accent-red)', fontFamily: 'monospace', marginTop: 3, fontStyle: 'italic' }}>Reason: {existingOffer.revokeReason}</div>}
            {!isRevoked && onRevokeOffer && <>
              {revokingOfferId !== existingOffer.id
                ? <button onClick={(e) => { e.stopPropagation(); setRevokingOfferId(existingOffer.id); setRevokeOfferReason(''); }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    style={{ marginTop: 6, width: '100%', padding: '4px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', transition: 'color .15s, border-color .15s' }}>
                    Revoke Offer</button>
                : <div style={{ marginTop: 6, padding: '8px', background: 'var(--accent-red-bg)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)', borderRadius: 6 }}>
                    <div style={{ fontSize: 9, color: 'var(--accent-red)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 4 }}>CONFIRM REVOCATION</div>
                    <textarea value={revokeOfferReason} onChange={e => setRevokeOfferReason(e.target.value)} rows={2} placeholder="Reason for revocation (required)..."
                      style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 4 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setRevokingOfferId(null); setRevokeOfferReason(''); }}
                        style={{ flex: 1, padding: '4px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                      <button disabled={!revokeOfferReason.trim()} onClick={() => { onRevokeOffer(existingOffer.id, revokeOfferReason); setRevokingOfferId(null); setRevokeOfferReason(''); }}
                        style={{ flex: 2, padding: '4px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: revokeOfferReason.trim() ? 'color-mix(in srgb, var(--accent-red) 8%, transparent)' : 'var(--bg-surface)', border: `1px solid ${revokeOfferReason.trim() ? 'color-mix(in srgb, var(--accent-red) 27%, transparent)' : 'var(--border)'}`, borderRadius: 4, color: revokeOfferReason.trim() ? 'var(--accent-red)' : 'var(--text-muted)', cursor: revokeOfferReason.trim() ? 'pointer' : 'not-allowed', opacity: revokeOfferReason.trim() ? 1 : 0.5 }}>Confirm Revoke</button>
                    </div>
                  </div>
              }
            </>}
          </div>;
        }

        if (showOfferCreate) return <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginTop: 4 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 8 }}>CREATE DISCLOSURE OFFER</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.5 }}>Select the disclosure type for <strong style={{ color: 'var(--text-secondary)' }}>{node.name}</strong>.</div>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, letterSpacing: '.06em' }}>DISCLOSURE TYPE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {[{ key: 'full', label: 'Full', desc: 'All data fields', color: 'var(--accent-sda-full)' }, { key: 'selective', label: 'Selective', desc: 'Specific fields only', color: 'var(--accent-amber)' }, { key: 'derivative', label: 'Derivative', desc: 'Eval results only', color: 'var(--accent-green)' }].map(dt => {
              const selected = offerType === dt.key;
              return <div key={dt.key} onClick={() => setOfferType(dt.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: selected ? `color-mix(in srgb, ${dt.color} 3%, transparent)` : 'transparent', border: `1px solid ${selected ? `color-mix(in srgb, ${dt.color} 27%, transparent)` : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', transition: 'all .15s' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, border: `2px solid ${selected ? dt.color : 'var(--border-hover)'}`, background: selected ? dt.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--bg-deep)' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: selected ? dt.color : 'var(--text-tertiary)' }}>{dt.label}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 6 }}>{dt.desc}</span>
                </div>
              </div>;
            })}
          </div>
          {/* Field selection for selective/derivative */}
          {(offerType === 'selective' || offerType === 'derivative') && <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, letterSpacing: '.06em' }}>DISCLOSED FIELDS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {SDA_FIELDS.map(f => {
                const on = offerFields.has(f.key);
                return <div key={f.key} onClick={() => { if (f.locked) return; const ns = new Set(offerFields); if (ns.has(f.key)) ns.delete(f.key); else ns.add(f.key); setOfferFields(ns); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: on ? 'color-mix(in srgb, var(--accent-indigo) 4%, transparent)' : 'transparent', border: `1px solid ${on ? 'color-mix(in srgb, var(--accent-indigo) 20%, transparent)' : 'var(--border)'}`, borderRadius: 4, cursor: f.locked ? 'default' : 'pointer', opacity: f.locked ? 0.7 : 1 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, border: `1.5px solid ${on ? 'var(--accent-indigo)' : 'var(--border-hover)'}`, background: on ? 'var(--accent-indigo)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <span style={{ fontSize: 7, color: 'var(--text-bright)', lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 10, color: on ? 'var(--text-primary)' : 'var(--text-muted)', flex: 1 }}>{f.label}</span>
                  {f.locked && <span style={{ fontSize: 7, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700 }}>REQUIRED</span>}
                </div>;
              })}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{offerFields.size} of {SDA_FIELDS.length} fields disclosed{offerType === 'selective' ? `, ${SDA_FIELDS.length - offerFields.size} redacted` : ''}</div>
          </div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setShowOfferCreate(false); setOfferType('full'); setOfferFields(new Set(['part_identification','certifications'])); }}
              style={{ flex: 1, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', fontSize: 9, fontFamily: 'monospace', cursor: 'pointer' }}>Cancel</button>
            <button disabled={!offerType} onClick={() => {
              if (onCreateOffer && offerType) {
                const disclosed = offerType === 'full' ? SDA_FIELDS.map(f=>f.key) : [...offerFields];
                const redacted = offerType === 'full' ? [] : SDA_FIELDS.filter(f=>!offerFields.has(f.key)).map(f=>f.key);
                onCreateOffer(node.id, node.name, node.type, [offerType], true, { disclosedFields: disclosed, redactedFields: redacted });
                setShowOfferCreate(false); setOfferType('full'); setOfferFields(new Set(['part_identification','certifications']));
              }
            }} style={{
              flex: 2, height: 28, background: offerType ? 'var(--accent-indigo)' : 'var(--bg-surface)',
              border: `1px solid ${offerType ? 'var(--accent-indigo)' : 'var(--border)'}`, borderRadius: 4,
              color: offerType ? 'var(--text-bright)' : 'var(--text-muted)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
              cursor: offerType ? 'pointer' : 'not-allowed', opacity: offerType ? 1 : 0.5,
            }}>Create Offer</button>
          </div>
        </div>;

        return <button onClick={() => setShowOfferCreate(true)} style={{
          width: '100%', height: 32, padding: 0, background: 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-indigo) 27%, transparent)', borderRadius: 4,
          color: 'var(--accent-indigo)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
        }}>+ Create Disclosure Offer</button>;
      })()}
    </div>

    {/* ═══ Disclosure Requests (from buyers via Asset Directory) ═══ */}
    {nodeReqs.length > 0 && (() => {
      const pendingCount = nodeReqs.filter(r => r.status === 'pending').length;
      const typeColor = t => t === 'full' ? 'var(--accent-sda-full)' : t === 'selective' ? 'var(--accent-amber)' : t === 'derivative' ? 'var(--accent-green)' : 'var(--accent-indigo)';
      const statusColor = s => s === 'approved' ? 'var(--accent-green)' : s === 'declined' ? 'var(--accent-red)' : 'var(--accent-purple-light)';
      return <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--border-hover)', letterSpacing: '.06em' }}>DISCLOSURE REQUESTS ({nodeReqs.length})</span>
          {pendingCount > 0 && <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-purple-light)', background: 'color-mix(in srgb, var(--accent-purple-light) 9%, transparent)', padding: '1px 5px', borderRadius: 8 }}>{pendingCount} pending</span>}
        </div>
        {nodeReqs.map(r => {
          const isDeclining = decliningReqId === r.id;
          const tc = typeColor(r.requestedType);
          const sc = statusColor(r.status);
          return <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg-deep)', border: `1px solid color-mix(in srgb, ${sc} 13%, transparent)`, borderRadius: 6, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.requestedBy || 'Buyer'}</span>
              <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: `color-mix(in srgb, ${tc} 8%, transparent)`, color: tc, border: `1px solid color-mix(in srgb, ${tc} 20%, transparent)` }}>{r.requestedType}</span>
              {r.status !== 'pending' && <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: sc, textTransform: 'uppercase' }}>{r.status}</span>}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>Requested {r.requestedAt?.slice(0, 10)}</div>

            {/* Pending: Approve / Decline buttons */}
            {r.status === 'pending' && !isDeclining && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => { if (onApproveDisclosureRequest) onApproveDisclosureRequest(r.id); }}
                style={{ flex: 2, height: 28, background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 27%, transparent)', borderRadius: 4, color: 'var(--accent-green)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green) 15%, transparent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green) 8%, transparent)'; }}
              >Approve & Create SDA</button>
              <button onClick={() => { setDecliningReqId(r.id); setDeclineReason(''); }}
                style={{ flex: 1, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}>Decline</button>
            </div>}

            {/* Declining: reason textarea + confirm/cancel */}
            {r.status === 'pending' && isDeclining && <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 3 }}>Decline reason (optional)</div>
              <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={2} placeholder="Reason for declining..."
                style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => { setDecliningReqId(null); setDeclineReason(''); }}
                  style={{ flex: 1, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => { if (onDeclineDisclosureRequest) onDeclineDisclosureRequest(r.id, declineReason); setDecliningReqId(null); setDeclineReason(''); }}
                  style={{ flex: 2, height: 28, background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 27%, transparent)', borderRadius: 4, color: 'var(--accent-red)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}>Confirm Decline</button>
              </div>
            </div>}

            {/* Approved */}
            {r.status === 'approved' && <div style={{ marginTop: 6, fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace' }}>
              ✓ SDA created · Node added to buyer network
            </div>}

            {/* Declined */}
            {r.status === 'declined' && <div style={{ marginTop: 6 }}>
              {r.declineReason && <div style={{ fontSize: 9, color: 'var(--accent-red)', fontFamily: 'monospace' }}>Reason: {r.declineReason}</div>}
              {!r.declineReason && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', fontStyle: 'italic' }}>No reason provided</div>}
            </div>}
          </div>;
        })}
      </div>;
    })()}

    {/* ═══ Supplier asset: Evaluation history ═══ */}
    {node.evaluations?.length > 0 && <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--border-hover)', letterSpacing: '.06em', marginBottom: 6 }}>EVALUATIONS ({node.evaluations.length})</div>
      {node.evaluations.map((ev, i) => {
        const passed = ev.overallResult === 'pass';
        return <div key={ev.id || i} style={{ padding: '8px 10px', background: 'var(--bg-deep)', border: `1px solid color-mix(in srgb, ${passed ? 'var(--accent-green)' : 'var(--accent-red)'} 13%, transparent)`, borderRadius: 5, marginBottom: i < node.evaluations.length - 1 ? 4 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600 }}>{ev.checklist}</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: passed ? 'var(--accent-green)' : 'var(--accent-red)', textTransform: 'uppercase' }}>{ev.overallResult}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {ev.requirementCount} requirements · {ev.passCount} passed · {ev.failCount} failed
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{ev.date}</div>
        </div>;
      })}
    </div>}

    {/* ═══ Separator between SDA/eval and claims (supplier assets) ═══ */}
    {(sdaList.length > 0 || node.evaluations?.length > 0 || nodeReqs.length > 0) && <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }} />}

    {/* ═══ Evidence Requests (supplier asset view) ═══ */}
    {(() => {
      const evReqs = (evidenceRequests || []).filter(r => r.nodeId === node.id);
      if (evReqs.length === 0) return null;
      const pendingCount = evReqs.filter(r => r.status === 'pending' || r.status === 'rejected').length;
      const awaitingCount = evReqs.filter(r => r.status === 'submitted' || r.status === 'resubmitted').length;
      const acceptedCount = evReqs.filter(r => r.status === 'accepted').length;
      const resolvedCount = evReqs.filter(r => r.status === 'resolved').length;
      const statusColors = { pending: 'var(--accent-amber)', submitted: 'var(--accent-cyan)', resubmitted: 'var(--accent-cyan)', accepted: 'var(--accent-green)', rejected: 'var(--accent-red)', resolved: 'var(--text-tertiary)' };
      const statusIcons = { pending: '◌', submitted: '↑', resubmitted: '↑', accepted: '✓', rejected: '✗', resolved: '✓' };
      const statusLabels = { pending: 'PENDING', submitted: 'SUBMITTED', resubmitted: 'RESUBMITTED', accepted: 'ACCEPTED', rejected: 'REJECTED', resolved: 'USED' };
      return <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--border-hover)', letterSpacing: '.06em', marginBottom: 4 }}>EVIDENCE REQUESTS ({evReqs.length})</div>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', gap: 8 }}>
          {pendingCount > 0 && <span style={{ color: 'var(--accent-amber)' }}>{pendingCount} pending</span>}
          {awaitingCount > 0 && <span style={{ color: 'var(--accent-cyan)' }}>{awaitingCount} awaiting review</span>}
          {acceptedCount > 0 && <span style={{ color: 'var(--accent-green)' }}>{acceptedCount} accepted</span>}
          {resolvedCount > 0 && <span style={{ color: 'var(--text-tertiary)' }}>{resolvedCount} used</span>}
        </div>
        {evReqs.map(r => {
          const sColor = statusColors[r.status] || 'var(--accent-indigo)';
          const sIcon = statusIcons[r.status] || '◌';
          const isResponding = respondingToReq === r.id;
          const sLabel = statusLabels[r.status] || r.status.toUpperCase();
          const totalEvidence = 1 + (r.previousResponses?.length || 0);
          return <div key={r.id} style={{ padding: '8px 10px', background: 'var(--bg-deep)', border: '1px solid ' + `color-mix(in srgb, ${sColor} 13%, transparent)`, borderRadius: 5, marginBottom: 4, opacity: r.status === 'resolved' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: sColor, fontFamily: 'monospace', fontWeight: 700 }}>◧</span>
              <span style={{ fontSize: 10, color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
              <span style={{ fontSize: 8, color: sColor, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{sIcon} {sLabel}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.checklist} · Requested {new Date(r.requestedAt).toLocaleDateString()}{totalEvidence > 1 ? ` · ${totalEvidence} submissions` : ''}</div>
            {r.sdaFieldCategory && <div style={{ fontSize: 9, color: 'var(--accent-amber)', fontFamily: 'monospace', marginTop: 3 }}>⚠ Redacted field: {r.sdaFieldCategory}</div>}

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

            {(r.status === 'pending' || r.status === 'rejected') && <>
              {r.status === 'rejected' && r.reviewNotes && <div style={{ fontSize: 9, color: 'var(--accent-red)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)', borderRadius: 4, padding: '4px 8px', marginTop: 4 }}>Rejected: {r.reviewNotes}</div>}
              {!isResponding && <button onClick={() => { setRespondingToReq(r.id); setEvidenceFileName(''); setEvidenceNotes(''); }}
                style={{ marginTop: 6, width: '100%', padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'var(--bg-surface)', border: '1px solid color-mix(in srgb, var(--accent-cyan) 27%, transparent)', borderRadius: 4, color: 'var(--accent-cyan)', cursor: 'pointer' }}>
                {r.status === 'rejected' ? 'Resubmit Evidence' : 'Respond with Evidence'}
              </button>}
              {isResponding && <div style={{ marginTop: 8 }}>
                {!evidenceFileName
                  ? <div onClick={() => setEvidenceFileName(r.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30) + '_evidence.pdf')}
                      style={{ border: '1px dashed #1e2433', borderRadius: 4, padding: '12px 0', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-app-header)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-cyan) 27%, transparent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
                      <div style={{ fontSize: 14 }}>📎</div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 4 }}>Click to select file</div>
                      <div style={{ fontSize: 8, color: 'var(--border-hover)', fontFamily: 'monospace', marginTop: 2 }}>or drag and drop</div>
                    </div>
                  : <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--bg-card)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', borderRadius: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace' }}>✓</span>
                      <span style={{ fontSize: 9, color: 'var(--text-primary)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evidenceFileName}</span>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace' }}>2.4 MB</span>
                      <button onClick={() => setEvidenceFileName('')} style={{ fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
                    </div>
                }
                <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 8, marginBottom: 3 }}>Notes (optional)</div>
                <textarea value={evidenceNotes} onChange={e => setEvidenceNotes(e.target.value)} rows={3} placeholder="Add context for the buyer..."
                  style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => setRespondingToReq(null)}
                    style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                  <button disabled={!evidenceFileName}
                    onClick={() => { if (onSubmitEvidence) onSubmitEvidence(r.id, { fileName: evidenceFileName, fileType: 'application/pdf', fileSize: '2.4 MB', notes: evidenceNotes }); setRespondingToReq(null); }}
                    style={{ flex: 2, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: evidenceFileName ? 'color-mix(in srgb, var(--accent-cyan) 8%, transparent)' : 'var(--bg-surface)', border: `1px solid ${evidenceFileName ? 'color-mix(in srgb, var(--accent-cyan) 27%, transparent)' : 'var(--border)'}`, borderRadius: 4, color: evidenceFileName ? 'var(--accent-cyan)' : 'var(--text-muted)', cursor: evidenceFileName ? 'pointer' : 'not-allowed', opacity: evidenceFileName ? 1 : 0.5 }}>Submit Evidence</button>
                </div>
              </div>}
            </>}

            {(r.status === 'submitted' || r.status === 'resubmitted') && <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                <span>📎</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.response?.fileName}</span>
                <span style={{ color: 'var(--text-muted)' }}>· {r.response?.submittedAt ? new Date(r.response.submittedAt).toLocaleDateString() : ''}</span>
              </div>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 3, fontStyle: 'italic' }}>Awaiting buyer review…</div>
            </div>}

            {r.status === 'accepted' && <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace' }}>✓ Evidence accepted</div>
              {r.response?.fileName && <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>📎 {r.response.fileName}</div>}
              {r.reviewedBy && <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>Reviewed by {r.reviewedBy} · {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : ''}</div>}
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
