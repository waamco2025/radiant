import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/* ═══ PRNG ═══ */
function mulberry32(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function strToSeed(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; return Math.abs(h); }
function mkHex(rand) { const c = '0123456789abcdef'; return Array.from({ length: 8 }, () => c[Math.floor(rand() * 16)]).join(''); }

/* ═══ SDA field categories (8, matching SDACreationModal FIELD_GROUPS order) ═══ */
const SDA_FIELD_KEYS = ['shipment_details','part_identification','material_specs','processing_specs','test_results','certifications','pricing','supplier_identity'];
const SDA_FIELD_LABELS = { shipment_details:'Shipment Details', part_identification:'Part Identification', material_specs:'Material Specifications', processing_specs:'Finishing & Coating', test_results:'Test Results & Quality', certifications:'Certifications', pricing:'Pricing & Commercial', supplier_identity:'Supplier Identity' };

/* ═══ Checklists ═══ */
const CHECKLISTS = [
  { id:'as9100',    label:'AS9100 Rev D',       desc:'Aerospace Quality Management System',          reqCount:47,  creditPer:10, icon:'✦' },
  { id:'nist80053', label:'NIST 800-53 Rev 5',  desc:'Security & Privacy Controls (federal)',        reqCount:126, creditPer:10, icon:'⬡' },
  { id:'cmmcl2',    label:'CMMC Level 2',        desc:'Cybersecurity Maturity Model Certification',  reqCount:72,  creditPer:10, icon:'◈' },
  { id:'iso13485',  label:'ISO 13485:2016',      desc:'Medical Devices Quality Management',          reqCount:38,  creditPer:10, icon:'⊕' },
];

const EVALUATOR_TYPES = [
  { id:'ai_human',   label:'Radiant AI + Human Review',     desc:'AI flags items for expert sign-off.' },
  { id:'third_party',label:'Third-Party Auditor',           desc:'Coming soon — external audit integration.', soon:true },
];

/* ═══ Requirement title banks ═══ */
const REQ_TITLES = {
  as9100:   ['Organizational Context','Interested Parties','QMS Scope','QMS Processes','Management Commitment','Customer Focus','Quality Policy','Roles and Responsibilities','Risk Management','Quality Objectives','Resources','Competence','Awareness','Communication','Documented Information','Design Planning','Design Inputs','Design Controls','Design Outputs','Design Changes','External Providers','Production Planning','Control of External Products','Production Processes','Identification and Traceability','Customer Property','Preservation','Post-Delivery Activities','Control of Changes','Nonconforming Outputs','Monitoring and Measurement','Analysis and Evaluation','Internal Audit','Management Review','Nonconformity and CA','Improvement','Special Requirements','Key Characteristics','First Article Inspection','Counterfeit Part Prevention','Configuration Management','Product Safety','On-Time Delivery','Customer Satisfaction','Supplier Performance','Tooling Management','Production Part Approval'],
  nist80053:Array.from({length:126},(_,i)=>`Control ${String(i+1).padStart(3,'0')} · NIST 800-53`),
  cmmcl2:   Array.from({length:72}, (_,i)=>`Practice ${String(i+1).padStart(2,'0')} · CMMC L2`),
  iso13485: ['QMS Scope','Customer Focus','Quality Policy','Management Review','Resource Management','Personnel Competence','Infrastructure','Work Environment','Product Realization Planning','Customer Requirements','Design Planning','Design Inputs','Design Outputs','Design Review','Design Verification','Design Validation','Design Transfer','Design Changes','Purchasing Process','Purchasing Information','Verification of Purchased Product','Production Planning','Production Controls','Cleanliness Requirements','Maintenance Requirements','Sterile Barrier Systems','Software Validation','Sterilization','Identification and Traceability','Customer Property','Preservation','Monitoring Equipment','Feedback Processes','Complaint Handling','Reporting to Authorities','Internal Audit','Process Monitoring','Product Monitoring','Nonconforming Product','Corrective Action'],
};

/* ═══ Evidence + reasoning templates ═══ */
const EVIDENCE_TMPLS = [
  h=>`AS9100-cert-2024.pdf (hash: 0x${h})`,
  h=>`audit-report-Q4-2024.pdf (hash: 0x${h})`,
  h=>`test-report-inspection.pdf (hash: 0x${h})`,
  h=>`CoC-${h}.pdf — Certificate of Conformance`,
  h=>`quality-plan-v3.pdf (hash: 0x${h})`,
  h=>`calibration-record-${h}.pdf`,
  h=>`NDT-report-${h}.pdf`,
  h=>`on-chain attestation block-0x${h}`,
];
const REASONING = {
  pass_high:   ['Full documentation provided and verified. Certification is current per registry check.','Attestation chain complete. Evidence hash matches on-chain record with high confidence.','Requirement fully satisfied. Supporting documentation validated against specification.','Provenance chain validated. No discrepancies found in cross-reference check.','Automated review confirmed compliance. Signature verified against issuing authority.'],
  pass_med:    ['Documentation present but minor gaps in traceability. Manual spot-check recommended.','Evidence partially corroborated. Secondary source not fully available for cross-reference.','Requirement likely satisfied based on available evidence. Review of supporting records recommended.','Certificate on file but approaching expiry window. Renewal verification recommended.'],
  pass_low:    ['Indirect evidence only. Primary documentation not directly linked to this requirement.','Inferred compliance based on related attestations. Direct evidence not retrieved.','Historical record supports compliance but current-period evidence is sparse.'],
  minor_issue: ['Documentation present but not fully aligned with requirement scope. Clarification needed.','Minor gap identified in process record. Evidence hash mismatch on secondary document.','Requirement partially addressed. Supplemental documentation would resolve ambiguity.','Calibration record present but interval may not meet specification.'],
  major_issue: ['Required certification not found in attestation record. Critical gap in compliance chain.','Evidence hash verification failed. Document may have been altered or is not authentic.','Requirement not addressed in available documentation. Non-compliance risk is high.','Process documentation absent. Requirement cannot be confirmed without additional disclosure.'],
  not_evidenced:['No evidence retrieved for this requirement. Data may not be in current disclosure scope.','Attestation record does not contain relevant entries for this requirement category.'],
};

/* ═══ Result generation ═══ */
const OUTCOMES = ['pass_high','pass_high','pass_high','pass_high','pass_high','pass_high','pass_med','pass_med','pass_med','pass_low','minor_issue','minor_issue','major_issue','not_evidenced'];

function generateResults(nodeId, checklist) {
  const rand = mulberry32(strToSeed(nodeId + checklist.id));
  const titles = REQ_TITLES[checklist.id] || [];
  return Array.from({ length: checklist.reqCount }, (_, i) => {
    const outcome = OUTCOMES[Math.floor(rand() * OUTCOMES.length)];
    const confidence = outcome === 'pass_high' ? 0.92 + rand() * 0.07 : outcome === 'pass_med' ? 0.65 + rand() * 0.25 : outcome === 'pass_low' ? 0.40 + rand() * 0.24 : outcome === 'minor_issue' ? 0.55 + rand() * 0.3 : 0.3 + rand() * 0.4;
    const h = mkHex(rand);
    const evidenceCited = EVIDENCE_TMPLS[Math.floor(rand() * EVIDENCE_TMPLS.length)](h);
    const bank = REASONING[outcome] || REASONING.not_evidenced;
    const reasoning = bank[Math.floor(rand() * bank.length)];
    return { id:`req-${checklist.id}-${i}`, label:`Req ${i+1}`, title:titles[i]||`Requirement ${i+1}`, outcome, confidence, evidenceCited, reasoning, sdaRedacted:false, sdaFieldCategory:null };
  });
}

function applySDAREdaction(results, node) {
  if (!node?.sda || node.sda.type !== 'selective') return results;
  const redacted = node.sda.redactedFields || [];
  if (!redacted.length) return results;
  const segSize = Math.max(1, Math.ceil(results.length / 8));
  return results.map((r, i) => {
    const fieldKey = SDA_FIELD_KEYS[Math.min(7, Math.floor(i / segSize))];
    if (redacted.includes(fieldKey)) {
      return { ...r, outcome:'not_evidenced', confidence:0.1, sdaRedacted:true, sdaFieldCategory:fieldKey, evidenceCited:'Not available — data field redacted under SDA', reasoning:`Evidence for this requirement falls under the '${SDA_FIELD_LABELS[fieldKey]}' data category, which is redacted under the current Selective Disclosure Agreement. Request expanded disclosure to evaluate this requirement.` };
    }
    return r;
  });
}

/* ═══ Evidence-aware scoring boost ═══ */
function applyEvidenceBoost(results, nodeId, evidenceRequests) {
  if (!evidenceRequests?.length) return results;
  const accepted = evidenceRequests.filter(r => r.nodeId === nodeId && (r.status === 'accepted' || r.status === 'resolved'));
  if (!accepted.length) return results;
  // Build a set of requirement IDs that have accepted evidence
  const boostedReqIds = new Set(accepted.map(r => r.reqId));
  return results.map(r => {
    if (!boostedReqIds.has(r.id)) return r;
    // Boost: upgrade outcome and confidence based on accepted evidence
    if (['not_evidenced','major_issue','minor_issue','pass_low','pass_med'].includes(r.outcome)) {
      return { ...r, outcome: 'pass_high', confidence: 0.95 + Math.random() * 0.04, evidenceBoosted: true, evidenceCited: `Supplier-provided evidence (accepted) + ${r.evidenceCited}`, reasoning: 'Requirement satisfied — supplier-provided evidence was reviewed and accepted by the buyer, supplementing automated evaluation.' };
    }
    return { ...r, evidenceBoosted: true };
  });
}

function triage(results) {
  return {
    autoApproved: results.filter(r => r.outcome === 'pass_high'),
    needsReview:  results.filter(r => ['pass_med','pass_low','minor_issue'].includes(r.outcome)),
    flagged:      results.filter(r => ['major_issue','not_evidenced'].includes(r.outcome)),
  };
}

/* ═══ Style tokens ═══ */
const SH = { fontSize:9, color:'var(--text-tertiary)', letterSpacing:'.08em', fontFamily:'monospace', fontWeight:700, textTransform:'uppercase' };
const MONO = { fontFamily:'monospace' };

/* ═══ OutcomePill ═══ */
function OutcomePill({ outcome }) {
  const cfg = { pass_high:{color:'var(--accent-green)',bg:'var(--accent-green-bg)',label:'PASS · HIGH'}, pass_med:{color:'var(--accent-lime)',bg:'var(--accent-green-bg)',label:'PASS · MED'}, pass_low:{color:'var(--accent-amber)',bg:'var(--accent-amber-bg)',label:'PASS · LOW'}, minor_issue:{color:'var(--accent-orange)',bg:'var(--accent-amber-bg)',label:'MINOR ISSUE'}, major_issue:{color:'var(--accent-red)',bg:'var(--accent-red-bg)',label:'MAJOR ISSUE'}, not_evidenced:{color:'var(--text-tertiary)',bg:'var(--bg-deep)',label:'NOT EVIDENCED'} }[outcome] || {color:'var(--text-tertiary)',bg:'var(--bg-deep)',label:outcome};
  return <span style={{ fontSize:11, ...MONO, fontWeight:700, color:cfg.color, background:cfg.bg, borderRadius:3, padding:'2px 6px', whiteSpace:'nowrap' }}>{cfg.label}</span>;
}

/* ═══ ReviewCard ═══ */
function ReviewCard({ req, decision, onDecide, onUndo, expanded, onToggle }) {
  const isFlagged = ['major_issue','not_evidenced'].includes(req.outcome);
  const decided = !!decision;
  const dd = useMemo(() => {
    if (!decision) return null;
    const { action } = decision;
    if (action === 'confirm')       return { icon:'✓', text:'Confirmed',         color:'var(--accent-green)' };
    if (action === 'override_pass') return { icon:'✓', text:'Overridden → Pass', color:'var(--accent-green)' };
    if (action === 'override_fail') return { icon:'✗', text:'Overridden → Fail', color:'var(--accent-red)' };
    if (action === 'evidence')      return { icon:'◧', text:'Evidence Requested', color:'var(--accent-indigo)' };
    return null;
  }, [decision]);

  return (
    <div style={{ border:`1px solid ${decided?'var(--accent-green-bg)':isFlagged?'var(--accent-red-bg)':'var(--accent-green-bg)'}`, borderRadius:5, marginBottom:6, overflow:'hidden', background:decided?'var(--accent-green-bg)':isFlagged?'var(--accent-red-bg)':'var(--accent-green-bg)', opacity:decided?0.78:1, transition:'opacity .2s' }}>
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', cursor:'pointer' }}>
        <OutcomePill outcome={req.outcome} />
        <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--text-bright)', ...MONO, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{req.title}</span>
        <span style={{ fontSize:9, color:'var(--text-muted)', ...MONO, flexShrink:0 }}>{(req.confidence*100).toFixed(0)}%</span>
        {req.evidenceBoosted && <span style={{ fontSize:8, color:'var(--accent-green)', ...MONO, fontWeight:700, background:'var(--accent-green-bg)', padding:'1px 4px', borderRadius:2, flexShrink:0 }}>EV</span>}
        {decided && <span style={{ fontSize:9, color:dd?.color, ...MONO, fontWeight:700, flexShrink:0 }}>{dd?.icon}</span>}
        <span style={{ fontSize:9, color:'var(--text-muted)', flexShrink:0 }}>{expanded?'▴':'▾'}</span>
      </div>
      {expanded && (
        <div style={{ padding:'0 10px 10px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:9, color:'var(--text-muted)', ...MONO, marginTop:8, marginBottom:8 }}>
            Confidence: {(req.confidence*100).toFixed(1)}% · Auto-flagged for human review
          </div>
          {/* Evidence */}
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:6, display:'flex', gap:5, alignItems:'flex-start' }}>
            <span style={{ color:'var(--text-muted)', flexShrink:0 }}>◧</span>
            <span style={{ ...MONO, fontSize:12 }}>{req.evidenceCited || 'No evidence cited'}</span>
          </div>
          {/* Reasoning */}
          <div style={{ fontSize:12, color:req.sdaRedacted?'var(--accent-amber)':'var(--text-tertiary)', fontStyle:'italic', marginBottom:10, lineHeight:1.5 }}>
            {req.sdaRedacted && <span style={{ marginRight:4, fontStyle:'normal' }}>⚠</span>}
            {req.reasoning || 'No reasoning provided'}
            {req.sdaRedacted && (
              <div style={{ fontSize:9, color:'var(--accent-amber)', marginTop:5, fontStyle:'normal', fontWeight:600 }}>
                Consider requesting expanded disclosure from the supplier.
              </div>
            )}
          </div>
          {/* Actions */}
          {decided
            ? <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:9, color:dd?.color, ...MONO, fontWeight:700 }}>{dd?.icon} {dd?.text}</span>
                <button onClick={e=>{e.stopPropagation();onUndo(req.id);}}
                  style={{ fontSize:9, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0, ...MONO }}>Undo</button>
              </div>
            : <>
                <div style={{ display:'flex', gap:5, marginBottom:5 }}>
                  <button onClick={e=>{e.stopPropagation();onDecide(req.id,'confirm');}}
                    style={{ flex:1, padding:'5px 0', fontSize:12, ...MONO, fontWeight:700, background:'var(--accent-green-bg)', border:'1px solid color-mix(in srgb, var(--accent-green) 27%, transparent)', borderRadius:4, color:'var(--accent-green)', cursor:'pointer' }}>Confirm</button>
                  <button onClick={e=>{e.stopPropagation();onDecide(req.id,'evidence');}}
                    style={{ flex:1, padding:'5px 0', fontSize:12, ...MONO, fontWeight:700, background:'var(--bg-surface)', border:'1px solid var(--border-hover)', borderRadius:4, color:'var(--text-secondary)', cursor:'pointer' }}>Request Evidence</button>
                </div>
                <div style={{ display:'flex', gap:5 }}>
                  <button onClick={e=>{e.stopPropagation();onDecide(req.id,'override_pass');}}
                    style={{ flex:1, padding:'5px 0', fontSize:12, ...MONO, fontWeight:700, background:'transparent', border:'1px solid color-mix(in srgb, var(--accent-green) 27%, transparent)', borderRadius:4, color:'var(--accent-green)', cursor:'pointer' }}>Override → Pass</button>
                  <button onClick={e=>{e.stopPropagation();onDecide(req.id,'override_fail');}}
                    style={{ flex:1, padding:'5px 0', fontSize:12, ...MONO, fontWeight:700, background:'transparent', border:'1px solid color-mix(in srgb, var(--accent-red) 27%, transparent)', borderRadius:4, color:'var(--accent-red)', cursor:'pointer' }}>Override → Fail</button>
                </div>
              </>
          }
        </div>
      )}
    </div>
  );
}

/* ═══ Main modal ═══ */
export default function EvaluationModal({ isOpen, node, onClose, onComplete, credits, appMode, evidenceRequests, presetChecklistId }) {
  const [phase, setPhase] = useState('setup');
  const [selectedChecklist, setSelectedChecklist] = useState('as9100');
  const [evaluatorType, setEvaluatorType] = useState('ai_human');
  const [results, setResults] = useState([]);
  const [logLines, setLogLines] = useState([]);
  const [logDone, setLogDone] = useState(false);
  const [reviewDecisions, setReviewDecisions] = useState(new Map());   // Map<id, {action}>
  const [autoApprovedExpanded, setAutoApprovedExpanded] = useState(false);
  const [expandedSet, setExpandedSet] = useState(new Set());            // review card expanded state
  const [reviewScrolled, setReviewScrolled] = useState(false);
  const [toast, setToast] = useState(null);
  const logRef = useRef(null);
  const reviewListRef = useRef(null);
  const toastTimer = useRef(null);

  /* Reset on open/node change */
  useEffect(() => {
    if (isOpen) {
      setPhase('setup'); setSelectedChecklist(presetChecklistId || 'as9100'); setEvaluatorType('ai_human');
      setResults([]); setLogLines([]); setLogDone(false);
      setReviewDecisions(new Map()); setAutoApprovedExpanded(false);
      setExpandedSet(new Set()); setReviewScrolled(false);
    }
  }, [isOpen, node?.id]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const checklist = CHECKLISTS.find(c => c.id === selectedChecklist) || CHECKLISTS[0];
  const totalCost = checklist.reqCount * checklist.creditPer;
  const canAfford = credits >= totalCost;
  const isDerivative = node?.sda?.type === 'derivative';
  const canRun = canAfford && !isDerivative;

  /* ── Running phase ── */
  const runEval = useCallback(() => {
    setPhase('running');
    const cl = CHECKLISTS.find(c => c.id === selectedChecklist) || CHECKLISTS[0];
    const res = applyEvidenceBoost(applySDAREdaction(generateResults(node?.id || 'unknown', cl), node), node?.id, evidenceRequests);
    const lines = [
      `Initializing evaluation engine...`,
      `Loading ${cl.label} requirements (${cl.reqCount} items)`,
      `Fetching attestation records for ${node?.name || 'node'}...`,
      `Running provenance chain validation...`,
      `Cross-referencing evidence hashes...`,
      `Evaluating certification status...`,
      `Applying compliance rules...`,
      `Generating confidence scores...`,
      `Triage complete.`,
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) { setLogLines(prev => [...prev, lines[i]]); i++; }
      else { clearInterval(interval); setLogDone(true); setResults(res); setTimeout(() => setPhase('results'), 800); }
    }, 400);
    return () => clearInterval(interval);
  }, [node, selectedChecklist]);

  /* Auto-scroll log */
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logLines]);

  /* ── Triage (memoised on results) ── */
  const { autoApproved, needsReview, flagged } = useMemo(() => triage(results), [results]);
  const reviewItems = useMemo(() => [...needsReview, ...flagged], [needsReview, flagged]);

  /* Reactive counts based on decisions */
  const decidedCount = useMemo(() => reviewItems.filter(r => reviewDecisions.has(r.id)).length, [reviewItems, reviewDecisions]);
  const pendingNeedsReview = useMemo(() => needsReview.filter(r => !reviewDecisions.has(r.id)).length, [needsReview, reviewDecisions]);
  const pendingFlagged     = useMemo(() => flagged.filter(r => !reviewDecisions.has(r.id)).length, [flagged, reviewDecisions]);
  const needsHumanReview   = evaluatorType === 'ai_human';
  const allReviewed        = !needsHumanReview || reviewItems.length === 0 || decidedCount === reviewItems.length;

  /* Decision breakdown for adaptive finalize button */
  const decisionBreakdown = useMemo(() => {
    let passed = autoApproved.length, failed = 0, evidenceReqs = 0;
    reviewItems.forEach(r => {
      const d = reviewDecisions.get(r.id);
      if (!d) return;
      if (d.action === 'confirm' || d.action === 'override_pass') passed++;
      else if (d.action === 'override_fail') failed++;
      else if (d.action === 'evidence') evidenceReqs++;
    });
    return { passed, failed, evidenceReqs };
  }, [autoApproved, reviewItems, reviewDecisions, decidedCount]);

  /* Decision handlers */
  const handleDecide = useCallback((reqId, action) => {
    setReviewDecisions(prev => new Map(prev).set(reqId, { action }));
  }, []);
  const handleUndo = useCallback((reqId) => {
    setReviewDecisions(prev => { const m = new Map(prev); m.delete(reqId); return m; });
  }, []);
  const handleToggleCard = useCallback((reqId) => {
    setExpandedSet(prev => { const s = new Set(prev); s.has(reqId) ? s.delete(reqId) : s.add(reqId); return s; });
  }, []);
  const handleExpandAll  = useCallback(() => setExpandedSet(new Set(reviewItems.map(r => r.id))), [reviewItems]);
  const handleCollapseAll = useCallback(() => setExpandedSet(new Set()), []);
  const handleApproveAll = useCallback(() => {
    let count = 0;
    setReviewDecisions(prev => {
      const m = new Map(prev);
      reviewItems.forEach(r => {
        if (!m.has(r.id)) {
          const action = ['pass_med','pass_low'].includes(r.outcome) ? 'confirm' : 'override_pass';
          m.set(r.id, { action });
          count++;
        }
      });
      return m;
    });
    if (count > 0) showToast(`${count} item${count > 1 ? 's' : ''} approved`);
  }, [reviewItems, showToast]);

  /* ── Finalize ── */
  const handleFinalize = useCallback(() => {
    // Compute post-decision counts
    let finalPass = autoApproved.length;
    let finalFail = 0;
    let finalEvidence = 0;
    reviewItems.forEach(r => {
      const decision = reviewDecisions.get(r.id);
      if (!decision) return;
      if (decision.action === 'confirm' || decision.action === 'override_pass') {
        finalPass++;
      } else if (decision.action === 'override_fail') {
        finalFail++;
      } else if (decision.action === 'evidence') {
        finalEvidence++;
      }
    });

    // Extract evidence requests for App.jsx
    const evidenceReqs = reviewItems
      .filter(r => reviewDecisions.get(r.id)?.action === 'evidence')
      .map(r => ({
        reqId: r.id,
        title: r.title,
        outcome: r.outcome,
        reasoning: r.reasoning,
        sdaFieldCategory: r.sdaFieldCategory || null,
      }));

    const summary = {
      checklistId: selectedChecklist,
      checklistLabel: checklist.label,
      autoApproved: autoApproved.length,
      needsReview: needsReview.length,
      flagged: flagged.length,
      total: results.length,
      cost: totalCost,
      evaluatorType,
      finalPass,
      finalFail,
      finalEvidence,
      evidenceRequested: evidenceReqs,
    };
    if (onComplete) onComplete(node, summary);
    setPhase('complete');
  }, [selectedChecklist, checklist, autoApproved, needsReview, flagged,
      results, totalCost, evaluatorType, node, onComplete,
      reviewItems, reviewDecisions]);

  if (!isOpen || !node) return null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)', zIndex:80, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:560, maxHeight:'88vh', background:'var(--bg-app-header)', border:'1px solid var(--border)', borderRadius:8, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.8)', position:'relative' }}>

        {/* ── Header ── */}
        <div style={{ padding:'16px 20px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-bright)', ...MONO, letterSpacing:'.04em' }}>
              {phase==='setup'?(presetChecklistId?'Re-evaluate':'Run Evaluation'):phase==='running'?`Evaluating ${checklist.label}…`:phase==='results'?`${checklist.label} — Results`:'Evaluation Complete'}
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{node.name} · {(node.type||'node').replace(/_/g,' ')}</div>
          </div>
          {phase !== 'running' && phase !== 'complete' && (
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>✕</button>
          )}
        </div>

        {/* ── Body — phase-conditional layout ── */}
        <div style={phase==='results'
          ? { flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }
          : { flex:1, overflow:'auto', padding:'18px 20px' }
        }>

          {/* ════ SETUP ════ */}
          {phase === 'setup' && <>
            {/* Target node summary */}
            <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:6, padding:'10px 14px', marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--accent-indigo)', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)' }}>{node.name}</div>
                <div style={{ fontSize:9, color:'var(--text-tertiary)', ...MONO }}>{node.id} · {node.location||'Unknown location'}</div>
              </div>
            </div>

            {/* Derivative SDA block */}
            {isDerivative && (
              <div style={{ marginBottom:18, background:'var(--accent-red-bg)', border:'1px solid color-mix(in srgb, var(--accent-red) 33%, transparent)', borderLeft:'3px solid var(--accent-red)', borderRadius:5, padding:'12px 14px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--accent-red)', ...MONO, marginBottom:6 }}>⚠ Derivative Disclosure</div>
                <div style={{ fontSize:11, color:'var(--text-primary)', lineHeight:1.5, marginBottom:10 }}>
                  This asset was disclosed as an evaluation result (POE), not as raw evidence. A new evaluation requires requesting Full or Selective disclosure from the supplier.
                </div>
                <button onClick={()=>showToast('Request sent to supplier')}
                  style={{ padding:'6px 14px', background:'transparent', border:'1px solid color-mix(in srgb, var(--accent-amber) 33%, transparent)', borderRadius:4, color:'var(--accent-amber)', cursor:'pointer', fontSize:10, ...MONO }}>
                  Request Expanded Disclosure
                </button>
              </div>
            )}

            {/* Evidence boost banner */}
            {(() => {
              const accepted = (evidenceRequests || []).filter(r => r.nodeId === node?.id && (r.status === 'accepted' || r.status === 'resolved'));
              if (!accepted.length) return null;
              return <div style={{ marginBottom:18, background:'var(--accent-green-bg)', border:'1px solid color-mix(in srgb, var(--accent-green) 27%, transparent)', borderLeft:'3px solid var(--accent-green)', borderRadius:5, padding:'10px 14px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-green)', ...MONO, marginBottom:4 }}>EVIDENCE AVAILABLE</div>
                <div style={{ fontSize:11, color:'var(--text-primary)', lineHeight:1.5 }}>
                  {accepted.length} accepted evidence submission{accepted.length !== 1 ? 's' : ''} will boost scoring for matched requirements.
                </div>
              </div>;
            })()}

            {/* Re-evaluation context banner (when preset checklist) */}
            {presetChecklistId && (() => {
              const presetCl = CHECKLISTS.find(c => c.id === presetChecklistId);
              const evCount = (evidenceRequests || []).filter(r => r.nodeId === node?.id && (r.status === 'accepted' || r.status === 'resolved')).length;
              if (!presetCl) return null;
              return <div style={{ marginBottom:18, background:'var(--accent-indigo-bg)', border:'1px solid color-mix(in srgb, var(--accent-indigo) 27%, transparent)', borderLeft:'3px solid var(--accent-indigo)', borderRadius:5, padding:'10px 14px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-indigo-light)', ...MONO, marginBottom:4 }}>RE-EVALUATION</div>
                <div style={{ fontSize:11, color:'var(--text-primary)', lineHeight:1.5 }}>
                  Re-evaluating <strong style={{ color:'var(--accent-indigo-text)' }}>{presetCl.label}</strong> — {evCount} evidence submission{evCount !== 1 ? 's' : ''} will be applied.
                </div>
              </div>;
            })()}

            {/* Checklist selector */}
            <div style={{ marginBottom:18 }}>
              <div style={{ ...SH, marginBottom:8 }}>{presetChecklistId ? 'Checklist (locked)' : 'Select Checklist'}</div>
              {presetChecklistId ? (
                /* Locked card for re-evaluation */
                (() => { const cl = CHECKLISTS.find(c => c.id === selectedChecklist); if (!cl) return null; return (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg-surface)', border:'1px solid var(--accent-indigo)', borderRadius:6, opacity:0.85 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--accent-indigo-text)' }}>{cl.label}</div>
                      <div style={{ fontSize:9, color:'var(--text-muted)' }}>{cl.desc}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:9, color:'var(--accent-indigo)', ...MONO }}>{cl.reqCount} req · ◇ {cl.reqCount*cl.creditPer}</div>
                    </div>
                    <span style={{ fontSize:8, color:'var(--text-muted)', ...MONO }}>LOCKED</span>
                  </div>
                ); })()
              ) : (
                /* Dropdown for normal flow */
                <div style={{ position:'relative' }}>
                  <select value={selectedChecklist} onChange={e=>setSelectedChecklist(e.target.value)}
                    style={{ width:'100%', padding:'10px 12px', paddingRight:36, fontSize:12, fontFamily:'var(--font-mono)', fontWeight:600, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', cursor:'pointer', appearance:'none', WebkitAppearance:'none', outline:'none' }}>
                    {CHECKLISTS.map(cl => <option key={cl.id} value={cl.id}>{cl.icon} {cl.label} — {cl.reqCount} req · ◇ {cl.reqCount*cl.creditPer} credits</option>)}
                  </select>
                  <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', fontSize:10, color:'var(--text-muted)' }}>▾</span>
                  {/* Selected checklist detail */}
                  <div style={{ marginTop:8, padding:'8px 12px', background:'color-mix(in srgb, var(--accent-indigo) 6%, transparent)', border:'1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)', borderRadius:5 }}>
                    <div style={{ fontSize:10, color:'var(--text-secondary)', marginBottom:2 }}>{checklist.desc}</div>
                    <div style={{ display:'flex', gap:12, fontSize:9, color:'var(--text-muted)', ...MONO }}>
                      <span>{checklist.reqCount} requirements</span>
                      <span>◇ {checklist.reqCount * checklist.creditPer} credits</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Evidence trail (re-evaluation mode) */}
            {presetChecklistId && (() => {
              const trail = (evidenceRequests || []).filter(r => r.nodeId === node?.id && (r.status === 'accepted' || r.status === 'resolved'));
              if (!trail.length) return null;
              return <div style={{ marginBottom:18 }}>
                <div style={{ ...SH, marginBottom:8 }}>EVIDENCE TRAIL ({trail.length})</div>
                <div style={{ background:'var(--bg-deep)', border:'1px solid var(--border)', borderRadius:5, maxHeight:160, overflow:'auto' }}>
                  {trail.map((r, i) => {
                    const isResolved = r.status === 'resolved';
                    return <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderBottom: i < trail.length - 1 ? '1px solid var(--bg-surface)' : 'none', opacity: isResolved ? 0.6 : 1 }}>
                      <span style={{ fontSize:9, color: isResolved ? 'var(--text-tertiary)' : 'var(--accent-green)', flexShrink:0 }}>📎</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:10, color:'var(--text-primary)', ...MONO, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.response?.fileName || 'Evidence file'}</div>
                        <div style={{ fontSize:8, color:'var(--text-muted)', ...MONO }}>{r.title}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:8, color: isResolved ? 'var(--text-tertiary)' : 'var(--accent-green)', ...MONO, fontWeight:700 }}>{isResolved ? 'USED' : 'ACCEPTED'}</div>
                        <div style={{ fontSize:8, color:'var(--border-hover)', ...MONO }}>{r.response?.submittedAt ? new Date(r.response.submittedAt).toLocaleDateString() : ''}</div>
                      </div>
                    </div>;
                  })}
                </div>
              </div>;
            })()}

            {/* Evaluator type */}
            <div style={{ marginBottom:18 }}>
              <div style={{ ...SH, marginBottom:8 }}>Evaluator</div>
              {EVALUATOR_TYPES.map(ev => {
                const sel = evaluatorType === ev.id && !ev.soon;
                return (
                  <div key={ev.id} onClick={()=>{ if (!ev.soon) setEvaluatorType(ev.id); }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', marginBottom:6, background:sel?'var(--bg-surface)':'transparent', border:`1px solid ${sel?'var(--accent-indigo)':'var(--border)'}`, borderRadius:6, cursor:ev.soon?'default':'pointer', opacity:ev.soon?0.45:1 }}>
                    <div style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${sel?'var(--accent-indigo)':'var(--border-hover)'}`, background:sel?'var(--accent-indigo)':'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {sel && <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--text-bright)' }} />}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:sel?'var(--accent-indigo-text)':'var(--text-secondary)' }}>{ev.label}</div>
                      <div style={{ fontSize:9, color:'var(--text-muted)' }}>{ev.desc}</div>
                    </div>
                    {ev.soon && <span style={{ fontSize:8, color:'var(--text-muted)', ...MONO }}>COMING SOON</span>}
                  </div>
                );
              })}
            </div>

            {/* Scope summary */}
            <div style={{ background:'var(--bg-deep)', border:`1px solid ${isDerivative?'color-mix(in srgb, var(--accent-red) 33%, transparent)':'var(--border)'}`, borderRadius:5, padding:'10px 14px' }}>
              <div style={{ ...SH, marginBottom:10 }}>Evaluation Scope</div>
              {/* Cost formula */}
              <div style={{ fontSize:11, ...MONO, marginBottom:12 }}>
                <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{checklist.reqCount}</span>
                <span style={{ color:'var(--text-muted)' }}> requirements × </span>
                <span style={{ color:'var(--text-primary)', fontWeight:600 }}>10</span>
                <span style={{ color:'var(--text-muted)' }}> credits = </span>
                <span style={{ color:'var(--accent-indigo)', fontWeight:700 }}>◇ {totalCost} credits</span>
              </div>
              {/* Balance + remaining */}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:10 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12, color:'var(--text-primary)', ...MONO, fontWeight:600 }}>Your balance: ◇ {credits}</span>
                  <button onClick={()=>showToast('Credit purchase coming soon')}
                    style={{ fontSize:9, color:'var(--accent-indigo)', background:'none', border:'none', cursor:'pointer', ...MONO, textDecoration:'underline', padding:0 }}>Add Credits</button>
                </div>
                {canAfford
                  ? <div style={{ fontSize:11, color:'var(--accent-green)', ...MONO }}>Remaining after evaluation: ◇ {credits - totalCost}</div>
                  : <div style={{ fontSize:11, color:'var(--accent-red)', ...MONO }}>⚠ Insufficient credits — need ◇ {totalCost - credits} more</div>
                }
              </div>
            </div>
          </>}

          {/* ════ RUNNING ════ */}
          {phase === 'running' && <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
              {!logDone
                ? <div style={{ width:16, height:16, border:'2px solid var(--accent-indigo)', borderTop:'2px solid transparent', borderRadius:'50%', animation:'pspin 1s linear infinite', flexShrink:0 }} />
                : <div style={{ width:16, height:16, borderRadius:'50%', background:'var(--accent-green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'var(--text-bright)', flexShrink:0 }}>✓</div>
              }
              <span style={{ fontSize:11, color:'var(--text-primary)', ...MONO }}>{logDone?'Analysis complete':'Running evaluation…'}</span>
            </div>
            <div ref={logRef} style={{ background:'var(--bg-deep)', border:'1px solid var(--border)', borderRadius:5, padding:'10px 14px', ...MONO, fontSize:9, color:'var(--text-muted)', lineHeight:1.8, maxHeight:220, overflow:'auto' }}>
              {logLines.map((l,i) => (
                <div key={i} style={{ color:i===logLines.length-1&&!logDone?'var(--accent-indigo)':'var(--text-muted)' }}>{'>'} {l}</div>
              ))}
              {!logDone && <div style={{ display:'inline-block', width:6, height:10, background:'var(--accent-indigo)', verticalAlign:'middle' }} />}
            </div>
          </>}

          {/* ════ RESULTS ════ */}
          {phase === 'results' && <>

            {/* ─ Sticky top section ─ */}
            <div style={{ flexShrink:0, padding:'16px 20px 0' }}>
              {/* Summary bar — reactive counts */}
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                {[
                  { label:'Auto-Approved', count:autoApproved.length,  color:'var(--accent-green)', bg:'var(--accent-green-bg)' },
                  { label:'Needs Review',  count:pendingNeedsReview,    color:'var(--accent-amber)', bg:'var(--accent-amber-bg)' },
                  { label:'Flagged',       count:pendingFlagged,         color:'var(--accent-red)', bg:'var(--accent-red-bg)' },
                ].map(s => (
                  <div key={s.label} style={{ flex:1, background:s.bg, border:`1px solid color-mix(in srgb, ${s.color} 13%, transparent)`, borderRadius:6, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:s.color, ...MONO }}>{s.count}</div>
                    <div style={{ fontSize:9, color:s.color, opacity:.7, ...MONO }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Review progress */}
              {reviewItems.length > 0 && needsHumanReview && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <div style={{ ...SH }}>Human Review Progress</div>
                    <div style={{ fontSize:9, color:'var(--text-tertiary)', ...MONO }}>{decidedCount} / {reviewItems.length}</div>
                  </div>
                  <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${reviewItems.length?(decidedCount/reviewItems.length)*100:0}%`, background:'var(--accent-indigo)', borderRadius:2, transition:'width .3s' }} />
                  </div>
                </div>
              )}

              {/* Auto-approved collapsible */}
              {autoApproved.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div onClick={()=>setAutoApprovedExpanded(x=>!x)}
                    onMouseEnter={e=>{e.currentTarget.style.background='var(--accent-green-bg)';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='var(--accent-green-bg)';}}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 10px', background:'var(--accent-green-bg)', border:'1px solid color-mix(in srgb, var(--accent-green) 13%, transparent)', borderRadius:autoApprovedExpanded?'5px 5px 0 0':5, cursor:'pointer', transition:'background .15s' }}>
                    <span style={{ fontSize:9, color:'var(--accent-green)', ...MONO, fontWeight:700 }}>✓ AUTO-APPROVED ({autoApproved.length})</span>
                    <span style={{ flex:1 }} />
                    <span style={{ fontSize:10, color:'color-mix(in srgb, var(--accent-green) 53%, transparent)' }}>{autoApprovedExpanded?'▾':'▸'}</span>
                  </div>
                  {autoApprovedExpanded && (
                    <div style={{ border:'1px solid color-mix(in srgb, var(--accent-green) 13%, transparent)', borderTop:'none', borderRadius:'0 0 5px 5px', maxHeight:200, overflow:'auto' }}>
                      {autoApproved.map(r => {
                        const pct = Math.round(r.confidence * 100);
                        const badgeColor = pct > 90 ? 'var(--accent-green)' : 'var(--accent-amber)';
                        const badgeBg    = pct > 90 ? 'var(--accent-green-bg)' : 'var(--accent-amber-bg)';
                        return (
                          <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderBottom:'1px solid var(--accent-green-bg)' }}>
                            <span style={{ fontSize:8, color:'var(--accent-green)', flexShrink:0 }}>✓</span>
                            <span style={{ fontSize:10, color:'var(--text-secondary)', ...MONO, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
                            <span style={{ fontSize:9, fontWeight:700, color:badgeColor, background:badgeBg, borderRadius:3, padding:'1px 5px', ...MONO, flexShrink:0 }}>{pct}%</span>
                            <span style={{ fontSize:8, color:'color-mix(in srgb, var(--accent-green) 40%, transparent)', ...MONO, flexShrink:0 }}>Auto-Approved</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─ Scrollable review list ─ */}
            <div ref={reviewListRef}
              onScroll={e=>setReviewScrolled(e.currentTarget.scrollTop>4)}
              style={{ flex:1, overflow:'auto', padding:'0 20px 16px', position:'relative' }}>
              {/* Scroll shadow */}
              <div style={{ position:'sticky', top:0, height:6, background:'linear-gradient(to bottom, var(--bg-app-header), transparent)', pointerEvents:'none', opacity:reviewScrolled?1:0, transition:'opacity .2s', zIndex:1 }} />

              {reviewItems.length > 0 && (
                <>
                  {/* Expand all / Collapse all + section label */}
                  <div style={{ display:'flex', alignItems:'center', marginBottom:8, marginTop:4 }}>
                    <div style={{ ...SH, flex:1 }}>
                      {needsHumanReview?'Requires Human Review':'Review Items'} ({reviewItems.length})
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <button onClick={handleExpandAll}  style={{ fontSize:9, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', ...MONO, letterSpacing:'.05em', textTransform:'uppercase', padding:0 }} onMouseEnter={e=>{e.currentTarget.style.color='var(--accent-indigo)';}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';}}>Expand All</button>
                      <span style={{ fontSize:9, color:'var(--border-hover)' }}>·</span>
                      <button onClick={handleCollapseAll} style={{ fontSize:9, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', ...MONO, letterSpacing:'.05em', textTransform:'uppercase', padding:0 }} onMouseEnter={e=>{e.currentTarget.style.color='var(--accent-indigo)';}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';}}>Collapse All</button>
                      <span style={{ fontSize:9, color:'var(--border-hover)' }}>·</span>
                      <button onClick={handleApproveAll} disabled={allReviewed} style={{ fontSize:9, color:allReviewed?'var(--border-hover)':'var(--accent-green)', background:'none', border:'none', cursor:allReviewed?'default':'pointer', ...MONO, letterSpacing:'.05em', textTransform:'uppercase', padding:0, opacity:allReviewed?.4:1 }} onMouseEnter={e=>{if(!allReviewed)e.currentTarget.style.color='var(--accent-green)';}} onMouseLeave={e=>{if(!allReviewed)e.currentTarget.style.color='var(--accent-green)';}}>Approve All</button>
                    </div>
                  </div>
                  {reviewItems.map(r => (
                    <ReviewCard
                      key={r.id}
                      req={r}
                      decision={reviewDecisions.get(r.id)||null}
                      onDecide={handleDecide}
                      onUndo={handleUndo}
                      expanded={expandedSet.has(r.id)}
                      onToggle={()=>handleToggleCard(r.id)}
                    />
                  ))}
                </>
              )}

              {reviewItems.length === 0 && (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)', fontSize:10, ...MONO }}>
                  All requirements auto-approved at high confidence.
                </div>
              )}
            </div>
          </>}

          {/* ════ COMPLETE ════ */}
          {phase === 'complete' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 0', gap:16 }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--accent-green-bg)', border:'2px solid var(--accent-green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, animation:'pfade .4s ease' }}>✓</div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--accent-green)', ...MONO, letterSpacing:'.04em' }}>Proof of Evaluation Issued</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>{checklist.label} · {results.length} requirements evaluated</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>Credential anchored to supply chain record</div>
              </div>
              <div style={{ display:'flex', gap:20 }}>
                {[
                  { label:'Auto-Approved', count:autoApproved.length, color:'var(--accent-green)' },
                  { label:'Reviewed',      count:needsReview.length,  color:'var(--accent-lime)' },
                  { label:'Flagged',       count:flagged.length,      color:'var(--accent-red)' },
                ].map(s=>(
                  <div key={s.label} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:700, color:s.color, ...MONO }}>{s.count}</div>
                    <div style={{ fontSize:8, color:'var(--text-muted)', ...MONO }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {phase === 'setup' && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div style={{ flex:1, fontSize:9, color:canAfford&&!isDerivative?'var(--text-muted)':'var(--accent-red)', ...MONO }}>
              {isDerivative?'Derivative disclosure — evaluation blocked':canAfford?`◇ ${totalCost} credits will be deducted`:`Insufficient credits (need ◇ ${totalCost})`}
            </div>
            <button onClick={onClose} style={{ padding:'7px 14px', background:'transparent', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-tertiary)', cursor:'pointer', fontSize:11, ...MONO }}>Cancel</button>
            <button onClick={runEval} disabled={!canRun}
              style={{ padding:'7px 16px', background:canRun?'var(--accent-indigo-bg)':'var(--bg-surface)', border:`1px solid ${canRun?'var(--accent-indigo)':'var(--border)'}`, borderRadius:5, color:canRun?'var(--accent-indigo-light)':'var(--text-muted)', cursor:canRun?'pointer':'default', fontSize:11, ...MONO, fontWeight:700, pointerEvents:canRun?'auto':'none', opacity:canRun?1:.5 }}
              onMouseEnter={e=>{ if(canRun){e.currentTarget.style.background='var(--accent-indigo-bg)';e.currentTarget.style.borderColor='var(--accent-indigo-light)';}}}
              onMouseLeave={e=>{ if(canRun){e.currentTarget.style.background='var(--accent-indigo-bg)';e.currentTarget.style.borderColor='var(--accent-indigo)';}}}>
              {presetChecklistId ? 'Re-evaluate →' : 'Run Evaluation →'}
            </button>
          </div>
        )}

        {phase === 'results' && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div style={{ flex:1 }}>
              {needsHumanReview && !allReviewed
                ? <span style={{ fontSize:11, color:'var(--text-muted)', ...MONO }}>{reviewItems.length-decidedCount} items awaiting review</span>
                : <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                    {decisionBreakdown.passed > 0 && <span style={{ fontSize:10, color:'var(--accent-green)', ...MONO, fontWeight:600 }}>&#10003; {decisionBreakdown.passed} passed</span>}
                    {decisionBreakdown.evidenceReqs > 0 && <span style={{ fontSize:10, color:'var(--text-secondary)', ...MONO, fontWeight:600 }}>&#9645; {decisionBreakdown.evidenceReqs} evidence requested</span>}
                    {decisionBreakdown.failed > 0 && <span style={{ fontSize:10, color:'var(--accent-red)', ...MONO, fontWeight:600 }}>&#10007; {decisionBreakdown.failed} failed</span>}
                  </div>
              }
            </div>
            <button onClick={onClose} style={{ padding:'7px 14px', background:'transparent', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-tertiary)', cursor:'pointer', fontSize:11, ...MONO }}>Dismiss</button>
            {(() => {
              const hasEvidence = decisionBreakdown.evidenceReqs > 0;
              const hasFail = decisionBreakdown.failed > 0;

              // 1. Evidence DOMINATES — if ANY evidence requested, grey button
              if (hasEvidence) {
                return <button onClick={allReviewed ? handleFinalize : undefined}
                  style={{ padding:'7px 16px',
                    background: allReviewed ? 'var(--bg-surface)' : 'var(--bg-surface)',
                    border: `1px solid ${allReviewed ? 'var(--text-tertiary)' : 'var(--border)'}`,
                    borderRadius:5,
                    color: allReviewed ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: allReviewed ? 'pointer' : 'default',
                    fontSize:11, ...MONO, fontWeight:700,
                    opacity: allReviewed ? 1 : .45,
                    pointerEvents: allReviewed ? 'auto' : 'none',
                    transition:'opacity .2s' }}
                  onMouseEnter={e => { if (allReviewed) e.currentTarget.style.background = 'var(--border-hover)'; }}
                  onMouseLeave={e => { if (allReviewed) e.currentTarget.style.background = 'var(--bg-surface)'; }}>
                  Request Evidence ({decisionBreakdown.evidenceReqs}) &amp; Finalize →
                </button>;
              }

              // 2. Failures only (no evidence requests) — red button
              if (hasFail) {
                return <button onClick={allReviewed ? handleFinalize : undefined}
                  style={{ padding:'7px 16px',
                    background: allReviewed ? 'var(--accent-red-bg)' : 'var(--bg-surface)',
                    border: `1px solid ${allReviewed ? 'var(--accent-red)' : 'var(--border)'}`,
                    borderRadius:5,
                    color: allReviewed ? 'var(--accent-red)' : 'var(--text-muted)',
                    cursor: allReviewed ? 'pointer' : 'default',
                    fontSize:11, ...MONO, fontWeight:700,
                    opacity: allReviewed ? 1 : .45,
                    pointerEvents: allReviewed ? 'auto' : 'none',
                    transition:'opacity .2s' }}
                  onMouseEnter={e => { if (allReviewed) e.currentTarget.style.background = 'var(--accent-red-bg)'; }}
                  onMouseLeave={e => { if (allReviewed) e.currentTarget.style.background = 'var(--accent-red-bg)'; }}>
                  Fail &amp; Issue Credential →
                </button>;
              }

              // 3. All passed — green button (default)
              return <button onClick={allReviewed ? handleFinalize : undefined}
                style={{ padding:'7px 16px',
                  background: allReviewed ? 'var(--accent-green-bg)' : 'var(--bg-surface)',
                  border: `1px solid ${allReviewed ? 'var(--accent-green)' : 'var(--border)'}`,
                  borderRadius:5,
                  color: allReviewed ? 'var(--accent-green)' : 'var(--text-muted)',
                  cursor: allReviewed ? 'pointer' : 'default',
                  fontSize:11, ...MONO, fontWeight:700,
                  opacity: allReviewed ? 1 : .45,
                  pointerEvents: allReviewed ? 'auto' : 'none',
                  transition:'opacity .2s' }}
                onMouseEnter={e => { if (allReviewed) e.currentTarget.style.background = 'var(--accent-green-bg)'; }}
                onMouseLeave={e => { if (allReviewed) e.currentTarget.style.background = 'var(--accent-green-bg)'; }}>
                Finalize &amp; Issue Credential →
              </button>;
            })()}
          </div>
        )}

        {phase === 'complete' && (
          <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'center', flexShrink:0 }}>
            <button onClick={onClose}
              style={{ padding:'10px 32px', background:'var(--accent-green-bg)', border:'1px solid var(--accent-green)', borderRadius:6, color:'var(--accent-green)', cursor:'pointer', fontSize:13, ...MONO, fontWeight:700, transition:'background .15s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--accent-green-bg)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='var(--accent-green-bg)';}}>
              Done
            </button>
          </div>
        )}

        {/* ── Toast ── */}
        {toast && (
          <div style={{ position:'absolute', bottom:64, left:'50%', transform:'translateX(-50%)', background:'var(--bg-surface)', border:'1px solid var(--border-hover)', borderRadius:5, padding:'8px 16px', fontSize:11, color:'var(--text-primary)', ...MONO, zIndex:10, whiteSpace:'nowrap', animation:'pfade .2s ease', pointerEvents:'none' }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
