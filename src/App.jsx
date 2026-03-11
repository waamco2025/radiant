import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { applyCompat, countN, maxD, convKeys, compCounts, newCount, traceability, countryBk, attestCoverage } from './data/dataset';
import { TT, SUPPLIER_PERSONA } from './data/tokens';
import { getVerticalConfig } from './data/verticals';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import NetGraph from './components/NetGraph';
import RiskMatrix from './components/RiskMatrix';
import WorldMap from './components/WorldMap';
import DetailPanel from './components/DetailPanel';
import AttestationTestPanel from './components/AttestationTestPanel';
import RadiantLogo from './components/RadiantLogo';
import CreditsModal from './components/CreditsModal';
import RequirementsLibraryModal from './components/RequirementsLibraryModal';
import SystemCreationModal from './components/SystemCreationModal';
import NetworkEventsNotification from './components/NetworkEventsNotification';
import { generateNetworkEvents } from './data/generateEvents';
import { InviteSupplierPanel } from './components/InviteSupplierModal';
import SupplierNetGraph from './components/SupplierNetGraph';
import SupplierSidebar from './components/SupplierSidebar';
import InvitationModal from './components/InvitationModal';
import AssetRegistrationModal from './components/AssetRegistrationModal';
import SDACreationModal from './components/SDACreationModal';
import SubgraphModal from './components/SubgraphModal';
import EvaluationModal from './components/EvaluationModal';
import AssetRegistrationStandaloneModal from './components/AssetRegistrationStandaloneModal';
import AssetDirectoryModal from './components/AssetDirectoryModal';
import { generatePlatformAssets, ALL_FIELD_KEYS } from './data/platformAssets';
import PrimeRadiant from './v2/PrimeRadiant';

const CSS = `@keyframes pshim{0%{background-position:-200% center}100%{background-position:200% center}}@keyframes pglow{0%,100%{box-shadow:0 0 8px rgba(99,102,241,.3)}50%{box-shadow:0 0 16px rgba(99,102,241,.6)}}@keyframes ppulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes pfade{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}@keyframes pdash{to{stroke-dashoffset:-20}}@keyframes pspin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes bootglow{0%,100%{filter:drop-shadow(0 0 8px rgba(99,102,241,.3))}50%{filter:drop-shadow(0 0 20px rgba(99,102,241,.6))}}@keyframes cblink{0%,100%{opacity:1}50%{opacity:0}}@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(400%)}}@keyframes pdot{0%,100%{box-shadow:0 0 3px rgba(34,197,94,.3)}50%{box-shadow:0 0 8px rgba(34,197,94,.5)}}@keyframes claimglow{0%{box-shadow:0 0 12px rgba(34,197,94,.5);opacity:0}15%{box-shadow:0 0 12px rgba(34,197,94,.5);opacity:1}100%{box-shadow:0 0 0 transparent;opacity:1}}@keyframes revealIn{0%{opacity:0}100%{opacity:1}}@keyframes eventglow{0%{opacity:0}100%{opacity:.8}}@keyframes countdown{from{stroke-dashoffset:0}to{stroke-dashoffset:56.549}}.dim-ph::placeholder{color:var(--text-muted)!important}`;

/* ── Boot Sequence ───────────────────────────────────────── */
function BootScreen({onDone,stats,bootMessage}){
  const[idx,setIdx]=useState(0);
  const[chars,setChars]=useState(0);
  const[fadeOut,setFadeOut]=useState(false);
  const msgs=useMemo(()=>[
    "Initializing provenance engine...",
    bootMessage,
    `Mapping ${stats.total.toLocaleString()} tokens across ${stats.countries} countries...`,
    `Verifying attestation coverage... ${stats.verified} verified`,
    "System ready."
  ],[stats,bootMessage]);

  useEffect(()=>{
    if(fadeOut)return;
    if(idx>=msgs.length){const t=setTimeout(()=>setFadeOut(true),400);return()=>clearTimeout(t);}
    const msg=msgs[idx];
    if(chars<msg.length){const t=setTimeout(()=>setChars(c=>c+1),10);return()=>clearTimeout(t);}
    const t=setTimeout(()=>{setIdx(i=>i+1);setChars(0);},300);
    return()=>clearTimeout(t);
  },[idx,chars,msgs,fadeOut]);

  useEffect(()=>{if(fadeOut){const t=setTimeout(onDone,500);return()=>clearTimeout(t);}},[fadeOut,onDone]);

  const currentMsg=idx<msgs.length?msgs[idx].slice(0,chars):msgs[msgs.length-1];
  const isReady=idx>=msgs.length;

  return <div style={{position:"fixed",inset:0,zIndex:9999,background:"#0a0c10",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",opacity:fadeOut?0:1,transition:"opacity .5s ease"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(99,102,241,.015) 2px,rgba(99,102,241,.015) 4px)",pointerEvents:"none",overflow:"hidden"}}>
      <div style={{position:"absolute",left:0,right:0,height:"30%",background:"linear-gradient(180deg,rgba(99,102,241,.04),transparent)",animation:"scan 4s linear infinite"}}/>
    </div>
    <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(99,102,241,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.03) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none"}}/>
    <div style={{animation:"bootglow 2s ease-in-out infinite"}}><PrimeRadiant size={120} fps={60} particles={true}/></div>
    <div style={{marginTop:8,fontSize:16,fontWeight:700,color:"#f3f4f6",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>RADIANT</div>
    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",letterSpacing:".12em",marginBottom:32}}>by PROVENANCE</div>
    <div style={{minHeight:20,fontSize:12,color:isReady?"#22c55e":"#6366f1",fontFamily:"'JetBrains Mono',monospace",transition:"color .3s"}}>
      {currentMsg}<span style={{animation:"cblink .8s step-end infinite",marginLeft:1}}>_</span>
    </div>
  </div>;
}

/* ── Breadcrumb helper ───────────────────────────────────── */
function findPath(node,targetId){
  if(node.id===targetId)return[node];
  if(node.children){for(const c of node.children){const p=findPath(c,targetId);if(p)return[node,...p];}}
  return null;
}

/* ── Extract supplier's visible subchain (SDA-bounded) ── */
function extractSupplierSubchain(fullTree, supplierNodeId, sdaDepth = 2) {
  const path = findPath(fullTree, supplierNodeId);
  if (!path) return null;
  const startIdx = Math.max(0, path.length - 1 - sdaDepth);
  const visiblePath = path.slice(startIdx);
  const supplierNode = visiblePath[visiblePath.length - 1];
  const gN = [];
  const gE = [];
  const focusIds = new Set();
  for (let i = 0; i < visiblePath.length - 1; i++) {
    const n = visiblePath[i];
    gN.push({ ...n, depth: i, children: undefined });
    focusIds.add(n.id);
    gE.push({ from: n.id, to: visiblePath[i + 1].id });
  }
  const supplierDepth = visiblePath.length - 1;
  const walk = (n, depth) => {
    gN.push({ ...n, depth, children: undefined });
    focusIds.add(n.id);
    if (n.children) {
      for (const c of n.children) {
        gE.push({ from: n.id, to: c.id });
        walk(c, depth + 1);
      }
    }
  };
  walk(supplierNode, supplierDepth);
  return { gN, gE, focusIds, centerId: supplierNodeId };
}

/* ── Supplier invitation seed data ──── */
const INITIAL_INVITATIONS = [
  { id: 'inv-1', customer: 'Stellar Dynamics Aerospace', asset: 'Thermal Interface Pad', date: '2026-02-20', status: 'pending', verticalKey: 'aerospace', targetParentNodeId: 'n1195' },
  { id: 'inv-2', customer: 'MicroCo Electronics', asset: 'Power Regulator IC', date: '2026-02-18', status: 'pending', verticalKey: 'microco', targetParentNodeId: 'n3' },
  { id: 'inv-3', customer: 'FastCo Healthcare', asset: 'Sterilization Module', date: '2026-02-10', status: 'expired', verticalKey: 'healthcare', targetParentNodeId: 'n11' },
  { id: 'inv-4', customer: 'GovCo Federal Satellite Agency', asset: 'MOSFET Module', date: '2026-02-25', status: 'pending', verticalKey: 'govco', targetParentNodeId: 'n733', targetAssetId: 'n1195', message: "We've reviewed your MOSFET Module credentials with Stellar Dynamics. We'd like equivalent disclosure for our satellite program." },
];

/* ── Standalone Invite Panel (no node pre-selected) ──── */
function StandaloneInvitePanel({ data, terminalTypes, vertConfig, invitedSet, onInvite, onSelectNode, onClose, onCascade }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const tt = terminalTypes || ['rawsource'];
  const candidates = useMemo(() => {
    const out = [];
    const walk = n => {
      if (n.type !== 'customer' && !tt.includes(n.type)) out.push(n);
      if (n.children) n.children.forEach(walk);
    };
    walk(data);
    return out;
  }, [data, tt]);
  const filtered = useMemo(() => {
    if (!query.trim()) return candidates.slice(0, 40);
    const q = query.toLowerCase();
    return candidates.filter(n => n.name.toLowerCase().includes(q) || (n.supplier || '').toLowerCase().includes(q) || (n.location || '').toLowerCase().includes(q)).slice(0, 40);
  }, [candidates, query]);
  if (picked) {
    return <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 45 }}>
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'var(--bg-overlay)', borderLeft: '1px solid var(--border)', animation: 'pfade .2s ease', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
        <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Invite Supplier</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 12 }}>for {picked.name}</div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 18px' }}>
          <InviteSupplierPanel node={picked} requirements={vertConfig?.inviteRequirements || []}
            onInvite={(id, details) => { if (onInvite) onInvite(id, details); onClose(); }}
            onClose={onClose} onCascade={onCascade} />
        </div>
      </div>
    </div>;
  }
  return <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 45 }}>
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'var(--bg-overlay)', borderLeft: '1px solid var(--border)', animation: 'pfade .2s ease', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div style={{ padding: '16px 18px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Invite Supplier</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 12 }}>Select a node to invite an upstream supplier</div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search nodes..." autoFocus className="dim-ph"
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, height: 40, background: 'var(--bg-app-header)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: "var(--font-display)" }} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 18px' }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700, marginBottom: 8, marginTop: 4 }}>NODES WITHOUT UPSTREAM SUPPLIERS</div>
        {filtered.length === 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', padding: '12px 0' }}>No matching nodes</div>}
        {filtered.map(n => {
          const tk = TT[n.type] || TT.component;
          const inviteCount = invitedSet instanceof Map ? (invitedSet.get(n.id) || []).length : 0;
          return <div key={n.id} onClick={() => { setPicked(n); onSelectNode(n); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 4, cursor: 'pointer', transition: 'background .1s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: tk.border, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: tk.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.supplier || ''}{n.location ? ` · ${n.location}` : ''}</div>
            </div>
            {inviteCount > 0 && <span style={{ fontSize: 8, color: 'var(--accent-amber)', fontFamily: 'monospace', fontWeight: 600, flexShrink: 0 }}>{inviteCount} INVITED</span>}
          </div>;
        })}
      </div>
    </div>
  </div>;
}

/* ── Node factory for user-created programs/systems ──── */
function createNode({ mode, name, description, data, vertConfig }) {
  const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const node = {
    id, name,
    type: mode,
    location: data.location,
    lat: data.lat, lng: data.lng,
    attestations: [],
    children: [],
  };
  if (description) node.description = description;
  applyCompat(node);
  node.supplier = data.name;
  node.isNew = false;
  return node;
}

/* ═══ Apply isNew based on lastSeenAt from localStorage ═══ */
function applyIsNew(tree){
  let lastSeen;
  try{lastSeen=localStorage.getItem('radiant-lastSeenAt');}catch(e){}
  if(!lastSeen){
    // First visit — everything stays as-is from applyCompat (30-day window)
    return;
  }
  const threshold=new Date(lastSeen).getTime();
  const walk=n=>{
    if(n.createdAt){
      n.isNew=new Date(n.createdAt).getTime()>threshold;
    }
    if(n.children)n.children.forEach(walk);
  };
  walk(tree);
}

export default function App(){
  /* ═══ Boot ═══ */
  const[booted,setBooted]=useState(()=>{const nav=performance.getEntriesByType?.('navigation')?.[0];if(nav?.type==='reload'){sessionStorage.removeItem('radiant-booted');return false;}return!!sessionStorage.getItem('radiant-booted');});
  const onBootDone=useCallback(()=>{sessionStorage.setItem('radiant-booted','1');setBooted(true);try{localStorage.setItem('radiant-lastSeenAt',new Date().toISOString());}catch(e){}},[]);

  /* ═══ Theme ═══ */
  const[theme,setTheme]=useState(()=>localStorage.getItem('radiant-theme')||'dark');
  const toggleTheme=useCallback(()=>{setTheme(prev=>{const next=prev==='dark'?'light':'dark';localStorage.setItem('radiant-theme',next);return next;});},[]);
  useEffect(()=>{document.documentElement.setAttribute('data-theme',theme==='light'?'light':'');},[theme]);

  /* ═══ Core state ═══ */
  const[sel,setSel]=useState(null);const[persona,setPers]=useState("engineer");const[vert,setVert]=useState("aerospace");
  const[appMode,setAppMode]=useState("buyer");
  const[assetDirOpen,setAssetDirOpen]=useState(false);
  const handleRoleChange=useCallback(mode=>{setAppMode(mode);},[]);
  const[supplierActiveChain,setSupplierActiveChain]=useState(null);
  const[supplierSel,setSupplierSel]=useState(null);
  const[supplierInvitations,setSupplierInvitations]=useState(INITIAL_INVITATIONS);
  const[activeInvitation,setActiveInvitation]=useState(null);
  const[assetRegModal,setAssetRegModal]=useState(null);
  const[sdaModalOpen,setSdaModalOpen]=useState(false);
  const[sdaModalPrefill,setSdaModalPrefill]=useState({asset:null,receiver:null});
  const[sdaModalDerivativeEval,setSdaModalDerivativeEval]=useState(null);
  const[sdaChainContext,setSdaChainContext]=useState(null);
  const[sdaMutations,setSdaMutations]=useState({});
  const[disclosureOffers,setDisclosureOffers]=useState([]);
  const[disclosureRequests,setDisclosureRequests]=useState([]);
  const[cascadeRequests,setCascadeRequests]=useState([]);
  const[userNodeRegistry,setUserNodeRegistry]=useState([]);
  const[pendingSupplierNodeId,setPendingSupplierNodeId]=useState(null);
  const[supplierNetworks,setSupplierNetworks]=useState(SUPPLIER_PERSONA.customerNetworks);
  const[supplierDataRev,setSupplierDataRev]=useState(0);
  const[supplierPendingSelId,setSupplierPendingSelId]=useState(null);
  const[supplierGraphPanTo,setSupplierGraphPanTo]=useState(null);
  const handleGraphPanToBuyer=useCallback(buyerId=>{setSupplierGraphPanTo({id:buyerId,k:Date.now()});},[]);
  /* Supplier Detail Panel (single-click node selection) */
  const[supplierDetailNode,setSupplierDetailNode]=useState(null);
  const handleSupplierNodeSelect=useCallback(node=>{setSupplierDetailNode(node);},[]);
  /* Task 2: stable ref so onNodeSelect can read view without being recreated */
  const viewRef=useRef('graph');
  /* Task 3: nodeId can be any asset node; handler looks up the supplier root from supplierNetworks */
  const handleOpenCustomerChain=useCallback((verticalKey,nodeId,explicitPreselect)=>{
    const network=supplierNetworks.find(cn=>cn.verticalKey===verticalKey);
    const rootId=network?.supplierNodeId||nodeId;
    setSupplierSel(null);
    setSupplierActiveChain({verticalKey,supplierNodeId:rootId});
    setSupplierPendingSelId(explicitPreselect||nodeId);
  },[supplierNetworks]);

  /* ═══ Supplier customer data (computed lazily) ═══ */
  const customerData=useMemo(()=>{
    if(appMode!=='supplier')return null;
    const REF_T=new Date('2026-02-17').getTime();
    return supplierNetworks.map(cn=>{
      const cfg=getVerticalConfig(cn.verticalKey);
      const root=cfg.generator();
      applyCompat(root);
      /* Inject user-registered nodes for this vertical into the generated tree */
      const findN=(n,id)=>{if(n.id===id)return n;if(n.children)for(const c of n.children){const r=findN(c,id);if(r)return r;}return null;};
      for(const ur of userNodeRegistry){
        if(ur.verticalKey!==cn.verticalKey)continue;
        const par=findN(root,ur.parentId);
        if(par){if(!par.children)par.children=[];if(!par.children.find(c=>c.id===ur.nodeId)){
          /* Fresh copy each recompute — user nodes are not cached, but we still clone
             to isolate from the registry reference. sdas cleared so applyMut rebuilds cleanly. */
          const fresh={...ur.node,sdas:undefined,rawAttestations:[...(ur.node.rawAttestations||[])],attestations:[...(ur.node.attestations||[])],children:[...(ur.node.children||[])]};
          par.children.push(fresh);
        }}
      }
      /* Apply persisted SDA mutations and build unified node.sdas.
         IMPORTANT: generator nodes are MODULE-CACHED (same JS objects each call).
         We must NOT read from any field we previously wrote (derivativeSDAs, sdas)
         as those values persist from the last recompute. Only read node.sda (generator's
         original, never mutated by us) + sdaMutations state (authoritative source). */
      const applyMut=(n)=>{
        const muts=sdaMutations[n.id]||[];
        /* Build sdas from clean sources only: generator's node.sda + our state */
        const all=[];
        if(n.sda)all.push({...n.sda});
        for(const s of muts)all.push({...s});
        n.sdas=all.length?all:undefined;

        if(n.children)n.children.forEach(applyMut);
      };
      applyMut(root);
      let supplierNode=null,parentNode=null;
      const findWithParent=(n,par)=>{
        if(n.id===cn.supplierNodeId){supplierNode=n;parentNode=par;return true;}
        if(n.children)for(const c of n.children)if(findWithParent(c,n))return true;
        return false;
      };
      findWithParent(root,null);
      const raw=supplierNode?.rawAttestations||[];
      let verified=0,expiring=0,contested=0,revoked=0,pending=0,expired=0;
      for(const a of raw){
        if(a.status==='verified'){
          if(a.validUntil){const d=(new Date(a.validUntil).getTime()-REF_T)/86400000;if(d>0&&d<=30){expiring++;continue;}}
          verified++;
        }else if(a.status==='contested')contested++;
        else if(a.status==='revoked')revoked++;
        else if(a.status==='pending')pending++;
        else if(a.status==='expired')expired++;
      }
      /* Task 2: build per-asset list — supplier node + all descendants */
      const assets=[];
      const walkAssets=(n,par)=>{
        assets.push({node:n,downstream:par,upstream:n.children?.[0]||null});
        if(n.children)n.children.forEach(c=>walkAssets(c,n));
      };
      if(supplierNode)walkAssets(supplierNode,parentNode);
      return {
        verticalKey:cn.verticalKey,
        customerName:cn.customerName,
        supplierNodeId:cn.supplierNodeId,
        supplierNode,
        downstreamNode:parentNode,
        upstreamNodes:supplierNode?.children||[],
        assets,
        attestationSummary:{total:raw.length,verified,expiring,contested,revoked,pending,expired},
      };
    });
  },[appMode,supplierNetworks,supplierDataRev,sdaMutations,userNodeRegistry]);
  /* Sidebar asset click — pan graph (if graph view) + open Detail Panel — must be after customerData */
  const handleSidebarAssetSelect=useCallback((verticalKey,supplierNodeId,nodeId)=>{
    const cd=customerData?.find(c=>c.verticalKey===verticalKey);
    let foundNode=null;
    if(cd){
      const target=[cd.supplierNode,...(cd.upstreamNodes||[])].find(n=>n?.id===nodeId);
      if(target)foundNode=target;
      if(!foundNode){for(const a of(cd.assets||[])){if(a.node.id===nodeId){foundNode=a.node;break;}}}
    }
    setSupplierDetailNode(foundNode||null);
    setSupplierGraphPanTo({id:nodeId,k:Date.now()});
  },[customerData]);

  const supplierChainData=useMemo(()=>{
    if(!supplierActiveChain||appMode!=='supplier')return null;
    const{verticalKey,supplierNodeId}=supplierActiveChain;
    const cfg=getVerticalConfig(verticalKey);
    const root=cfg.generator();
    applyCompat(root);
    return extractSupplierSubchain(root,supplierNodeId,3);
  },[supplierActiveChain,appMode,supplierDataRev]);
  const handleCloseSupplierChain=useCallback(()=>{setSupplierActiveChain(null);setSupplierSel(null);setSupplierPendingSelId(null);},[]);
  /* Task 3: apply pending node selection once supplierChainData is ready */
  useEffect(()=>{
    if(!supplierPendingSelId||!supplierChainData)return;
    const node=supplierChainData.gN.find(n=>n.id===supplierPendingSelId);
    if(node)setSupplierSel(node);
    setSupplierPendingSelId(null);
  },[supplierChainData,supplierPendingSelId]);

  /* Pan to and select the completed-chain asset once customerData has it */
  useEffect(()=>{
    if(!pendingSupplierNodeId||!customerData)return;
    let found=null;
    for(const cd of customerData){
      for(const a of(cd.assets||[])){if(a.node.id===pendingSupplierNodeId){found=a.node;break;}}
      if(found)break;
    }
    if(found){
      setSupplierDetailNode(found);
      setTimeout(()=>setSupplierGraphPanTo({id:pendingSupplierNodeId,k:Date.now()}),50);
      setPendingSupplierNodeId(null);
    }
  },[customerData,pendingSupplierNodeId]);

  /* ═══ Invitation handlers ═══ */
  const handleOpenInvitation=useCallback(invId=>{
    const inv=supplierInvitations.find(i=>i.id===invId);
    if(inv)setActiveInvitation(inv);
  },[supplierInvitations]);
  const handleCloseInvitation=useCallback(()=>{setActiveInvitation(null);setSdaChainContext(null);},[]);
  const handleAcceptInvitation=useCallback(inv=>{setAssetRegModal({invitation:inv});},[]);
  const handleDeclineInvitation=useCallback(invId=>{
    setSupplierInvitations(prev=>prev.filter(i=>i.id!==invId));
    setActiveInvitation(null);
  },[]);
  const handleAssetRegistration=useCallback(payload=>{
    const{invitationId,assetName,partNumber,description,verticalKey,targetParentNodeId}=payload;
    /* Create the new supplier asset node */
    const nodeId=`usr-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const now=new Date().toISOString();
    const newNode={
      id:nodeId, name:assetName, type:'component',
      location:SUPPLIER_PERSONA.location, lat:40.6259, lng:-75.3705,
      attestations:[], children:[],
    };
    if(partNumber)newNode.partNumber=partNumber;
    if(description)newNode.description=description;
    /* Generate initial attestations */
    newNode.rawAttestations=[
      {actor:{name:SUPPLIER_PERSONA.org,id:SUPPLIER_PERSONA.id},predicate:'supplied_by',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:'Block #'+Math.floor(800000+Math.random()*100000)},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'},
      {actor:{name:SUPPLIER_PERSONA.org,id:SUPPLIER_PERSONA.id},predicate:'registered_on_chain',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:'Block #'+Math.floor(800000+Math.random()*100000)},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'},
    ];
    applyCompat(newNode);
    /* Save to registry so customerData memo can inject it into the generated tree */
    setUserNodeRegistry(prev=>[...prev,{nodeId,node:newNode,parentId:targetParentNodeId,verticalKey}]);
    setAssetRegModal(null);
    /* Force customerData recompute to pick up the injected node */
    setSupplierDataRev(r=>r+1);
    /* Set chain context so invitation panel transitions to disclosure type selection */
    const inv=supplierInvitations.find(i=>i.id===invitationId);
    setSdaChainContext({invitation:inv,asset:{id:nodeId,name:assetName,type:'component'}});
  },[supplierInvitations]);

  /* ═══ Standalone asset registration (supplier header button) ═══ */
  const handleStandaloneAssetReg=useCallback(({name:assetName,type:assetType,partNumber,description,location:assetLoc,evidence:evidenceList,disclosureOffer})=>{
    const nodeId='usr-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);
    const now=new Date().toISOString();
    const newNode={id:nodeId,name:assetName,type:assetType,location:assetLoc,lat:40.6259,lng:-75.3705,attestations:[],children:[]};
    if(partNumber)newNode.partNumber=partNumber;
    if(description)newNode.description=description;
    const rawAtt=[
      {actor:{name:SUPPLIER_PERSONA.org,id:SUPPLIER_PERSONA.id},predicate:'supplied_by',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:'Block #'+Math.floor(800000+Math.random()*100000)},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'},
      {actor:{name:SUPPLIER_PERSONA.org,id:SUPPLIER_PERSONA.id},predicate:'registered_on_chain',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:'Block #'+Math.floor(800000+Math.random()*100000)},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'},
    ];
    /* Seed evidence attestations from uploaded documents */
    if(evidenceList&&evidenceList.length>0){
      newNode.evidence=evidenceList;
      for(const doc of evidenceList){
        rawAtt.push({actor:{name:SUPPLIER_PERSONA.org,id:SUPPLIER_PERSONA.id},predicate:'provenance_claimed',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:doc.name},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'});
      }
    }
    newNode.rawAttestations=rawAtt;
    applyCompat(newNode);
    /* Pick first customer network as default parent for standalone registration */
    const network=supplierNetworks[0];
    const parentId=network?.supplierNodeId||'n1195';
    const verticalKey=network?.verticalKey||'aerospace';
    setUserNodeRegistry(prev=>[...prev,{nodeId,node:newNode,parentId,verticalKey}]);
    /* Create disclosure offer if requested */
    if(disclosureOffer&&disclosureOffer.types?.length>0){
      const offerNow=new Date().toISOString();
      const offer={id:`offer-${Date.now()}`,assetId:nodeId,assetName,assetType,supplierOrg:SUPPLIER_PERSONA.org,disclosureTypes:disclosureOffer.types,discoverable:disclosureOffer.discoverable!==false,createdAt:offerNow,expiresAt:null};
      setDisclosureOffers(prev=>[...prev,offer]);
      setActivityLog(prev=>[{id:`log-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'disclosure_offer_created',timestamp:offerNow,actorRole:'supplier',nodeId,nodeName:assetName,description:`Disclosure offer: ${disclosureOffer.types.join(', ')} on ${assetName}`,details:{types:disclosureOffer.types,discoverable:disclosureOffer.discoverable!==false}},...prev]);
    }
    setSupplierDataRev(r=>r+1);
    setStandaloneAssetRegOpen(false);
    /* Auto-select and pan to new asset after recompute */
    setSupplierPendingSelId(nodeId);
  },[supplierNetworks]);

  const vertConfig=useMemo(()=>getVerticalConfig(vert),[vert]);
  const platformAssets=useMemo(()=>{
    const base=generatePlatformAssets(vert);
    for(const reg of userNodeRegistry){
      if(reg.verticalKey!==vert)continue;
      const offer=disclosureOffers.find(o=>o.assetId===reg.nodeId&&o.discoverable);
      if(!offer)continue;
      base.push({
        id:reg.nodeId,name:reg.node.name,type:reg.node.type,
        supplier:SUPPLIER_PERSONA.org,location:reg.node.location||'Unknown',country:'US',
        token:reg.node.token||'0x'+reg.nodeId.slice(-8),
        block:reg.node.block||Math.floor(800000+Math.random()*100000),
        registeredDate:reg.node.rawAttestations?.[0]?.timestamp||new Date().toISOString(),
        claimsSummary:{total:reg.node.rawAttestations?.length||0,verified:reg.node.rawAttestations?.length||0,expired:0,contested:0},
        health:reg.node.rawAttestations?.length>0?'healthy':'unknown',
        disclosureTypes:offer.disclosureTypes,
        dataFields:ALL_FIELD_KEYS.reduce((acc,k)=>{acc[k]=true;return acc;},{}),
        disclosureVisibility:'public',
        activity:[],
        _userRegistered:true,
      });
    }
    return base;
  },[vert,userNodeRegistry,disclosureOffers]);
  const[data,setData]=useState(()=>{const r=vertConfig.generator();applyCompat(r);applyIsNew(r);return r;});
  const bootStats=useMemo(()=>{const co=countryBk(data);const att=attestCoverage(data);return{total:countN(data),countries:Object.keys(co).length,verified:att.tv};},[data]);
  const allNodes=useMemo(()=>{const out=[];const w=n=>{out.push(n);if(n.children)n.children.forEach(w);};w(data);return out;},[data]);
  const initEx=useMemo(()=>{const m={[vertConfig.rootId]:true};if(data.children?.length)m[data.children[0].id]=true;return m;},[data,vertConfig.rootId]);
  const[exMap,setExMap]=useState(initEx);
  const[rev,setRev]=useState(new Set());const[view,setView]=useState("graph");
  const[chainRequest,setChainRequest]=useState(null);
  const[credits,setCredits]=useState(2400);
  const[supplierCredits,setSupplierCredits]=useState(2400);
  const[dataRev,setDataRev]=useState(0);
  const[revealedSet,setRevealedSet]=useState(new Set());
  const[invitedSet,setInvitedSet]=useState(new Map());
  const[autoOpenInvite,setAutoOpenInvite]=useState(false);
  const[showCreditsModal,setShowCreditsModal]=useState(false);
  const[standaloneAssetRegOpen,setStandaloneAssetRegOpen]=useState(false);
  const[approvalStates,setApprovalStates]=useState({});
  const approvalSeeded=useRef(false);
  const evidenceSeeded=useRef(false);
  const[requirementsModalOpen,setRequirementsModalOpen]=useState(false);
  const[systemModalOpen,setSystemModalOpen]=useState(false);
  const[systemModalMode,setSystemModalMode]=useState('program');
  const[systemModalParentNode,setSystemModalParentNode]=useState(null);
  const handleCreateSystem=useCallback((payload)=>{
    const{mode,name,description,parentNodeId}=payload;
    const newNode=createNode({mode,name,description,data,vertConfig});
    if(mode==='program'){
      data.children.push(newNode);
    }else{
      const find=(n,id)=>{if(n.id===id)return n;if(n.children)for(const c of n.children){const r=find(c,id);if(r)return r;}return null;};
      const parent=find(data,parentNodeId);
      if(!parent){console.warn('Parent not found:',parentNodeId);return;}
      if(!parent.children)parent.children=[];
      parent.children.push(newNode);
    }
    setData(prev=>({...prev}));
    const parentId=mode==='program'?vertConfig.rootId:parentNodeId;
    setExMap(prev=>({...prev,[parentId]:true}));
    setSel(newNode);
    setAutoOpenInvite(false);
    if(view!=='graph')setView('graph');
    setTimeout(()=>setGraphPanTo({id:newNode.id,k:Date.now(),targetZoom:1.0}),50);
  },[data,vertConfig,view]);
  const handleOpenSystemModal=useCallback((parentNode)=>{setSystemModalMode('system');setSystemModalParentNode(parentNode);setSystemModalOpen(true);},[]);
  const handleCloseSystemModal=useCallback(()=>{setSystemModalOpen(false);setSystemModalMode('program');setSystemModalParentNode(null);},[]);
  /* ═══ SDA modal ═══ */
  const supplierAssetsList=useMemo(()=>{
    if(!customerData)return [];
    return customerData.flatMap(cd=>(cd.assets||[]).map(a=>({id:a.node.id,label:a.node.name,type:a.node.type,tier:(TT[a.node.type]||TT.component).label})));
  },[customerData]);
  const handleOpenSDAModal=useCallback((asset,receiver)=>{
    setSdaModalPrefill({asset:asset||null,receiver:receiver||null});
    setSdaModalDerivativeEval(null);
    setSdaModalOpen(true);
  },[]);
  const handleCreateDisclosure=useCallback((invitation,asset,disclosureType,evaluation)=>{
    setSdaModalPrefill({asset:{id:asset.id,label:asset.name,type:asset.type},receiver:invitation.customer});
    if(disclosureType==='derivative'&&evaluation){setSdaModalDerivativeEval(evaluation);}
    setSdaChainContext({invitation,asset:{id:asset.id,name:asset.name,type:asset.type},disclosureType});
    setSdaModalOpen(true);
  },[]);
  /* ═══ Activity log ═══ */
  const[activityLog,setActivityLog]=useState([]);
  const addLogEntry=useCallback((type,actorRole,nodeId,nodeName,description,details=null)=>{
    setActivityLog(prev=>[{id:`log-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type,timestamp:new Date().toISOString(),actorRole,nodeId,nodeName,description,details},...prev]);
  },[]);

  const handleCreateOffer=useCallback((assetId,assetName,assetType,disclosureTypes,discoverable,fieldData)=>{
    const now=new Date().toISOString();
    const offer={id:`offer-${Date.now()}`,assetId,assetName,assetType,supplierOrg:SUPPLIER_PERSONA.org,disclosureTypes,discoverable,createdAt:now,expiresAt:null,...(fieldData||{})};
    setDisclosureOffers(prev=>[...prev,offer]);
    setNetworkEvents(prev=>[{id:`offer-evt-${Date.now()}`,type:'disclosure_offer_created',label:`Disclosure offer created · ${assetName} · ${disclosureTypes.join(', ')}`,nodeId:assetId,timestamp:now,read:false,color:'var(--accent-indigo)'},...prev]);
    addLogEntry('disclosure_offer_created','supplier',assetId,assetName,`Disclosure offer: ${disclosureTypes.join(', ')} on ${assetName}`,{types:disclosureTypes,discoverable});
  },[addLogEntry]);

  const handleRevokeOffer=useCallback((offerId,reason)=>{
    const now=new Date().toISOString();
    setDisclosureOffers(prev=>prev.map(o=>o.id===offerId?{...o,status:'revoked',revokedAt:now,revokeReason:reason}:o));
    const offer=disclosureOffers.find(o=>o.id===offerId);
    if(offer){
      setNetworkEvents(prev=>[{id:`offer-revoke-evt-${Date.now()}`,type:'disclosure_offer_revoked',label:`Disclosure offer revoked · ${offer.assetName}`,nodeId:offer.assetId,timestamp:now,read:false,color:'var(--accent-red)'},...prev]);
      addLogEntry('disclosure_offer_revoked','supplier',offer.assetId,offer.assetName,`Disclosure offer revoked: ${offer.disclosureTypes.join(', ')} on ${offer.assetName}`,{reason});
    }
  },[addLogEntry,disclosureOffers]);

  const handleAddAttestation=useCallback((nodeId,predicate)=>{
    const now=new Date().toISOString();
    const att={actor:{name:SUPPLIER_PERSONA.org,id:'supplier-self'},predicate,subject:{id:nodeId},evidence:{hash:'0x'+Math.random().toString(16).slice(2,10),type:predicate},timestamp:now,status:'verified',signature:'0x'+Math.random().toString(16).slice(2,18)};
    /* Walk the tree to find the node and append */
    function walk(n){if(n.id===nodeId){n.rawAttestations=[...(n.rawAttestations||[]),att];return true;}if(n.children)return n.children.some(walk);return false;}
    if(data)walk(data);
    setData(prev=>({...prev}));
    setNetworkEvents(prev=>[{id:`att-add-${Date.now()}`,type:'attestation_added',label:`Attestation added · ${predicate} · ${nodeId.slice(0,8)}`,nodeId,timestamp:now,read:false,color:'var(--accent-green)'},...prev]);
    addLogEntry('attestation_added','supplier',nodeId,nodeId,`Added attestation: ${predicate}`,{predicate});
  },[data,addLogEntry]);

  const handleRevokeAttestation=useCallback((nodeId,attIndex,reason)=>{
    const now=new Date().toISOString();
    function walk(n){if(n.id===nodeId){if(n.rawAttestations&&n.rawAttestations[attIndex]){n.rawAttestations[attIndex]={...n.rawAttestations[attIndex],status:'revoked',revokedAt:now,revokeReason:reason};}return true;}if(n.children)return n.children.some(walk);return false;}
    if(data)walk(data);
    setData(prev=>({...prev}));
    setNetworkEvents(prev=>[{id:`att-revoke-${Date.now()}`,type:'attestation_revoked',label:`Attestation revoked · ${nodeId.slice(0,8)}`,nodeId,timestamp:now,read:false,color:'var(--accent-red)'},...prev]);
    addLogEntry('attestation_revoked','supplier',nodeId,nodeId,`Revoked attestation at index ${attIndex}`,{reason});
  },[data,addLogEntry]);

  const handleRequestDisclosure=useCallback((asset,requestedType)=>{
    const now=new Date().toISOString();
    const req={id:`dreq-${Date.now()}`,assetId:asset.id,assetName:asset.name,supplierName:asset.supplier,requestedType,requestedAt:now,requestedBy:'Thomas Crowley',status:'pending'};
    setDisclosureRequests(prev=>[...prev,req]);
    setNetworkEvents(prev=>[{id:`dreq-evt-${Date.now()}`,type:'disclosure_requested',label:`Disclosure requested · ${requestedType} · ${asset.name} from ${asset.supplier}`,nodeId:asset.id,timestamp:now,read:false,color:'var(--accent-sda-full)'},...prev]);
    addLogEntry('disclosure_requested','buyer',asset.id,asset.name,`Disclosure requested: ${requestedType} from ${asset.supplier}`,{type:requestedType,supplier:asset.supplier});
  },[addLogEntry]);

  const handleApproveDisclosureRequest=useCallback((requestId)=>{
    const req=disclosureRequests.find(r=>r.id===requestId);
    if(!req)return;
    const now=new Date().toISOString();
    /* Look up platform asset for details */
    const pAsset=platformAssets.find(a=>a.id===req.assetId);
    /* Create new node in buyer tree */
    const nodeId='dreq-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);
    const newNode={id:nodeId,name:req.assetName,type:pAsset?.type||'component',location:pAsset?.location||SUPPLIER_PERSONA.location,lat:pAsset?.lat||40.6259,lng:pAsset?.lng||-75.3705,attestations:[],children:[]};
    newNode.rawAttestations=[
      {actor:{name:SUPPLIER_PERSONA.org,id:SUPPLIER_PERSONA.id},predicate:'supplied_by',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:'Block #'+Math.floor(800000+Math.random()*100000)},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'},
      {actor:{name:SUPPLIER_PERSONA.org,id:SUPPLIER_PERSONA.id},predicate:'registered_on_chain',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:'Block #'+Math.floor(800000+Math.random()*100000)},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'},
    ];
    applyCompat(newNode);
    /* Insert into buyer tree via userNodeRegistry — parentId = root customer node */
    const parentId=data.id;
    setUserNodeRegistry(prev=>[...prev,{nodeId,node:newNode,parentId,verticalKey:vert}]);
    /* Create SDA via sdaMutations */
    const sdaType=req.requestedType||'full';
    const newSda={id:`sda-${sdaType}-${Date.now()}`,type:sdaType,discloser:SUPPLIER_PERSONA.org,receiver:req.requestedBy||'Buyer',created:now.slice(0,10),expires:null,status:'active',disclosedFields:null,redactedFields:null,sourceEvalId:null,evalResult:null};
    setSdaMutations(prev=>{const existing=prev[nodeId]||[];return{...prev,[nodeId]:[...existing,newSda]};});
    /* Update request status */
    setDisclosureRequests(prev=>prev.map(r=>r.id===requestId?{...r,status:'approved',approvedAt:now,approvedBy:SUPPLIER_PERSONA.org,buyerNodeId:nodeId}:r));
    /* Deduct supplier credits */
    setSupplierCredits(c=>c-80);
    /* Network event */
    setNetworkEvents(prev=>[{id:`dreq-approve-evt-${Date.now()}`,type:'disclosure_approved',label:`Disclosure approved · ${sdaType} · ${req.assetName} → ${req.requestedBy||'Buyer'}`,nodeId,timestamp:now,read:false,color:'var(--accent-green)'},...prev]);
    addLogEntry('disclosure_approved','supplier',nodeId,req.assetName,`Disclosure request approved: ${sdaType} for ${req.assetName}`,{sdaType,requestedBy:req.requestedBy});
    setSupplierDataRev(r=>r+1);
    setDataRev(r=>r+1);
  },[disclosureRequests,platformAssets,data,vert,addLogEntry]);

  const handleDeclineDisclosureRequest=useCallback((requestId,declineReason)=>{
    const req=disclosureRequests.find(r=>r.id===requestId);
    if(!req)return;
    const now=new Date().toISOString();
    setDisclosureRequests(prev=>prev.map(r=>r.id===requestId?{...r,status:'declined',declinedAt:now,declinedBy:SUPPLIER_PERSONA.org,declineReason:declineReason||''}:r));
    setNetworkEvents(prev=>[{id:`dreq-decline-evt-${Date.now()}`,type:'disclosure_declined',label:`Disclosure declined · ${req.requestedType} · ${req.assetName}`,nodeId:req.assetId,timestamp:now,read:false,color:'var(--accent-red)'},...prev]);
    addLogEntry('disclosure_declined','supplier',req.assetId,req.assetName,`Disclosure request declined: ${req.requestedType} for ${req.assetName}`,{reason:declineReason});
  },[disclosureRequests,addLogEntry]);

  /* ═══ Cascade disclosure handlers ═══ */
  const handleCreateCascadeRequest=useCallback((nodeId,message)=>{
    const fn=(n,id)=>{if(n.id===id)return n;if(n.children)for(const c of n.children){const r=fn(c,id);if(r)return r;}return null;};
    const node=fn(data,nodeId);if(!node)return;
    const now=new Date().toISOString();
    const req={id:`casc-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,requesterId:data.id,requesterNodeId:nodeId,requesterNodeName:node.name,supplierOrg:node.supplier||SUPPLIER_PERSONA.org,verticalKey:vert,status:'pending',requestedAt:now,message:message||'',upstreamAssetName:null,upstreamAssetType:null,cascadePolicy:null,acceptedAt:null};
    setCascadeRequests(prev=>[req,...prev]);
    setNetworkEvents(prev=>[{id:`casc-req-evt-${Date.now()}`,type:'cascade_requested',label:`Cascade requested · ${node.name}`,nodeId,timestamp:now,read:false,color:'var(--accent-sda-cascade)'},...prev]);
    addLogEntry('cascade_requested','buyer',nodeId,node.name,`Cascade disclosure requested for ${node.name}`,{message});
  },[data,vert,addLogEntry]);

  const handleAcceptCascade=useCallback((requestId,upstreamAssetName,upstreamAssetType,cascadePolicy)=>{
    const req=cascadeRequests.find(r=>r.id===requestId);if(!req)return;
    const now=new Date().toISOString();
    /* Create tier-2 node */
    const nodeId='casc-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);
    const newNode={id:nodeId,name:upstreamAssetName,type:upstreamAssetType||'component',location:'Upstream Facility',lat:35.6762,lng:139.6503,attestations:[],children:[]};
    newNode.rawAttestations=[
      {actor:{name:'Upstream Supplier',id:'upstream-auto'},predicate:'supplied_by',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:'Block #'+Math.floor(800000+Math.random()*100000)},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'},
      {actor:{name:'Upstream Supplier',id:'upstream-auto'},predicate:'registered_on_chain',subject:nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,18),type:'Block #'+Math.floor(800000+Math.random()*100000)},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,34),status:'verified'},
    ];
    applyCompat(newNode);
    /* Register as child of requester node */
    setUserNodeRegistry(prev=>[...prev,{nodeId,node:newNode,parentId:req.requesterNodeId,verticalKey:req.verticalKey}]);
    /* Create cascade SDA */
    const newSda={id:`sda-cascade-${Date.now()}`,type:'full',scope:'cascade',cascadePolicy,originChainId:req.id,discloser:upstreamAssetName,receiver:req.requesterNodeName,created:now.slice(0,10),expires:null,status:'active',disclosedFields:null,redactedFields:null,sourceEvalId:null,evalResult:null};
    setSdaMutations(prev=>{const existing=prev[nodeId]||[];return{...prev,[nodeId]:[...existing,newSda]};});
    /* Update request status */
    setCascadeRequests(prev=>prev.map(r=>r.id===requestId?{...r,status:'accepted',upstreamAssetName,upstreamAssetType,cascadePolicy,acceptedAt:now}:r));
    setSupplierCredits(c=>c-80);
    setSupplierDataRev(r=>r+1);
    setDataRev(r=>r+1);
    setNetworkEvents(prev=>[{id:`casc-acc-evt-${Date.now()}`,type:'cascade_accepted',label:`Cascade accepted · ${upstreamAssetName} → ${req.requesterNodeName}`,nodeId,timestamp:now,read:false,color:'var(--accent-sda-cascade)'},...prev]);
    addLogEntry('cascade_accepted','supplier',nodeId,upstreamAssetName,`Cascade accepted: ${upstreamAssetName} → ${req.requesterNodeName} (${cascadePolicy})`,{cascadePolicy,originRequest:req.id});
  },[cascadeRequests,addLogEntry]);

  const handleDeclineCascade=useCallback((requestId,reason)=>{
    const req=cascadeRequests.find(r=>r.id===requestId);if(!req)return;
    const now=new Date().toISOString();
    setCascadeRequests(prev=>prev.map(r=>r.id===requestId?{...r,status:'declined',declinedAt:now,declineReason:reason||''}:r));
    setNetworkEvents(prev=>[{id:`casc-dec-evt-${Date.now()}`,type:'cascade_declined',label:`Cascade declined · ${req.requesterNodeName}`,nodeId:req.requesterNodeId,timestamp:now,read:false,color:'var(--accent-red)'},...prev]);
    addLogEntry('cascade_declined','supplier',req.requesterNodeId,req.requesterNodeName,`Cascade request declined for ${req.requesterNodeName}`,{reason});
  },[cascadeRequests,addLogEntry]);

  const handleSDASubmit=useCallback((payload)=>{
    /* Deduct credits from supplier balance */
    setSupplierCredits(c=>c-80);
    const now=new Date().toISOString().slice(0,10);
    const receiverStr=payload.receivers?.[0]==='*'?'Any Participant':payload.receivers?.join(', ')||'';
    /* Helper to build a new SDA object for a given asset ID */
    const makeSda=id=>payload.disclosureType==='derivative'
      ?{id:`dsda-${id}-${Date.now()}`,type:'derivative',discloser:payload.supplierName,receiver:receiverStr,created:now,expires:payload.expirationDate||null,status:'active',sourceEvalId:payload.selectedEvaluation?.id||`eval-auto-${id.slice(-4)}`,evalResult:payload.selectedEvaluation?.overallResult||'pass',evalChecklist:payload.selectedEvaluation?.checklist||null}
      :{id:`sda-${payload.disclosureType}-${Date.now()}`,type:payload.disclosureType,discloser:payload.supplierName,receiver:receiverStr,created:now,expires:payload.expirationDate||null,status:'active',disclosedFields:payload.disclosureType==='selective'?payload.disclosedFields:null,redactedFields:payload.disclosureType==='selective'?payload.redactedFields:null,sourceEvalId:null,evalResult:null};
    /* Single SDA write path — chain context uses its canonical asset ID, otherwise use wizard selection */
    const targetIds=sdaChainContext?[sdaChainContext.asset?.id].filter(Boolean):(payload.selectedAssets||[]);
    for(const assetId of targetIds){
      const newSda=makeSda(assetId);
      setSdaMutations(prev=>{
        const existing=prev[assetId]||[];
        if(existing.some(s=>s.type===newSda.type&&s.receiver===newSda.receiver))return prev;
        return{...prev,[assetId]:[...existing,newSda]};
      });
    }
    setSupplierDataRev(r=>r+1);
    /* Add event notification */
    setNetworkEvents(prev=>[{id:`sda-evt-${Date.now()}`,type:'sda_published',label:`SDA published · ${payload.disclosureType} disclosure to ${receiverStr} · 80 credits`,nodeId:targetIds[0],timestamp:now,read:false,color:'var(--accent-indigo)'},...prev]);
    addLogEntry('sda_created',appMode,targetIds[0]||'',payload.assetName||targetIds[0]||'',`SDA created: ${payload.disclosureType} → ${receiverStr}`,{sdaType:payload.disclosureType,receiver:receiverStr});
    /* Chain context cleanup: mark invitation accepted, add buyer network, queue auto-select */
    if(sdaChainContext){
      try{
        const chainInv=sdaChainContext.invitation;
        const chainAssetId=sdaChainContext.asset?.id;
        if(chainInv?.id){
          setSupplierInvitations(prev=>prev.map(i=>i.id===chainInv.id?{...i,status:'accepted'}:i));
          if(chainInv.verticalKey&&!supplierNetworks.some(cn=>cn.verticalKey===chainInv.verticalKey)){
            setSupplierNetworks(prev=>[...prev,{verticalKey:chainInv.verticalKey,customerName:chainInv.customer,supplierNodeId:chainAssetId}]);
          }
        }
        if(chainAssetId)setPendingSupplierNodeId(chainAssetId);
      }catch(err){console.error('SDA chain context cleanup failed:',err);}
      setActiveInvitation(null);
      setSdaChainContext(null);
    }
  },[sdaChainContext,supplierNetworks,addLogEntry,appMode]);
  /* ═══ Evidence requests ═══ */
  const[evidenceRequests,setEvidenceRequests]=useState([]);
  /* ═══ Evaluation modal ═══ */
  const[evalModalOpen,setEvalModalOpen]=useState(false);
  const[evalModalNode,setEvalModalNode]=useState(null);
  const[evalModalPresetChecklist,setEvalModalPresetChecklist]=useState(null);
  const handleOpenEvalModal=useCallback((node,presetChecklistId=null)=>{setEvalModalNode(node);setEvalModalPresetChecklist(presetChecklistId);setEvalModalOpen(true);},[]);
  const handleEvalComplete=useCallback((node,summary)=>{
    const now=new Date().toISOString();
    const hasFails=(summary.finalFail>0||summary.finalEvidence>0);
    const newAtt={actor:{name:'Radiant AI Evaluator',id:'sys-radiant-eval-001'},predicate:'evaluated_against_requirements',subject:node.id,evidence:{hash:'0x'+Math.random().toString(16).slice(2,10),type:'evaluation_report'},timestamp:now,validUntil:null,signature:'0x'+Math.random().toString(16).slice(2,10),status:hasFails?'contested':'verified',signatory:{name:'Automated',title:'AI System'}};
    /* Persist evaluation record + attestation on the tree node (not the sel reference) */
    const evalRecord={id:`eval-${Date.now()}`,checklist:summary.checklistLabel,checklistId:summary.checklistId,requirementCount:summary.total,overallResult:hasFails?'fail':'pass',passCount:summary.finalPass||(summary.autoApproved+summary.needsReview),failCount:summary.finalFail||summary.flagged,date:now.slice(0,10),evaluator:summary.evaluatorType||'ai_auto',creditCost:summary.cost};
    const walkAndMutate=n=>{if(n.id===node.id){n.rawAttestations=[...(n.rawAttestations||[]),newAtt];if(!n.evaluations)n.evaluations=[];n.evaluations.push(evalRecord);return true;}if(n.children)for(const c of n.children)if(walkAndMutate(c))return true;return false;};
    walkAndMutate(data);
    // Sync sel to canonical tree node so DetailPanel sees the mutation immediately
    const findInTree=(n,id)=>{if(n.id===id)return n;if(n.children)for(const c of n.children){const r=findInTree(c,id);if(r)return r;}return null;};
    const canonical=findInTree(data,node.id);
    if(canonical)setSel(prev=>prev?.id===node.id?canonical:prev);
    setCredits(c=>c-summary.cost);
    setData(prev=>({...prev}));
    setDataRev(r=>r+1);
    setSupplierDataRev(r=>r+1);
    setNetworkEvents(prev=>[{id:`eval-evt-${Date.now()}`,type:'evaluation_complete',label:`Evaluation complete · ${summary.checklistLabel} · ${summary.autoApproved} auto-approved`,nodeId:node.id,timestamp:now,read:false,color:'var(--accent-green)'},...prev]);
    /* Create evidence request objects from review decisions */
    if(summary.evidenceRequested?.length>0){
      const reqs=summary.evidenceRequested.map((er,i)=>({id:`evreq-${Date.now()}-${i}`,nodeId:node.id,nodeName:node.name,reqId:er.reqId,title:er.title,outcome:er.outcome,sdaFieldCategory:er.sdaFieldCategory,checklist:summary.checklistLabel,checklistId:summary.checklistId,status:'pending',requestedAt:now,requestedBy:'Thomas Crowley'}));
      setEvidenceRequests(prev=>[...reqs,...prev]);
    }
    /* Auto-resolve accepted evidence on re-evaluation — mark as resolved */
    setEvidenceRequests(prev=>prev.map(r=>{
      if(r.nodeId===node.id&&r.status==='accepted')return{...r,status:'resolved',resolvedAt:now,resolvedBy:'Re-evaluation'};
      return r;
    }));
    /* Modal closed by Done button in EvaluationModal */
    addLogEntry('evaluation_complete','buyer',node.id,node.name,`Evaluation: ${summary.checklistLabel} on ${node.name} — ${hasFails?'fail':'pass'}`,{checklist:summary.checklistLabel,result:hasFails?'fail':'pass',passCount:summary.finalPass||(summary.autoApproved+summary.needsReview),failCount:summary.finalFail||summary.flagged,evidenceCount:summary.evidenceRequested?.length||0});
  },[data,addLogEntry]);
  const handleSupplierRevokeSDA=useCallback((nodeId,sdaId,reason)=>{
    const now=new Date().toISOString();
    setSdaMutations(prev=>{
      const existing=prev[nodeId]||[];
      return{...prev,[nodeId]:existing.map(s=>s.id===sdaId?{...s,status:'revoked',revokedAt:now,revokeReason:reason}:s)};
    });
    setSupplierDataRev(r=>r+1);
    setNetworkEvents(prev=>[{id:`sda-revoke-evt-${Date.now()}`,type:'sda_revoked',label:`SDA revoked by supplier`,nodeId,timestamp:now,read:false,color:'var(--accent-red)'},...prev]);
    addLogEntry('sda_revoked','supplier',nodeId,'','SDA revoked by supplier',{sdaId,reason});
  },[addLogEntry]);
  const handleSubmitEvidence=useCallback((requestId,responseData)=>{
    let matchedReq=null;
    setEvidenceRequests(prev=>prev.map(r=>{
      if(r.id!==requestId)return r;
      matchedReq=r;
      const newResponse={fileName:responseData.fileName,fileType:responseData.fileType,fileSize:responseData.fileSize,notes:responseData.notes,submittedAt:new Date().toISOString(),submittedBy:'MicroCo Supply Team'};
      const isResubmit=r.status==='rejected';
      return{...r,status:isResubmit?'resubmitted':'submitted',response:newResponse,...(isResubmit&&{previousResponses:[...(r.previousResponses||[]),r.response].filter(Boolean)})};
    }));
    if(matchedReq){setNetworkEvents(prev=>[{id:`evsubmit-evt-${Date.now()}`,type:'evidence_submitted',label:`Evidence submitted · ${matchedReq.title}`,nodeId:matchedReq.nodeId,timestamp:new Date().toISOString(),read:false,color:'var(--accent-cyan)'},...prev]);addLogEntry('evidence_submitted','supplier',matchedReq.nodeId,matchedReq.nodeName,`Evidence submitted: ${matchedReq.title} on ${matchedReq.nodeName}`,{title:matchedReq.title,fileName:responseData.fileName});}
  },[addLogEntry]);
  const handleReviewEvidence=useCallback((requestId,decision,reviewNotes)=>{
    let matchedReq=null;
    setEvidenceRequests(prev=>prev.map(r=>{
      if(r.id!==requestId)return r;
      matchedReq=r;
      return{...r,status:decision,reviewedAt:new Date().toISOString(),reviewedBy:'Thomas Crowley',reviewNotes:reviewNotes||''};
    }));
    if(matchedReq&&decision==='accepted'){
      const now=new Date().toISOString();
      const newAtt={actor:{name:'Thomas Crowley',id:'buyer-admin'},predicate:'evidence_accepted',subject:matchedReq.nodeId,evidence:{hash:'0x'+Math.random().toString(16).slice(2,10),type:'evidence_review',fileName:matchedReq.response?.fileName},timestamp:now,status:'verified',signatory:{name:'Thomas Crowley',title:'Supply Chain Manager'}};
      const addAtt=n=>{if(n.id===matchedReq.nodeId){(n.rawAttestations||(n.rawAttestations=[])).push(newAtt);return true;}if(n.children)for(const c of n.children)if(addAtt(c))return true;return false;};
      addAtt(data);setData(prev=>({...prev}));setDataRev(r=>r+1);
    }
    if(matchedReq){setNetworkEvents(prev=>[{id:`evreview-evt-${Date.now()}`,type:decision==='accepted'?'evidence_accepted':'evidence_rejected',label:`Evidence ${decision} · ${matchedReq.title}`,nodeId:matchedReq.nodeId,timestamp:new Date().toISOString(),read:false,color:decision==='accepted'?'var(--accent-green)':'var(--accent-red)'},...prev]);addLogEntry(decision==='accepted'?'evidence_accepted':'evidence_rejected','buyer',matchedReq.nodeId,matchedReq.nodeName,`Evidence ${decision}: ${matchedReq.title} on ${matchedReq.nodeName}`,{title:matchedReq.title,reviewer:'Thomas Crowley',...(decision==='rejected'?{reason:reviewNotes}:{})});}
  },[data,addLogEntry]);
  const[networkEvents,setNetworkEvents]=useState(()=>generateNetworkEvents(data,vert));
  const[highlightedEventNode,setHighlightedEventNode]=useState(null);
  const[eventsStage,setEventsStage]=useState(1);
  const handleHighlightNode=useCallback(info=>{setHighlightedEventNode(info);},[]);
  const handleEventsStageChange=useCallback(stage=>{setEventsStage(stage);},[]);

  /* ═══ Vertical switch ═══ */
  const vertSwitchRef=useRef(vert);
  useEffect(()=>{
    if(vertSwitchRef.current===vert)return;
    vertSwitchRef.current=vert;
    const cfg=getVerticalConfig(vert);
    const raw=cfg.generator();
    applyCompat(raw);applyIsNew(raw);
    setData(raw);
    setSel(null);setChainRequest(null);setRevealedSet(new Set());setInvitedSet(new Map());setAutoOpenInvite(false);setNetworkEvents(generateNetworkEvents(raw,vert));
    setAttFilter({statuses:new Set(),types:new Set(),tiers:new Set(),approvalStatuses:new Set(),isNew:false,converge:false,compliant:false,search:''});
    setExMap({[cfg.rootId]:true,...(raw.children?.[0]?{[raw.children[0].id]:true}:{})});
    setApprovalStates({});approvalSeeded.current=false;setActivityLog([]);setDisclosureOffers([]);setDisclosureRequests([]);setCascadeRequests([]);setEvidenceRequests([]);evidenceSeeded.current=false;
  },[vert]);

  /* ═══ Pre-seed ~97% of nodes as approved ═══ */
  useEffect(()=>{
    if(approvalSeeded.current)return;
    approvalSeeded.current=true;
    const containerTypes=new Set(['customer','program','system']);
    const states={};
    const seed=(n)=>{
      if(!containerTypes.has(n.type)){
        // Simple deterministic hash from node id for stable ~97% approval
        let h=0;for(let i=0;i<n.id.length;i++){h=((h<<5)-h)+n.id.charCodeAt(i);h|=0;}
        if(Math.abs(h%100)<97){
          states[n.id]={status:'approved',timestamp:'2026-01-15T00:00:00.000Z',reviewer:'System',notes:''};
        }
      }
      if(n.children)n.children.forEach(seed);
    };
    seed(data);
    setApprovalStates(states);
  },[data]);

  /* ═══ Seed evidence on pre-existing assets (~40% of approved non-container nodes) ═══ */
  useEffect(()=>{
    if(evidenceSeeded.current)return;
    evidenceSeeded.current=true;
    const containerTypes=new Set(['customer','program','system']);
    const SEED_DOCS=[
      {title:'Registration Certificate',fileType:'pdf',fileSize:'245 KB'},
      {title:'Material Specification Sheet',fileType:'pdf',fileSize:'1.2 MB'},
      {title:'Supplier Quality Declaration',fileType:'pdf',fileSize:'89 KB'},
    ];
    const CHECKLISTS=['as9100','nist80053','cmmcl2','iso13485'];
    const reqs=[];
    const walk=n=>{
      if(!containerTypes.has(n.type)){
        let h=0;for(let i=0;i<n.id.length;i++){h=((h<<5)-h)+n.id.charCodeAt(i);h|=0;}
        if(Math.abs(h%100)<40){
          const docCount=1+(Math.abs(h)%3);
          const clIdx=Math.abs(h>>4)%CHECKLISTS.length;
          for(let d=0;d<docCount;d++){
            const doc=SEED_DOCS[d%SEED_DOCS.length];
            const reqId=`seed-req-${n.id}-${d}`;
            reqs.push({id:`seed-ev-${n.id}-${d}`,nodeId:n.id,nodeName:n.name,reqId,title:doc.title,outcome:'pass_med',sdaFieldCategory:null,checklist:CHECKLISTS[clIdx],status:'accepted',requestedAt:'2026-01-10T00:00:00.000Z',requestedBy:'System',response:{fileName:doc.title.toLowerCase().replace(/ /g,'_')+'.'+doc.fileType,fileType:doc.fileType,fileSize:doc.fileSize,notes:'Pre-registration documentation',submittedAt:'2026-01-12T00:00:00.000Z',submittedBy:n.supplier||'Supplier'},reviewedAt:'2026-01-14T00:00:00.000Z',reviewedBy:'System',reviewNotes:'Accepted during onboarding'});
          }
        }
      }
      if(n.children)n.children.forEach(walk);
    };
    walk(data);
    if(reqs.length)setEvidenceRequests(prev=>[...reqs,...prev]);
  },[data]);

  /* ═══ View transition ═══ */
  const[shimmer,setShimmer]=useState(false);
  const prevViewRef=useRef(view);

  /* ═══ Keyboard control keys ═══ */
  const[focusSearchKey,setFocusSearchKey]=useState(0);
  const[resetZoomKey,setResetZoomKey]=useState(0);
  const[fitViewKey,setFitViewKey]=useState(0);
  const[graphPanTo,setGraphPanTo]=useState(null);
  const[showAttTest,setShowAttTest]=useState(false);

  /* ═══ Attestation filter ═══ */
  const[attFilter,setAttFilter]=useState({statuses:new Set(),types:new Set(),tiers:new Set(),approvalStatuses:new Set(),isNew:false,converge:false,compliant:false,search:''});
  const attFilterResult=useMemo(()=>{
    const f=attFilter;
    const noFilter=f.statuses.size===0&&f.types.size===0&&f.tiers.size===0&&f.approvalStatuses.size===0&&!f.isNew&&!f.converge&&!f.compliant&&!f.search;
    if(noFilter)return{match:null,searchMatchCount:0};
    const REF_T=new Date('2026-02-17').getTime();
    const CATS={Provenance:['provenance_claimed','supplied_by'],Quality:['quality_approved','inspected'],Calibration:['calibrated'],Custody:['registered_on_chain'],Qualification:['certified'],Transformation:['assembled_from','material_tested'],Evaluation:['evaluated_against_requirements']};
    const allP=Object.values(CATS).flat();
    const sLc=f.search?f.search.toLowerCase():'';
    const m=new Set();let searchCount=0;
    function walk(n){
      const raw=n.rawAttestations||[];
      const tt=TT[n.type]||TT.component;
      /* search — matches node fields + actor names on attestations */
      let pSearch=!sLc;
      if(sLc){
        const fields=[n.name,n.supplier,n.location,n.token,n.type,tt.label].filter(Boolean);
        if(fields.some(s=>s.toLowerCase().includes(sLc)))pSearch=true;
        if(!pSearch){for(const a of raw){if(a.actor.name.toLowerCase().includes(sLc)){pSearch=true;break;}}}
      }
      /* statuses — includes pseudo-values 'unevaluated' and 'expiring' */
      let pS=f.statuses.size===0;
      if(!pS){
        for(const a of raw){if(f.statuses.has(a.status)){pS=true;break;}}
        if(!pS&&f.statuses.has('unevaluated')&&n.type!=='customer'&&!raw.some(a=>a.predicate==='evaluated_against_requirements'))pS=true;
        if(!pS&&f.statuses.has('expiring')){for(const a of raw){if(a.status==='verified'&&a.validUntil){const d=(new Date(a.validUntil).getTime()-REF_T)/86400000;if(d>0&&d<=30){pS=true;break;}}}}
      }
      /* types */
      let pT=f.types.size===0;
      if(!pT){for(const a of raw){for(const[cat,preds]of Object.entries(CATS)){if(f.types.has(cat)&&preds.includes(a.predicate)){pT=true;break;}}if(pT)break;if(f.types.has('Other')&&!allP.includes(a.predicate)){pT=true;break;}}}
      /* tiers */
      let pTier=f.tiers.size===0||f.tiers.has(n.type);
      /* isNew */
      let pNew=!f.isNew||!!n.isNew;
      /* converge */
      let pConv=!f.converge||!!n.convergenceKey;
      /* compliant */
      let pComp=!f.compliant||n.compliance==='compliant';
      /* approval status */
      let pAppr=f.approvalStatuses.size===0;
      if(!pAppr){const as=approvalStates[n.id];const nodeApproval=as?.status||'provisional';if(['customer','program','system'].includes(n.type))pAppr=true;else pAppr=f.approvalStatuses.has(nodeApproval);}
      if(pSearch&&pS&&pT&&pTier&&pNew&&pConv&&pComp&&pAppr){m.add(n.id);if(sLc)searchCount++;}
      if(n.children)n.children.forEach(walk);
    }
    walk(data);
    return{match:m,searchMatchCount:sLc?searchCount:0};
  },[attFilter,data,dataRev]);
  const attFilterMatch=attFilterResult.match;
  const searchMatchCount=attFilterResult.searchMatchCount;

  /* ═══ Callbacks ═══ */
  const tog=useCallback(id=>setExMap(p=>({...p,[id]:!p[id]})),[]);
  const expAll=useCallback(()=>{const m={};const w=n=>{m[n.id]=true;if(n.children)n.children.forEach(w);};w(data);setExMap(m);},[data]);
  const colAll=useCallback(()=>setExMap({[vertConfig.rootId]:true}),[vertConfig.rootId]);
  const doRev=useCallback(id=>setRev(p=>new Set([...p,id])),[]);
  const stats=useMemo(()=>({total:countN(data),depth:maxD(data),conv:convKeys(data).size,comp:compCounts(data),newN:newCount(data),trace:traceability(data)}),[data]);
  const closeSel=useCallback(()=>setSel(null),[]);
  const onEvalComplete=useCallback((nodeId,newAtt)=>{const u=n=>{if(n.id===nodeId){(n.rawAttestations||(n.rawAttestations=[])).push(newAtt);return true;}if(n.children)for(const c of n.children)if(u(c))return true;return false;};u(data);setDataRev(r=>r+1);},[data]);
  const onApproveAsset=useCallback((nodeId,notes)=>{const fn=(n,id)=>{if(n.id===id)return n;if(n.children)for(const c of n.children){const r=fn(c,id);if(r)return r;}return null;};const tgt=fn(data,nodeId);const nm=tgt?.name||nodeId;setApprovalStates(prev=>({...prev,[nodeId]:{status:'approved',timestamp:new Date().toISOString(),reviewer:'Thomas Crowley',notes:notes||''}}));const u=n=>{if(n.id===nodeId){(n.rawAttestations||(n.rawAttestations=[])).push({actor:{name:data.name||'Buyer Organization',id:'buyer-org'},predicate:'approved_asset',subject:nodeId,evidence:{hash:`0x${Date.now().toString(16)}`,type:'approval_decision'},time:{created:new Date().toISOString(),expires:null},status:'verified',category:'evaluation',signatory:{name:'Thomas Crowley',title:'Supply Chain Manager'}});return true;}if(n.children)for(const c of n.children)if(u(c))return true;return false;};u(data);setDataRev(r=>r+1);addLogEntry('asset_approved','buyer',nodeId,nm,`Approved: ${nm}`,{notes,reviewer:'Thomas Crowley'});},[data,addLogEntry]);
  const onRejectAsset=useCallback((nodeId,reason)=>{
    const fn=(n,id)=>{if(n.id===id)return n;if(n.children)for(const c of n.children){const r=fn(c,id);if(r)return r;}return null;};const tgt=fn(data,nodeId);const nm=tgt?.name||nodeId;
    addLogEntry('asset_rejected','buyer',nodeId,nm,`Rejected: ${nm}${reason?' — '+reason:''}`,{reason,reviewer:'Thomas Crowley'});
    const removeFromTree=(parent)=>{if(!parent.children)return false;const idx=parent.children.findIndex(c=>c.id===nodeId);if(idx!==-1){parent.children.splice(idx,1);return true;}for(const child of parent.children){if(removeFromTree(child))return true;}return false;};
    removeFromTree(data);
    setData(prev=>({...prev}));
    setSel(prev=>prev?.id===nodeId?null:prev);
    setApprovalStates(prev=>{const n={...prev};delete n[nodeId];return n;});
    setDataRev(r=>r+1);
  },[data,addLogEntry]);
  const onRevokeSDA=useCallback((nodeId,sdaId,reason)=>{
    const fn=(n,id)=>{if(n.id===id)return n;if(n.children)for(const c of n.children){const r=fn(c,id);if(r)return r;}return null;};
    const tgt=fn(data,nodeId);const nm=tgt?.name||nodeId;const sdaType=tgt?.sdas?.find(s=>s.id===sdaId)?.type||tgt?.sda?.type||'unknown';
    addLogEntry('sda_revoked','buyer',nodeId,nm,`SDA revoked: ${sdaType} disclosure on ${nm} — node removed`,{sdaType,sdaId,reason});
    const removeFromTree=(parent)=>{if(!parent.children)return false;const idx=parent.children.findIndex(c=>c.id===nodeId);if(idx!==-1){parent.children.splice(idx,1);return true;}for(const child of parent.children){if(removeFromTree(child))return true;}return false;};
    removeFromTree(data);setData(prev=>({...prev}));setSel(prev=>prev?.id===nodeId?null:prev);
    setApprovalStates(prev=>{const n={...prev};delete n[nodeId];return n;});
    setSdaMutations(prev=>{const n={...prev};delete n[nodeId];return n;});
    setDataRev(r=>r+1);
    setNetworkEvents(prev=>[{id:`sda-revoke-evt-${Date.now()}`,type:'sda_revoked',label:`SDA revoked · ${sdaType} disclosure on ${nm}`,nodeId,timestamp:new Date().toISOString(),read:false,color:'var(--accent-red)'},...prev]);
  },[data,addLogEntry]);
  const onRevealNode=useCallback(id=>{setRevealedSet(s=>{const n=new Set(s);n.add(id);return n;});},[]);
  const onRevealAll=useCallback(()=>{const ids=new Set();const w=n=>{if(n.isNew)ids.add(n.id);if(n.children)n.children.forEach(w);};w(data);setRevealedSet(ids);},[data]);
  const onInvite=useCallback((id,details)=>{setInvitedSet(s=>{const n=new Map(s);n.set(id,[...(s.get(id)||[]),details||{timestamp:new Date().toISOString()}]);return n;});setAutoOpenInvite(false);const fn=(n,tid)=>{if(n.id===tid)return n;if(n.children)for(const c of n.children){const r=fn(c,tid);if(r)return r;}return null;};const tgt=fn(data,id);const nm=tgt?.name||id;addLogEntry('invitation_sent','buyer',id,nm,`Invitation sent for ${nm}`,{supplierName:details?.supplierName||details?.name||'Supplier'});},[data,addLogEntry]);
  const onRevokeInvite=useCallback((id,idx)=>{setInvitedSet(s=>{const n=new Map(s);const arr=[...(s.get(id)||[])];arr.splice(idx,1);if(arr.length===0)n.delete(id);else n.set(id,arr);return n;});},[]);
  const onNodeSelect=useCallback(n=>{setSel(n);setAutoOpenInvite(false);if(viewRef.current==='graph')setGraphPanTo({id:n.id,k:Date.now()});},[]);
  const onInviteClick=useCallback(()=>{setSel(null);setAutoOpenInvite(true);},[]);
  const onViewChain=useCallback(node=>{setView("graph");setChainRequest(node.id);},[]);
  const clearChainRequest=useCallback(()=>setChainRequest(null),[]);
  const handleFocusNode=useCallback((nodeId,opts)=>{const nd=allNodes.find(n=>n.id===nodeId);console.log('[App] focusNode:',nodeId,'found:',!!nd,'type:',nd?.type);setGraphPanTo({id:nodeId,k:Date.now(),targetZoom:1.0,...opts});},[allNodes]);
  const handleMarkAllRead=useCallback(()=>{setNetworkEvents(prev=>prev.map(e=>({...e,read:true})));onRevealAll();},[onRevealAll]);
  const handleEventClick=useCallback(evt=>{console.log('Event clicked:',evt);setNetworkEvents(prev=>prev.map(e=>e.id===evt.id?{...e,read:true}:e));const path=findPath(data,evt.nodeId);if(path){setSel(path[path.length-1]);setAutoOpenInvite(false);}},[data]);

  /* ═══ Breadcrumb ═══ */
  const breadcrumb=useMemo(()=>{
    if(!sel)return[data];
    return findPath(data,sel.id)||[data];
  },[sel,data]);
  const breadcrumbDisplay=useMemo(()=>{
    if(breadcrumb.length<=4)return breadcrumb;
    return[breadcrumb[0],null,breadcrumb[breadcrumb.length-2],breadcrumb[breadcrumb.length-1]];
  },[breadcrumb]);

  /* ═══ View transition shimmer + viewRef sync ═══ */
  useEffect(()=>{
    viewRef.current=view;
    if(prevViewRef.current!==view){prevViewRef.current=view;setShimmer(true);const t=setTimeout(()=>setShimmer(false),250);return()=>clearTimeout(t);}
  },[view]);



  /* ═══ Escape handler (capture phase) ═══ */
  useEffect(()=>{
    const onKey=e=>{
      if(e.key!=="Escape")return;
      if(standaloneAssetRegOpen){setStandaloneAssetRegOpen(false);e.stopImmediatePropagation();return;}
      if(evalModalOpen){setEvalModalOpen(false);e.stopImmediatePropagation();return;}
      if(sdaModalOpen){setSdaModalOpen(false);e.stopImmediatePropagation();return;}
      if(assetRegModal){setAssetRegModal(null);e.stopImmediatePropagation();return;}
      if(supplierActiveChain&&appMode==='supplier'){if(supplierSel){setSupplierSel(null);e.stopImmediatePropagation();return;}handleCloseSupplierChain();e.stopImmediatePropagation();return;}
      if(activeInvitation&&appMode==='supplier'){setActiveInvitation(null);setSdaChainContext(null);e.stopImmediatePropagation();return;}
      if(supplierDetailNode&&appMode==='supplier'){setSupplierDetailNode(null);e.stopImmediatePropagation();return;}
      if(systemModalOpen){handleCloseSystemModal();e.stopImmediatePropagation();return;}
      if(requirementsModalOpen){setRequirementsModalOpen(false);e.stopImmediatePropagation();return;}
      if(showAttTest){setShowAttTest(false);e.stopImmediatePropagation();return;}
      if(assetDirOpen){setAssetDirOpen(false);e.stopImmediatePropagation();return;}
      if(sel){setSel(null);e.stopImmediatePropagation();return;}
    };
    window.addEventListener("keydown",onKey,true);
    return()=>window.removeEventListener("keydown",onKey,true);
  },[sel,showAttTest,requirementsModalOpen,systemModalOpen,handleCloseSystemModal,supplierActiveChain,supplierSel,appMode,handleCloseSupplierChain,activeInvitation,assetRegModal,sdaModalOpen,evalModalOpen,supplierDetailNode,assetDirOpen,standaloneAssetRegOpen]);

  /* ═══ Keyboard shortcuts (bubble phase) ═══ */
  useEffect(()=>{
    const onKey=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setFocusSearchKey(k=>k+1);return;}
      const tag=e.target.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA')return;
      if(e.key==='1'){setView('graph');return;}
      if(e.key==='2'){setView('map');return;}
      if(e.key==='3'){setView('risk');return;}
      if(e.key.toLowerCase()==='r'&&!e.metaKey&&!e.ctrlKey){setResetZoomKey(k=>k+1);return;}
      if(e.key.toLowerCase()==='f'&&!e.metaKey&&!e.ctrlKey){setFitViewKey(k=>k+1);return;}
      if(e.key==='A'&&e.shiftKey&&!e.metaKey&&!e.ctrlKey){setShowAttTest(v=>!v);return;}
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);

  /* ═══ Task 4: Footer view label for supplier mode ═══ */
  const footerViewLabel=appMode!=='supplier'?undefined:supplierActiveChain?(()=>{const cName=customerData?.find(cd=>cd.verticalKey===supplierActiveChain.verticalKey)?.customerName||'';return cName?`${cName} · Supply Chain`:'Supply Chain';})():'Supplier Dashboard';
  /* Supplier Detail Panel vertical config */
  const supplierDetailVertKey=useMemo(()=>{
    if(!supplierDetailNode||!customerData)return vert;
    for(const cd of customerData){if((cd.assets||[]).some(a=>a.node.id===supplierDetailNode.id))return cd.verticalKey;}
    return vert;
  },[supplierDetailNode,customerData,vert]);
  const supplierDetailVertConfig=useMemo(()=>getVerticalConfig(supplierDetailVertKey),[supplierDetailVertKey]);

  return <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"var(--bg-deep)",color:"var(--text-primary)",fontFamily:"var(--font-display)",overflow:"hidden"}}>
    <style>{CSS}</style>
    {!booted&&<BootScreen onDone={onBootDone} stats={bootStats} bootMessage={vertConfig.labels.bootMessage}/>}
    <Header vert={vert} onVertChange={setVert} vertConfig={vertConfig} credits={credits} supplierCredits={supplierCredits} onCreditsClick={()=>setShowCreditsModal(true)} onInviteClick={onInviteClick} onRequirementsClick={()=>setRequirementsModalOpen(true)} onSystemClick={()=>{setSystemModalMode('program');setSystemModalParentNode(null);setSystemModalOpen(true);}} appMode={appMode} onRoleChange={handleRoleChange} supplierPersona={SUPPLIER_PERSONA} onRegisterAsset={()=>setStandaloneAssetRegOpen(true)} onAssetDirectoryClick={()=>setAssetDirOpen(true)} assetDirActive={assetDirOpen} theme={theme} onToggleTheme={toggleTheme}/>
    {appMode==='supplier'
      ? <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <SupplierSidebar persona={SUPPLIER_PERSONA} customerData={customerData} invitations={supplierInvitations} onSidebarAssetSelect={handleSidebarAssetSelect} onOpenInvitation={handleOpenInvitation} onGraphPanToBuyer={handleGraphPanToBuyer} disclosureRequests={disclosureRequests} cascadeRequests={cascadeRequests} onBrowseRequirements={()=>setRequirementsModalOpen(true)}/>
          <div style={{flex:1,position:"relative",display:"flex",overflow:"hidden"}}>
            <SupplierNetGraph persona={SUPPLIER_PERSONA} customerData={customerData} onNodeSelect={handleSupplierNodeSelect} onNodeDblClick={handleOpenCustomerChain} panToRequest={supplierGraphPanTo} selectedNodeId={supplierDetailNode?.id}/>
            {supplierDetailNode&&<div style={{position:"absolute",top:0,right:0,bottom:0,width:360,zIndex:45}}><DetailPanel node={supplierDetailNode} onClose={()=>setSupplierDetailNode(null)} onViewChain={node=>{if(node.id?.startsWith('buyer-')){const cd=customerData?.find(c=>c.customerName===node.name);if(cd)handleOpenCustomerChain(cd.verticalKey,cd.supplierNodeId);return;}const cd=customerData?.find(c=>(c.assets||[]).some(a=>a.node.id===node.id));if(cd)handleOpenCustomerChain(cd.verticalKey,node.id);}} onSelect={n=>setSupplierDetailNode(n)} nodeTypeLabels={supplierDetailVertConfig.nodeTypeLabels} credits={supplierCredits} setCredits={setSupplierCredits} invitedSet={new Map()} vert={supplierDetailVertKey} terminalTypes={supplierDetailVertConfig.terminalTypes} autoOpenInvite={false} onAutoOpenInviteConsumed={()=>{}} isSupplier evidenceRequests={evidenceRequests} onSubmitEvidence={handleSubmitEvidence} onReviewEvidence={handleReviewEvidence} activityLog={activityLog} onCreateOffer={handleCreateOffer} onRevokeOffer={handleRevokeOffer} onSupplierRevokeSDA={handleSupplierRevokeSDA} disclosureOffers={disclosureOffers} disclosureRequests={disclosureRequests} onApproveDisclosureRequest={handleApproveDisclosureRequest} onDeclineDisclosureRequest={handleDeclineDisclosureRequest} onAddAttestation={handleAddAttestation} onRevokeAttestation={handleRevokeAttestation} cascadeRequests={cascadeRequests} onAcceptCascade={handleAcceptCascade} onDeclineCascade={handleDeclineCascade}/></div>}
          </div>
        </div>
      : <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <Sidebar data={data} exMap={exMap} tog={tog} onSel={onNodeSelect} selId={sel?.id} rev={rev} onRev={doRev} stats={stats} colAll={colAll} onDblClickNode={onViewChain} attFilter={attFilter} onAttFilterChange={setAttFilter} attFilterMatch={attFilterMatch} sidebarTitle={vertConfig.labels.sidebarTitle} nodeTypeLabels={vertConfig.nodeTypeLabels} focusSearchKey={focusSearchKey} searchMatchCount={searchMatchCount} onRevealAll={onRevealAll} revealedSet={revealedSet} invitedSet={invitedSet} terminalTypes={vertConfig.terminalTypes} approvalStates={approvalStates}/>
          <div style={{flex:1,position:"relative",overflow:"hidden"}}>
            {/* Tab pills */}
            <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",zIndex:30,display:"flex",gap:1,background:"var(--bg-surface)",borderRadius:6,border:"1px solid var(--border)",overflow:"hidden"}}>
              {[{id:"graph",l:"Network Graph",k:"1"},{id:"map",l:"Supply Map",k:"2"},{id:"risk",l:"Risk Matrix",k:"3"}].map(tab=><button key={tab.id} onClick={()=>setView(tab.id)} style={{padding:"6px 14px",fontSize:11,fontFamily:"monospace",border:"none",cursor:"pointer",background:view===tab.id?"var(--border)":"transparent",color:view===tab.id?"var(--text-primary)":"var(--text-muted)"}}>{tab.l}<span style={{fontSize:8,color:"var(--text-faint)",marginLeft:4}}>{tab.k}</span></button>)}
            </div>
            {/* Breadcrumb */}
            <div style={{position:"absolute",top:50,left:"50%",transform:"translateX(-50%)",zIndex:29,display:"flex",alignItems:"center",maxWidth:"80%",background:"var(--bg-overlay)",border:"1px solid var(--border)",borderRadius:6,padding:"4px 12px",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}>
              {breadcrumbDisplay.map((node,i)=>{
                if(node===null)return<span key="ellipsis" style={{fontSize:10,color:"var(--text-faint)",fontFamily:"monospace",margin:"0 2px"}}>› ...</span>;
                const isLast=i===breadcrumbDisplay.length-1;
                return<span key={node.id} style={{display:"flex",alignItems:"center"}}>
                  {i>0&&<span style={{fontSize:10,color:"var(--text-faint)",fontFamily:"monospace",margin:"0 4px"}}>›</span>}
                  <span onClick={()=>{setSel(node);if(view==='graph')setGraphPanTo({id:node.id,k:Date.now()});}} style={{fontSize:10,color:isLast?"var(--text-secondary)":"var(--text-muted)",fontFamily:"monospace",cursor:"pointer",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:160}} onMouseEnter={e=>{e.currentTarget.style.color="var(--text-primary)";}} onMouseLeave={e=>{e.currentTarget.style.color=isLast?"var(--text-secondary)":"var(--text-muted)";}}>
                    {node.name?.length>24?node.name.slice(0,22)+'\u2026':node.name}
                  </span>
                </span>;
              })}
            </div>
            {/* Shimmer transition */}
            {shimmer&&<div style={{position:"absolute",inset:0,top:56,zIndex:25,display:"flex",flexDirection:"column",gap:12,padding:"60px 30px"}}>
              <div style={{height:14,width:"35%",borderRadius:4,background:"linear-gradient(90deg,var(--bg-surface) 25%,var(--border) 50%,var(--bg-surface) 75%)",backgroundSize:"200% 100%",animation:"pshim .8s linear infinite"}}/>
              <div style={{height:300,borderRadius:8,background:"linear-gradient(90deg,var(--bg-surface) 25%,var(--border) 50%,var(--bg-surface) 75%)",backgroundSize:"200% 100%",animation:"pshim .8s linear infinite"}}/>
              <div style={{height:14,width:"55%",borderRadius:4,background:"linear-gradient(90deg,var(--bg-surface) 25%,var(--border) 50%,var(--bg-surface) 75%)",backgroundSize:"200% 100%",animation:"pshim .8s linear infinite"}}/>
            </div>}
            {/* Views */}
            <div style={{position:"absolute",inset:0,opacity:shimmer?0:1,transition:"opacity .25s ease"}}>
              {view==="graph"&&<NetGraph data={data} onSelect={onNodeSelect} sel={sel} onCloseSel={closeSel} onViewChain={onViewChain} rev={rev} onRev={doRev} chainRequest={chainRequest} onClearChainRequest={clearChainRequest} resetZoomKey={resetZoomKey} fitViewKey={fitViewKey} panTo={graphPanTo} attFilterMatch={attFilterMatch} supplierLabel={vertConfig.labels.supplierCardLabel} nodeTypeLabels={vertConfig.nodeTypeLabels} credits={credits} setCredits={setCredits} onEvaluationComplete={onEvalComplete} dataRev={dataRev} revealedSet={revealedSet} onRevealNode={onRevealNode} invitedSet={invitedSet} onInvite={onInvite} onRevokeInvite={onRevokeInvite} vert={vert} terminalTypes={vertConfig.terminalTypes} onRequirementsClick={()=>setRequirementsModalOpen(true)} highlightedEventNode={highlightedEventNode} eventsActive={eventsStage===2||eventsStage===3} onOpenSystemModal={handleOpenSystemModal} approvalStates={approvalStates} evidenceRequests={evidenceRequests}/>}
              {view==="map"&&<WorldMap data={data} onSelect={onNodeSelect} sel={sel} onCloseSel={closeSel} onViewChain={onViewChain} resetZoomKey={resetZoomKey} nodeTypeLabels={vertConfig.nodeTypeLabels} attFilterMatch={attFilterMatch}/>}
              {view==="risk"&&<RiskMatrix data={data} onSelect={onNodeSelect} sel={sel} resetZoomKey={resetZoomKey} riskMatrixTitle={vertConfig.labels.riskMatrixTitle} nodeTypeLabels={vertConfig.nodeTypeLabels} attFilterMatch={attFilterMatch}/>}
            </div>
            {/* Network Events Notification — only visible on graph tab */}
            {view==="graph"&&<NetworkEventsNotification events={networkEvents} onMarkAllRead={handleMarkAllRead} onEventClick={handleEventClick} onFocusNode={handleFocusNode} onHighlightNode={handleHighlightNode} onStageChange={handleEventsStageChange} nodes={allNodes} nodeTypeLabels={vertConfig.nodeTypeLabels}/>}
            {sel&&view!=="map"&&<div style={{position:"absolute",top:0,right:0,bottom:0,width:360,zIndex:45}}><DetailPanel node={sel} onClose={()=>{closeSel();setAutoOpenInvite(false);}} onViewChain={onViewChain} onSelect={onNodeSelect} nodeTypeLabels={vertConfig.nodeTypeLabels} credits={credits} setCredits={setCredits} onEvaluationComplete={onEvalComplete} invitedSet={invitedSet} onInvite={onInvite} onRevokeInvite={onRevokeInvite} vert={vert} terminalTypes={vertConfig.terminalTypes} autoOpenInvite={autoOpenInvite} onAutoOpenInviteConsumed={()=>setAutoOpenInvite(false)} onRequirementsClick={()=>setRequirementsModalOpen(true)} onOpenSystemModal={handleOpenSystemModal} onOpenEvalModal={handleOpenEvalModal} approvalStates={approvalStates} onApproveAsset={onApproveAsset} onRejectAsset={onRejectAsset} evidenceRequests={evidenceRequests} onSubmitEvidence={handleSubmitEvidence} onReviewEvidence={handleReviewEvidence} onRevokeSDA={onRevokeSDA} activityLog={activityLog} cascadeRequests={cascadeRequests} onCreateCascadeRequest={handleCreateCascadeRequest}/></div>}
            {!sel&&autoOpenInvite&&view!=="map"&&<StandaloneInvitePanel data={data} terminalTypes={vertConfig.terminalTypes} vertConfig={vertConfig} invitedSet={invitedSet} onInvite={onInvite} onSelectNode={n=>{setSel(n);}} onClose={()=>setAutoOpenInvite(false)} onCascade={handleCreateCascadeRequest}/>}
          </div>
        </div>
    }
    <Footer vert={vert} view={view} networkName={appMode==='supplier'?SUPPLIER_PERSONA.org:undefined} viewLabel={footerViewLabel}/>
    {appMode==='supplier'&&supplierActiveChain&&supplierChainData&&<SubgraphModal
      focusIds={supplierChainData.focusIds} centerId={supplierChainData.centerId} gN={supplierChainData.gN} gE={supplierChainData.gE} byId={{}}
      title={customerData?.find(cd=>cd.verticalKey===supplierActiveChain.verticalKey)?.customerName||''}
      subtitle={`${SUPPLIER_PERSONA.org} · SDA Level 3`}
      supplierHighlightId={supplierActiveChain.supplierNodeId}
      onSelect={setSupplierSel} sel={supplierSel} onCloseSel={()=>setSupplierSel(null)} onViewChain={null} onClose={handleCloseSupplierChain}
      rev={new Set()} onRev={()=>{}} initialZoom={0.5}
      credits={0} setCredits={()=>{}} onEvaluationComplete={()=>{}} nodeTypeLabels={getVerticalConfig(supplierActiveChain.verticalKey).nodeTypeLabels}
      dataRev={0} revealedSet={new Set()} onRevealNode={()=>{}} invitedSet={new Map()} onInvite={()=>{}} onRevokeInvite={()=>{}}
      vert={supplierActiveChain.verticalKey} terminalTypes={getVerticalConfig(supplierActiveChain.verticalKey).terminalTypes}
      onRequirementsClick={()=>{}} onOpenSystemModal={()=>{}}
      onOpenSDAModal={(node)=>{const cd=customerData?.find(c=>c.verticalKey===supplierActiveChain?.verticalKey);handleOpenSDAModal({id:node.id,label:node.name,type:node.type},cd?.customerName||'');}}
      onCreateDerivativeDisclosure={(node)=>{const latestEval=node.evaluations?.[node.evaluations.length-1]||null;setSdaModalPrefill({asset:{id:node.id,label:node.name,type:node.type},receiver:null});setSdaModalDerivativeEval(latestEval);setSdaModalOpen(true);}}
    />}
    {activeInvitation&&<InvitationModal invitation={activeInvitation} onAccept={handleAcceptInvitation} onDecline={handleDeclineInvitation} onClose={handleCloseInvitation} customerData={customerData} chainAsset={sdaChainContext?.asset||null} onCreateDisclosure={handleCreateDisclosure}/>}
    {showAttTest&&<AttestationTestPanel data={data} onClose={()=>setShowAttTest(false)}/>}
    {showCreditsModal&&<CreditsModal credits={credits} setCredits={setCredits} onClose={()=>setShowCreditsModal(false)}/>}
    <RequirementsLibraryModal isOpen={requirementsModalOpen} onClose={()=>setRequirementsModalOpen(false)} vertical={vertConfig}/>
    <SystemCreationModal isOpen={systemModalOpen} onClose={handleCloseSystemModal} vertical={vertConfig} onCreateSystem={handleCreateSystem} data={data} mode={systemModalMode} parentNode={systemModalParentNode}/>
    <AssetRegistrationModal isOpen={!!assetRegModal} invitation={assetRegModal?.invitation||null} onRegister={handleAssetRegistration} onClose={()=>setAssetRegModal(null)}/>
    <SDACreationModal isOpen={sdaModalOpen} onClose={()=>{setSdaModalOpen(false);setSdaModalDerivativeEval(null);}} onSubmit={handleSDASubmit} prefilledAsset={sdaModalPrefill.asset} prefilledReceiver={sdaModalPrefill.receiver} currentRole={appMode} networkOwnerName={customerData?.find(cd=>cd.verticalKey===supplierActiveChain?.verticalKey)?.customerName||''} supplierName={SUPPLIER_PERSONA.org} supplierAssets={supplierAssetsList} credits={supplierCredits} presetMode={sdaModalDerivativeEval?'derivative':null} presetEvaluation={sdaModalDerivativeEval} fromInvitation={!!sdaChainContext} presetType={sdaChainContext?.disclosureType||null}/>
    <EvaluationModal isOpen={evalModalOpen} node={evalModalNode} onClose={()=>{setEvalModalOpen(false);setEvalModalPresetChecklist(null);}} onComplete={handleEvalComplete} credits={credits} appMode={appMode} evidenceRequests={evidenceRequests} presetChecklistId={evalModalPresetChecklist}/>
    {standaloneAssetRegOpen&&<AssetRegistrationStandaloneModal onClose={()=>setStandaloneAssetRegOpen(false)} onRegister={handleStandaloneAssetReg}/>}
    {assetDirOpen&&<AssetDirectoryModal platformAssets={platformAssets} onClose={()=>setAssetDirOpen(false)} nodeTypeLabels={vertConfig.nodeTypeLabels} onRequestDisclosure={handleRequestDisclosure} disclosureRequests={disclosureRequests}/>}
  </div>;
}
