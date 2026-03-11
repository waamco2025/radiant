import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TT } from '../data/tokens';
import NodeIcon from './NodeIcon';
import AttestationCard from './AttestationCard';
import ClaimTimeline from './ClaimTimeline';
import { EvidencePanel } from './EvidenceModal';
import InviteSupplierModal, { InviteSupplierPanel } from './InviteSupplierModal';
import { getVerticalConfig } from '../data/verticals';
import { SH, SDA_FIELD_TO_CATS, SDA_TYPE_COLORS, SDA_LINE_DASH, SDA_STATUS_COLORS, TYPE_CATS, CAT_ORDER, PRED_TO_CAT, sortAtts, healthSummary, deriveCompliance, mockSupplierDetails } from './detailPanelUtils';
import OverviewTab from './OverviewTab';
import EvalsTab from './EvalsTab';
import ClaimsTab from './ClaimsTab';
import TimelineTab from './TimelineTab';
import SupplierAssetSection from './SupplierAssetSection';
import OrgNodeContent from './OrgNodeContent';

export default function Detail({ node, onClose, onViewChain, onSelect, chainRootId, nodeTypeLabels, credits, setCredits, onEvaluationComplete, invitedSet, onInvite, onRevokeInvite, vert, terminalTypes, autoOpenInvite, onAutoOpenInviteConsumed, onRequirementsClick, onOpenSystemModal, onOpenSDAModal, onOpenEvalModal, isSupplier, approvalStates, onApproveAsset, onRejectAsset, evidenceRequests, onSubmitEvidence, onReviewEvidence, onRevokeSDA, activityLog, onCreateOffer, onRevokeOffer, onSupplierRevokeSDA, disclosureOffers, disclosureRequests, onApproveDisclosureRequest, onDeclineDisclosureRequest, onAddAttestation, onRevokeAttestation, cascadeRequests, onCreateCascadeRequest, onAcceptCascade, onDeclineCascade }) {
  if (!node) return null;
  const t = TT[node.type] || TT.component;
  const typeLabel = nodeTypeLabels?.[node.type] || t.label;

  /* Local attestation override for evaluation flow */
  const [evidenceAtt, setEvidenceAtt] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [revokeConfirmIdx, setRevokeConfirmIdx] = useState(null);
  const [revokedIdx, setRevokedIdx] = useState(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [respondingToReq, setRespondingToReq] = useState(null);
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [reviewingReqId, setReviewingReqId] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [revokeConfirmSdaId, setRevokeConfirmSdaId] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [showOfferCreate, setShowOfferCreate] = useState(false);
  const [offerType, setOfferType] = useState('full');
  const [offerFields, setOfferFields] = useState(new Set(['part_identification','certifications']));
  const [offerDiscoverable, setOfferDiscoverable] = useState(true);
  const [decliningReqId, setDecliningReqId] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  useEffect(() => { setEvidenceAtt(null); setShowInvite(false); setRevokeConfirmIdx(null); setRevokedIdx(null); setShowApproveConfirm(false); setShowRejectConfirm(false); setApprovalNotes(''); setRespondingToReq(null); setEvidenceFileName(''); setEvidenceNotes(''); setReviewingReqId(null); setRejectNotes(''); setRevokeConfirmSdaId(null); setRevokeReason(''); setShowOfferCreate(false); setOfferType('full'); setOfferFields(new Set(['part_identification','certifications'])); setOfferDiscoverable(true); setDecliningReqId(null); setDeclineReason(''); setTab(isSupplier ? 'claims' : ['program','system'].includes(node?.type) ? 'claims' : 'overview'); }, [node?.id]);
  useEffect(() => { if (autoOpenInvite) { setShowInvite(true); if (onAutoOpenInviteConsumed) onAutoOpenInviteConsumed(); } }, [autoOpenInvite]);
  const raw = node.rawAttestations || [];

  /* State */
  const [tab, setTab] = useState(isSupplier ? 'claims' : ['program','system'].includes(node?.type) ? 'claims' : 'overview');
  const [typeFilt, setTypeFilt] = useState('All');
  const [statusFilt, setStatusFilt] = useState('All');
  const [expandedSet, setExpandedSet] = useState(new Set());
  const [supExpanded, setSupExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersActive = typeFilt !== 'All' || statusFilt !== 'All';
  const claimsRef = useRef(null);

  const toggle = idx => setExpandedSet(prev => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });

  /* Derived data */
  const health = useMemo(() => healthSummary(raw), [raw]);
  const hasItar = useMemo(() => raw.some(a => a.predicate === 'itar_controlled'), [raw]);
  const cs = useMemo(() => deriveCompliance(raw), [raw]);
  const supplierMock = useMemo(() => mockSupplierDetails(node.supplier, node.location), [node.supplier, node.location]);

  /* SDA redaction */
  const redactedCats = useMemo(() => {
    if (node.sda?.type !== 'selective' || !node.sda?.redactedFields) return new Set();
    const cats = new Set();
    for (const field of node.sda.redactedFields) {
      for (const cat of (SDA_FIELD_TO_CATS[field] || [])) cats.add(cat);
    }
    return cats;
  }, [node.sda]);
  const isSupplierRedacted = node.sda?.type === 'selective' && node.sda?.redactedFields?.includes('supplier_identity');

  /* Supplier context helpers */
  const isSupplierAsset = isSupplier && !node.disclosureSummary && !node.networkSummary;
  const isSupplierBuyerOrg = isSupplier && !!node.disclosureSummary;
  const isSupplierSelfOrg = isSupplier && !!node.networkSummary;
  const isSupplierOrg = isSupplierBuyerOrg || isSupplierSelfOrg;

  /* SDA list (shared between header and body rendering) */
  const sdaList = useMemo(() => node.sdas || (node.sda ? [node.sda] : []), [node.sdas, node.sda]);

  /* Filter + sort (claims tab) */
  const filtered = useMemo(() => {
    let list = raw;
    if (typeFilt !== 'All') {
      const preds = TYPE_CATS[typeFilt] || [];
      list = list.filter(a => preds.includes(a.predicate));
    }
    if (statusFilt !== 'All') {
      list = list.filter(a => a.status === statusFilt);
    }
    return sortAtts(list, 'newest');
  }, [raw, typeFilt, statusFilt]);

  /* Group by category when showing All types */
  const grouped = useMemo(() => {
    if (typeFilt !== 'All') return null;
    const buckets = {};
    for (let i = 0; i < filtered.length; i++) {
      const att = filtered[i];
      const cat = PRED_TO_CAT[att.predicate] || 'Other';
      (buckets[cat] || (buckets[cat] = [])).push({ att, fi: i });
    }
    return CAT_ORDER.filter(c => buckets[c]?.length).map(c => ({ cat: c, items: buckets[c] }));
  }, [filtered, typeFilt]);

  const invites = invitedSet instanceof Map ? (invitedSet.get(node.id) || []) : [];
  const vertConfig = useMemo(() => vert ? getVerticalConfig(vert) : null, [vert]);
  const isProgramNode = node.type === 'program';
  const systemTierLabel = useMemo(() => {
    if (!vertConfig) return 'System';
    const st = vertConfig.tierHierarchy?.find(t => t.key === 'system');
    return vertConfig.nodeTypeLabels?.system || st?.label || 'System';
  }, [vertConfig]);

  /* Timeline selection */
  const [tlSelIdx, setTlSelIdx] = useState(null);
  const tlSelected = tlSelIdx !== null ? raw[tlSelIdx] : null;

  /* ═══ Evidence panel mode — replaces entire panel content ═══ */
  if (evidenceAtt) {
    return <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'var(--bg-overlay)', borderLeft: '1px solid var(--border)', animation: 'pfade .2s ease', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <EvidencePanel attestation={evidenceAtt} onClose={() => setEvidenceAtt(null)} node={node} nodeTypeLabels={nodeTypeLabels} />
    </div>;
  }

  /* ═══ Invite panel mode — replaces entire panel content ═══ */
  if (showInvite) {
    return <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'var(--bg-overlay)', borderLeft: '1px solid var(--border)', animation: 'pfade .2s ease', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NodeIcon type={node.type} size={16} />
            <span style={{ fontSize: 9, color: t.border, fontFamily: 'monospace', fontWeight: 700 }}>{typeLabel}</span>
          </div>
          <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>{node.name}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {node.token && <span style={{ fontSize: 9, background: 'var(--bg-surface)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>{node.token}</span>}
          {node.block != null && <span style={{ fontSize: 9, background: 'var(--bg-surface)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>BLK #{node.block}</span>}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 18px' }}>
        <InviteSupplierPanel
          node={node}
          requirements={vertConfig?.inviteRequirements || []}
          onInvite={(id, details) => { if (onInvite) onInvite(id, details); setShowInvite(false); }}
          onClose={() => setShowInvite(false)}
        />
      </div>
    </div>;
  }

  return <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'var(--bg-overlay)', borderLeft: '1px solid var(--border)', animation: 'pfade .2s ease', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>

    {/* ═══ HEADER (fixed) ═══ */}
    <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
      {/* Type + close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NodeIcon type={node.type} size={18} />
          <span style={{ fontSize: 10, color: t.border, fontFamily: 'monospace', fontWeight: 700 }}>{typeLabel}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
      </div>

      {/* Name */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-bright)', margin: '0 0 6px' }}>{node.name}</h2>

      {/* Token + block + health badge (hidden for supplier org nodes) */}
      {!isSupplierOrg && <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 9, background: 'var(--bg-surface)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>{node.token}</span>
        <span style={{ fontSize: 9, background: 'var(--bg-surface)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>BLK #{node.block}</span>
        {raw.length > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 3, background: 'var(--bg-surface)', border: '1px solid var(--border)66', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--accent-green)' }}>{health.ok} ✓</span>
          {health.warn > 0 && <span style={{ color: 'var(--accent-amber)' }}>{health.warn} ⚠</span>}
          {health.bad > 0 && <span style={{ color: 'var(--accent-red)' }}>{health.bad} ✗</span>}
          {health.warn === 0 && health.bad === 0 && <span style={{ color: 'var(--text-muted)' }}>0 ⚠</span>}
        </span>}
        {node.type !== 'customer' && !raw.some(a => a.predicate === 'evaluated_against_requirements') && <span style={{ fontSize: 7, background: 'var(--accent-purple)', color: 'var(--text-bright)', padding: '1px 4px', borderRadius: 2, fontWeight: 700, fontFamily: 'monospace', lineHeight: '12px' }}>?</span>}
      </div>}

      {/* ITAR badge (hidden for supplier org nodes) */}
      {!isSupplierOrg && hasItar && <div style={{ padding: '8px 10px', background: 'var(--accent-red-bg)', border: '1px solid #7f1d1d', borderRadius: 6, fontSize: 11, color: 'var(--accent-red)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13 }}>⚠</span><span style={{ fontWeight: 600 }}>ITAR CONTROLLED</span><span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>— Export restricted</span>
      </div>}

      {/* ═══ Provisional / Approved status indicator ═══ */}
      {!isSupplier && !['customer','program','system'].includes(node.type) && (() => {
        const approval = approvalStates?.[node.id];
        if (approval?.status === 'approved') return <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'color-mix(in srgb, var(--accent-green) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', borderRadius: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>&#10003;</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-green)', fontFamily: 'monospace' }}>APPROVED</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', marginLeft: 'auto' }}>{new Date(approval.timestamp).toLocaleDateString()}</span>
        </div>;
        if (approval?.status === 'rejected') return <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'color-mix(in srgb, var(--accent-red) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)', borderRadius: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--accent-red)' }}>&#10007;</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-red)', fontFamily: 'monospace' }}>REJECTED</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', marginLeft: 'auto' }}>{new Date(approval.timestamp).toLocaleDateString()}</span>
        </div>;
        return <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--border-faint)', border: '1px dashed #374151', borderRadius: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>◇</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'monospace' }}>PROVISIONAL</span>
          <span style={{ fontSize: 9, color: 'var(--border-hover)', fontFamily: 'monospace', marginLeft: 'auto' }}>Awaiting evaluation</span>
        </div>;
      })()}

      {/* ═══ Location for supplier org nodes ═══ */}
      {isSupplierOrg && node.location && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>{node.location}</div>}

      {/* ═══ Supplier info (hidden for supplier org nodes) ═══ */}
      {!isSupplierOrg && (node.supplier || node.location) && <div style={{ marginBottom: 10 }}>
        <div onClick={() => { if (!isSupplierRedacted) setSupExpanded(p => !p); }} style={{ display: 'flex', alignItems: 'center', gap: 0, cursor: isSupplierRedacted ? 'default' : 'pointer', padding: '4px 0' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: isSupplierRedacted ? 'var(--border-hover)' : 'var(--text-primary)', fontStyle: isSupplierRedacted ? 'italic' : 'normal' }}>{isSupplierRedacted ? '● REDACTED UNDER SDA' : (node.supplier || '')}</span>
          {!isSupplierRedacted && supplierMock.country && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>· {[supplierMock.cityPostal.split(',')[0], supplierMock.country].filter(Boolean).join(', ')}</span>}
          {!isSupplierRedacted && <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto', transition: 'transform .15s', transform: supExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>}
        </div>
        {supExpanded && !isSupplierRedacted && <div style={{ padding: '6px 0 2px 12px', borderLeft: '2px solid var(--border)', marginTop: 4, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <div>{supplierMock.street}</div>
          <div>{supplierMock.cityPostal}</div>
          {supplierMock.country && <div>{supplierMock.country}</div>}
          <div style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: 9 }}>SIGNATORY</span>
            <span style={{ margin: '0 6px', color: 'var(--text-faint)' }}>·</span>
            <span>{supplierMock.signatory} · {supplierMock.sigTitle}</span>
          </div>
        </div>}
      </div>}

      {/* ═══ Supplier asset section ═══ */}
      {isSupplierAsset && <SupplierAssetSection
        node={node} sdaList={sdaList} disclosureOffers={disclosureOffers}
        showOfferCreate={showOfferCreate} setShowOfferCreate={setShowOfferCreate}
        offerType={offerType} setOfferType={setOfferType} offerFields={offerFields} setOfferFields={setOfferFields}
        onCreateOffer={onCreateOffer} onRevokeOffer={onRevokeOffer} onSupplierRevokeSDA={onSupplierRevokeSDA}
        evidenceRequests={evidenceRequests} respondingToReq={respondingToReq} setRespondingToReq={setRespondingToReq}
        evidenceFileName={evidenceFileName} setEvidenceFileName={setEvidenceFileName}
        evidenceNotes={evidenceNotes} setEvidenceNotes={setEvidenceNotes}
        onSubmitEvidence={onSubmitEvidence}
        disclosureRequests={disclosureRequests} onApproveDisclosureRequest={onApproveDisclosureRequest} onDeclineDisclosureRequest={onDeclineDisclosureRequest}
        decliningReqId={decliningReqId} setDecliningReqId={setDecliningReqId}
        declineReason={declineReason} setDeclineReason={setDeclineReason}
        onAddAttestation={onAddAttestation} onRevokeAttestation={onRevokeAttestation}
        cascadeRequests={cascadeRequests} onAcceptCascade={onAcceptCascade} onDeclineCascade={onDeclineCascade}
      />}

      {/* ═══ 4-tab bar (buyer non-org, non-program/system nodes) ═══ */}
      {!isSupplier && !['customer','program','system'].includes(node.type) && <div style={{ display: 'flex', gap: 1, marginBottom: 0, background: 'var(--bg-surface)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {[['overview', 'Overview'], ['evals', 'Evals'], ['claims', 'Claims'], ['timeline', 'Timeline']].map(([k, l]) =>
          <button key={k} onClick={() => { setTab(k); setExpandedSet(new Set()); setTlSelIdx(null); }} style={{
            flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: tab === k ? 'var(--border)' : 'transparent',
            color: tab === k ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>{l}</button>
        )}
      </div>}

      {/* ═══ 2-tab bar (buyer program/system nodes) ═══ */}
      {!isSupplier && ['program','system'].includes(node.type) && <div style={{ display: 'flex', gap: 1, marginBottom: 0, background: 'var(--bg-surface)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {[['claims', 'Claims'], ['timeline', 'Timeline']].map(([k, l]) =>
          <button key={k} onClick={() => { setTab(k); setExpandedSet(new Set()); setTlSelIdx(null); }} style={{
            flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: tab === k ? 'var(--border)' : 'transparent',
            color: tab === k ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>{l}</button>
        )}
      </div>}

      {/* ═══ 2-tab bar (supplier non-org asset nodes) ═══ */}
      {isSupplier && !isSupplierOrg && <div style={{ display: 'flex', gap: 1, marginBottom: 0, background: 'var(--bg-surface)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {[['claims', 'Claims'], ['timeline', 'Timeline']].map(([k, l]) =>
          <button key={k} onClick={() => { setTab(k); setExpandedSet(new Set()); setTlSelIdx(null); }} style={{
            flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: tab === k ? 'var(--border)' : 'transparent',
            color: tab === k ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>{l}</button>
        )}
      </div>}
    </div>

    {/* ═══ SCROLLABLE BODY ═══ */}
    <div ref={claimsRef} style={{ flex: 1, overflow: 'auto', padding: '0 18px', paddingTop: (!isSupplier && !['customer'].includes(node.type)) || (isSupplier && !isSupplierOrg) ? 10 : 0 }}>

      {/* ═══ ORG NODE CONTENT ═══ */}
      <OrgNodeContent node={node} isSupplier={isSupplier} isSupplierOrg={isSupplierOrg} activityLog={activityLog} disclosureRequests={disclosureRequests} onApproveDisclosureRequest={onApproveDisclosureRequest} onDeclineDisclosureRequest={onDeclineDisclosureRequest} decliningReqId={decliningReqId} setDecliningReqId={setDecliningReqId} declineReason={declineReason} setDeclineReason={setDeclineReason} />

      {/* ═══ OVERVIEW TAB (buyer non-org, non-program/system) ═══ */}
      {!isSupplier && !['customer','program','system'].includes(node.type) && tab === 'overview' && <OverviewTab
        node={node} sdaList={sdaList} onRevokeSDA={onRevokeSDA} approvalStates={approvalStates}
        revokeConfirmSdaId={revokeConfirmSdaId} setRevokeConfirmSdaId={setRevokeConfirmSdaId}
        revokeReason={revokeReason} setRevokeReason={setRevokeReason}
        onInvite={onInvite} terminalTypes={terminalTypes} setShowInvite={setShowInvite}
        invites={invites} evidenceRequests={evidenceRequests} onSelect={onSelect}
        cascadeRequests={cascadeRequests} onCreateCascadeRequest={onCreateCascadeRequest}
      />}

      {/* ═══ EVALS TAB (buyer non-org, non-program/system) ═══ */}
      {!isSupplier && !['customer','program','system'].includes(node.type) && tab === 'evals' && <EvalsTab
        node={node} onOpenEvalModal={onOpenEvalModal} approvalStates={approvalStates}
        showApproveConfirm={showApproveConfirm} setShowApproveConfirm={setShowApproveConfirm}
        showRejectConfirm={showRejectConfirm} setShowRejectConfirm={setShowRejectConfirm}
        approvalNotes={approvalNotes} setApprovalNotes={setApprovalNotes}
        onApproveAsset={onApproveAsset} onRejectAsset={onRejectAsset}
        evidenceRequests={evidenceRequests} reviewingReqId={reviewingReqId} setReviewingReqId={setReviewingReqId}
        rejectNotes={rejectNotes} setRejectNotes={setRejectNotes} onReviewEvidence={onReviewEvidence}
      />}

      {/* ═══ CLAIMS TAB ═══ */}
      {!isSupplierOrg && tab === 'claims' && <ClaimsTab
        isSupplier={isSupplier} typeFilt={typeFilt} setTypeFilt={setTypeFilt}
        statusFilt={statusFilt} setStatusFilt={setStatusFilt} filtersActive={filtersActive}
        filtered={filtered} grouped={grouped} redactedCats={redactedCats}
        expandedSet={expandedSet} toggle={toggle} setEvidenceAtt={setEvidenceAtt} raw={raw}
      />}

      {/* ═══ TIMELINE TAB ═══ */}
      {!isSupplierOrg && tab === 'timeline' && <TimelineTab
        raw={raw} tlSelIdx={tlSelIdx} setTlSelIdx={setTlSelIdx}
        tlSelected={tlSelected} setEvidenceAtt={setEvidenceAtt}
      />}

      {/* ── Inputs for supplier / org nodes (outside tab gating) ── */}
      {(isSupplier || node.type === 'customer') && node.children?.length > 0 && <div style={{ marginTop: 14, marginBottom: 14 }}>
        <div style={SH}>INPUTS ({node.children.length})</div>
        {node.children.map(c => <div key={c.id}
          onClick={() => { if (onSelect) onSelect(c); }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          style={{ fontSize: 11, padding: '4px 6px', marginBottom: 1, color: TT[c.type]?.text || 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, cursor: onSelect ? 'pointer' : 'default', borderRadius: 4, transition: 'background .1s' }}>
          <NodeIcon type={c.type} size={11} />{c.name}
        </div>)}
      </div>}

      {/* Bottom padding */}
      <div style={{ height: 60 }} />

    </div>

    {/* ═══ FOOTER (fixed) ═══ */}
    <div style={{ flexShrink: 0, padding: '14px 18px 14px' }}>
      {/* Create System button (only for program-tier nodes) */}
      {isProgramNode && onOpenSystemModal && <div style={{ height: 40, marginBottom: 12 }}>
        <button onClick={() => onOpenSystemModal(node)}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 33%, transparent)'; e.currentTarget.style.background = 'transparent'; }}
          style={{ width: '100%', height: 40, padding: 0, background: 'transparent', border: '1px solid color-mix(in srgb, var(--accent-indigo) 33%, transparent)', borderRadius: 5, color: 'var(--accent-indigo)', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>+ {systemTierLabel}</button>
      </div>}
      {/* View Chain button (hidden in supplier context) */}
      {!isSupplier && onViewChain && (node.type !== 'customer' || node.disclosureSummary) && (chainRootId && node.id === chainRootId
        ? <button disabled style={{ width: '100%', height: 40, padding: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'default', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Current Chain View</button>
        : <button onClick={() => onViewChain(node)}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
          style={{ width: '100%', height: 40, padding: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent-indigo)', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>View Chain →</button>)}
      {/* Create Disclosure button (supplier role) */}
      {onOpenSDAModal && node.type !== 'customer' && <button onClick={() => onOpenSDAModal(node)}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-amber)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-amber-bg) 9%, transparent)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-amber) 33%, transparent)'; e.currentTarget.style.background = 'transparent'; }}
        style={{ width: '100%', height: 36, padding: 0, marginTop: 8, background: 'transparent', border: '1px solid color-mix(in srgb, var(--accent-amber) 33%, transparent)', borderRadius: 6, color: 'var(--accent-amber)', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontSize: 12 }}>⇗</span> Create Disclosure</button>}
    </div>

  </div>;
}
