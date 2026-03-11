import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { TT } from '../data/tokens';
import { traceability, itarCount, countryBk, typeBk, singleSourceNodes, itarNodes } from '../data/dataset';
import NodeIcon from './NodeIcon';
import SvgMark from './SvgMark';

const TYPE_ORDER = ['rawsource','material','chemical','process','component','subassembly','assembly','system'];
const SVG_W=640,SVG_H=400,SVG_P=56;
const DEF_VB={x:0,y:0,w:SVG_W+SVG_P*2,h:SVG_H+SVG_P*2};
const MAX_ZOOM_STEPS=12,MIN_VB_W=DEF_VB.w*Math.pow(.75,MAX_ZOOM_STEPS),MIN_VB_H=DEF_VB.h*Math.pow(.75,MAX_ZOOM_STEPS);
const LIST_SHOW=12;const LIST_EXP_H=432; // 18 rows × 24px

const REF_T = new Date('2026-02-17').getTime();
const MS_D = 86400000;

/* Status color for worst attestation state */
const STATUS_C = { red: 'var(--accent-red)', amber: 'var(--accent-amber)', green: 'var(--accent-green)' };

export default function RiskMatrix({data,onSelect,sel,resetZoomKey,riskMatrixTitle,nodeTypeLabels,attFilterMatch}){
  const suppliers=useMemo(()=>{const l=[];function w(n){if(n.type!=="customer"&&n.type!=="system")l.push(n);if(n.children)n.children.forEach(w);}w(data);return l;},[data]);
  const usedTypes=useMemo(()=>{const s=new Set();suppliers.forEach(n=>s.add(n.type));return Object.keys(TT).filter(k=>s.has(k));},[suppliers]);

  /* ═══ Attestation-based scoring ═══ */
  const scored=useMemo(()=>{
    let minDays=Infinity, maxDays=-Infinity;

    const entries=suppliers.map((s,i)=>{
      const raw=s.rawAttestations||[];

      /* X-axis: freshness — days since most recent attestation timestamp */
      let mostRecent=REF_T-365*MS_D; // default 1yr ago if no attestations
      for(const a of raw){const t=new Date(a.timestamp).getTime();if(t>mostRecent)mostRecent=t;}
      const daysSince=(REF_T-mostRecent)/MS_D;
      if(daysSince<minDays)minDays=daysSince;
      if(daysSince>maxDays)maxDays=daysSince;

      /* Y-axis: claim confidence — weighted ratio (contested/revoked=0, expired=0.3, pending=0.5, verified=1) */
      let confSum=0;
      for(const a of raw){
        if(a.status==='verified')confSum+=1;
        else if(a.status==='pending')confSum+=.5;
        else if(a.status==='expired')confSum+=.3;
        // contested, revoked = 0
      }
      const confidence=raw.length>0?confSum/raw.length:.5;

      /* Worst status for dot color */
      let worst='green';
      for(const a of raw){
        if(a.status==='contested'||a.status==='revoked'){worst='red';break;}
        if(a.status==='expired'||a.status==='pending')worst='amber';
      }

      /* Deterministic jitter to separate overlapping dots */
      const jx=Math.sin(i*7.13)*8;
      const jy=Math.cos(i*11.17)*8;

      return{...s,daysSince,confidence,worst,attCount:raw.length,jx,jy};
    });

    /* Normalize freshness to 0-1 */
    const range=maxDays-minDays||1;
    return entries.map(e=>({...e,freshness:(e.daysSince-minDays)/range}));
  },[suppliers]);

  const[hovDot,setHovDot]=useState(null);
  const[selDot,setSelDot]=useState(null); // persistent selected dot index
  const[expList,setExpList]=useState({});
  const togList=useCallback(key=>setExpList(p=>({...p,[key]:!p[key]})),[]);
  const[hovRow,setHovRow]=useState(null);

  // Scatter plot zoom
  const W=SVG_W,H=SVG_H,P=SVG_P;
  const[vb,setVb]=useState(DEF_VB);
  const invZoom=vb.w/DEF_VB.w; // <1 zoomed in, >1 zoomed out
  const isZoomed=vb.w<DEF_VB.w-1;
  const isMaxZoom=vb.w<=MIN_VB_W+.1;
  const zoomIn=useCallback(()=>setVb(v=>{const nw=Math.max(v.w*.75,MIN_VB_W),nh=Math.max(v.h*.75,MIN_VB_H);if(nw>=v.w)return v;return{x:v.x+(v.w-nw)/2,y:v.y+(v.h-nh)/2,w:nw,h:nh};}),[]);
  const zoomOut=useCallback(()=>setVb(v=>{const nw=Math.min(v.w/.75,DEF_VB.w),nh=Math.min(v.h/.75,DEF_VB.h);if(nw>=DEF_VB.w)return DEF_VB;return{x:v.x+(v.w-nw)/2,y:v.y+(v.h-nh)/2,w:nw,h:nh};}),[]);
  const zoomReset=useCallback(()=>setVb(DEF_VB),[]);

  // Keyboard zoom reset
  useEffect(()=>{if(resetZoomKey>0)setVb(DEF_VB);},[resetZoomKey]);

  // Drag pan state
  const svgRef=useRef(null);
  const dragRef=useRef({active:false,startX:0,startY:0,vbX:0,vbY:0,wasDrag:false});

  const onSvgMD=useCallback(e=>{
    if(e.button!==0||!isZoomed)return;
    e.preventDefault();
    dragRef.current={active:true,startX:e.clientX,startY:e.clientY,vbX:vb.x,vbY:vb.y,wasDrag:false};
  },[isZoomed,vb]);

  const onSvgMM=useCallback(e=>{
    const d=dragRef.current;if(!d.active)return;
    const svg=svgRef.current;if(!svg)return;
    const rect=svg.getBoundingClientRect();
    // Convert screen px movement to viewBox coord movement
    const scaleX=vb.w/rect.width, scaleY=vb.h/rect.height;
    const dx=(e.clientX-d.startX)*scaleX;
    const dy=(e.clientY-d.startY)*scaleY;
    if(Math.abs(e.clientX-d.startX)>3||Math.abs(e.clientY-d.startY)>3)d.wasDrag=true;
    // Clamp pan so viewBox stays within DEF_VB bounds
    const nx=Math.max(DEF_VB.x,Math.min(DEF_VB.x+DEF_VB.w-vb.w,d.vbX-dx));
    const ny=Math.max(DEF_VB.y,Math.min(DEF_VB.y+DEF_VB.h-vb.h,d.vbY-dy));
    setVb(v=>({...v,x:nx,y:ny}));
  },[vb]);

  const onSvgMU=useCallback(()=>{dragRef.current.active=false;},[]);

  // Global mousemove/mouseup for drag (so dragging outside SVG still works)
  useEffect(()=>{
    if(!isZoomed)return;
    const mm=e=>{onSvgMM(e);};
    const mu=()=>{onSvgMU();};
    window.addEventListener('mousemove',mm);
    window.addEventListener('mouseup',mu);
    return()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);};
  },[isZoomed,onSvgMM,onSvgMU]);

  // Wheel zoom — cursor-centered, same step as +/- buttons
  useEffect(()=>{
    const svg=svgRef.current;if(!svg)return;
    const handler=e=>{
      e.preventDefault();
      const rect=svg.getBoundingClientRect();
      const fracX=(e.clientX-rect.left)/rect.width;
      const fracY=(e.clientY-rect.top)/rect.height;
      setVb(v=>{
        const factor=e.deltaY>0?1/0.75:0.75; // scroll down=zoom out, up=zoom in
        const nw=Math.max(Math.min(v.w*factor,DEF_VB.w),MIN_VB_W);
        const nh=Math.max(Math.min(v.h*factor,DEF_VB.h),MIN_VB_H);
        if(nw>=DEF_VB.w)return DEF_VB;
        // Mouse position in current viewBox
        const mx=v.x+fracX*v.w, my=v.y+fracY*v.h;
        // Keep mouse position fixed in viewport
        const nx=mx-fracX*nw, ny=my-fracY*nh;
        // Clamp within DEF_VB
        const cx=Math.max(DEF_VB.x,Math.min(DEF_VB.x+DEF_VB.w-nw,nx));
        const cy=Math.max(DEF_VB.y,Math.min(DEF_VB.y+DEF_VB.h-nh,ny));
        return{x:cx,y:cy,w:nw,h:nh};
      });
    };
    svg.addEventListener('wheel',handler,{passive:false});
    return()=>svg.removeEventListener('wheel',handler);
  },[]);

  // Click handlers
  const onDotClick=useCallback((e,s,i)=>{
    e.stopPropagation();
    if(dragRef.current.wasDrag)return;
    setSelDot(i);
    setHovDot(i);
    if(onSelect)onSelect(s);
  },[onSelect]);

  const onBgClick=useCallback(()=>{
    if(dragRef.current.wasDrag)return;
    setSelDot(null);setHovDot(null);
  },[]);

  // Clear selDot when external selection changes
  useEffect(()=>{
    if(!sel)setSelDot(null);
  },[sel]);

  /* ═══ Summary stats ═══ */
  const st=useMemo(()=>{
    /* Attestation health — walk tree counting by status */
    const ah={verified:0,expired:0,contested:0,revoked:0,pending:0,total:0};
    const abt={}; // { [nodeType]: { verified, other, total } }
    const disputed=[];  // nodes with any contested/revoked
    const expiring=[];  // nodes with verified claims expiring ≤180 days
    const unevaluated=[]; let evalTotal=0;

    function walkA(n){
      if(n.type!=='customer'&&n.type!=='system'){
        const raw=n.rawAttestations||[];
        if(!abt[n.type])abt[n.type]={verified:0,other:0,total:0};
        let hasBad=false, hasExp=false, hasEvalAtt=false;
        for(const a of raw){
          ah[a.status]=(ah[a.status]||0)+1;
          ah.total++;
          if(a.status==='verified'){abt[n.type].verified++;}else{abt[n.type].other++;}
          abt[n.type].total++;
          if(a.status==='contested'||a.status==='revoked')hasBad=true;
          if(a.status==='verified'&&a.validUntil){
            const diff=(new Date(a.validUntil).getTime()-REF_T)/MS_D;
            if(diff>0&&diff<=180)hasExp=true;
          }
          if(a.predicate==='evaluated_against_requirements')hasEvalAtt=true;
        }
        if(hasBad)disputed.push(n);
        if(hasExp)expiring.push(n);
        evalTotal++;if(!hasEvalAtt)unevaluated.push(n);
      }
      if(n.children)n.children.forEach(walkA);
    }
    walkA(data);

    /* Existing structural stats */
    const tr=traceability(data);const it=itarCount(data);
    const co=countryBk(data);const tb=typeBk(data);
    const countries=Object.entries(co).sort((a,b)=>b[1]-a[1]);
    const total=Object.values(co).reduce((a,b)=>a+b,0);
    const ss=singleSourceNodes(data);const itarN=itarNodes(data);

    return{ah,abt,disputed,expiring,tr,it,countries,total,cc:countries.length,tb,ss,itarN,evalTotal,evalCount:evalTotal-unevaluated.length,unevaluated};
  },[data]);

  /* ═══ Filtered summary stats (sidebar filter reactivity) ═══ */
  const fst=useMemo(()=>{
    if(!attFilterMatch)return st;
    const ah={verified:0,expired:0,contested:0,revoked:0,pending:0,total:0};
    const abt={};
    const disputed=[];const expiring=[];const unevaluated=[];let evalTotal=0;
    function walkF(n){
      if(n.type!=='customer'&&n.type!=='system'&&attFilterMatch.has(n.id)){
        const raw=n.rawAttestations||[];
        if(!abt[n.type])abt[n.type]={verified:0,other:0,total:0};
        let hasBad=false,hasExp=false,hasEvalAtt=false;
        for(const a of raw){
          ah[a.status]=(ah[a.status]||0)+1;ah.total++;
          if(a.status==='verified'){abt[n.type].verified++;}else{abt[n.type].other++;}
          abt[n.type].total++;
          if(a.status==='contested'||a.status==='revoked')hasBad=true;
          if(a.status==='verified'&&a.validUntil){const diff=(new Date(a.validUntil).getTime()-REF_T)/MS_D;if(diff>0&&diff<=180)hasExp=true;}
          if(a.predicate==='evaluated_against_requirements')hasEvalAtt=true;
        }
        if(hasBad)disputed.push(n);if(hasExp)expiring.push(n);
        evalTotal++;if(!hasEvalAtt)unevaluated.push(n);
      }
      if(n.children)n.children.forEach(walkF);
    }
    walkF(data);
    const filteredSuppliers=[];function walkS(n){if(n.type!=='customer'&&n.type!=='system'&&attFilterMatch.has(n.id))filteredSuppliers.push(n);if(n.children)n.children.forEach(walkS);}walkS(data);
    const tr=traceability(data);const it=itarCount(data);
    const co={};filteredSuppliers.forEach(n=>{if(n.location){const c=n.location.split(",").pop().trim();if(c)co[c]=(co[c]||0)+1;}});
    const countries=Object.entries(co).sort((a,b)=>b[1]-a[1]);const total=countries.reduce((s,[,c])=>s+c,0);
    const tb={};filteredSuppliers.forEach(n=>{tb[n.type]=(tb[n.type]||0)+1;});
    const ss=singleSourceNodes(data).filter(n=>attFilterMatch.has(n.id));
    const itarN=itarNodes(data).filter(n=>attFilterMatch.has(n.id));
    return{ah,abt,disputed,expiring,tr,it:itarN.length,countries,total,cc:countries.length,tb,ss,itarN,evalTotal,evalCount:evalTotal-unevaluated.length,unevaluated};
  },[data,attFilterMatch,st]);

  const panelOpen=!!sel;
  const cardStyle={background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:8,padding:16};
  const headerStyle={fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".08em",marginBottom:12,fontWeight:700};
  const bigNum=c=>({fontSize:26,fontWeight:700,color:c,fontFamily:"var(--font-mono)",lineHeight:1.1});
  const bigLabel={fontSize:10,color:"var(--text-tertiary)",fontFamily:"monospace",marginTop:2};
  const barBg={height:4,background:"var(--bg-app-header)",borderRadius:2,overflow:"hidden"};
  const rowBase={display:"flex",alignItems:"center",gap:8,padding:"3px 4px",borderRadius:4,marginBottom:2};
  const clickRow={...rowBase,cursor:"pointer",transition:"background .12s"};

  // Determine which dot to show tooltip for (persistent selection takes priority)
  const tooltipIdx=selDot!==null?selDot:hovDot;

  return <div style={{width:panelOpen?"calc(100% - 370px)":"100%",height:"100%",overflow:"auto",padding:"20px 30px",transition:"width .25s"}}>
    {/* Title */}
    <div style={{fontSize:13,fontWeight:700,color:"var(--text-secondary)",fontFamily:"var(--font-mono)",marginTop:36,marginBottom:16,letterSpacing:".04em",display:"flex",alignItems:"center",gap:8}}>{riskMatrixTitle||"SUPPLY CHAIN RISK MATRIX"}{attFilterMatch&&<span style={{fontSize:8,fontWeight:700,color:"var(--accent-indigo)",background:"var(--accent-indigo-bg)",padding:"2px 6px",borderRadius:3,letterSpacing:".04em",border:"1px solid color-mix(in srgb, var(--accent-indigo) 20%, transparent)"}}>FILTERED · {attFilterMatch.size} of {suppliers.length}</span>}</div>

    {/* Scatter plot area */}
    <div style={{position:"relative",marginBottom:8,overflow:"hidden"}}>
      {scored.length===0&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,pointerEvents:"none"}}><span style={{fontSize:13,color:"var(--text-tertiary)",fontFamily:"monospace",lineHeight:1.5,textAlign:"center",maxWidth:400}}>To see risk analysis, create new {(nodeTypeLabels?.program||'Program')}s, add Systems, and invite Suppliers to register assets on your network.</span></div>}
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} width="100%" height="640" style={{display:"block",cursor:isZoomed?(dragRef.current.active?"grabbing":"grab"):"default",userSelect:"none",WebkitUserSelect:"none"}} preserveAspectRatio="xMidYMid meet"
        onMouseDown={onSvgMD} onClick={onBgClick}>
        {/* Quadrant backgrounds */}
        <rect x={P} y={P} width={W/2} height={H/2} fill="color-mix(in srgb, var(--accent-amber-bg) 2%, transparent)"/>
        <rect x={P+W/2} y={P} width={W/2} height={H/2} fill="color-mix(in srgb, var(--accent-green-bg) 2%, transparent)"/>
        <rect x={P} y={P+H/2} width={W/2} height={H/2} fill="color-mix(in srgb, var(--accent-red-bg) 3%, transparent)"/>
        <rect x={P+W/2} y={P+H/2} width={W/2} height={H/2} fill="color-mix(in srgb, var(--accent-red-bg) 2%, transparent)"/>
        {/* Grid lines */}
        {[.25,.5,.75].map(v=><g key={v}><line x1={P+v*W} y1={P} x2={P+v*W} y2={P+H} stroke="var(--border)" strokeWidth=".5" strokeDasharray="4,6" vectorEffect="non-scaling-stroke"/><line x1={P} y1={P+v*H} x2={P+W} y2={P+v*H} stroke="var(--border)" strokeWidth=".5" strokeDasharray="4,6" vectorEffect="non-scaling-stroke"/></g>)}
        <line x1={P+W/2} y1={P} x2={P+W/2} y2={P+H} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke"/><line x1={P} y1={P+H/2} x2={P+W} y2={P+H/2} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
        <line x1={P} y1={P+H} x2={P+W} y2={P+H} stroke="var(--border)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><line x1={P} y1={P} x2={P} y2={P+H} stroke="var(--border)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
        {/* Quadrant labels */}
        {(()=>{const iz=invZoom;return<>
          <text x={isZoomed?vb.x+12*iz:P+W/4} y={isZoomed?vb.y+16*iz:P+26} fontSize={11*iz} fill="color-mix(in srgb, var(--accent-amber) 13%, transparent)" textAnchor={isZoomed?"start":"middle"} fontFamily="monospace" fontWeight="700">STALE BUT TRUSTED</text>
          <text x={isZoomed?vb.x+vb.w-12*iz:P+W*3/4} y={isZoomed?vb.y+16*iz:P+26} fontSize={11*iz} fill="color-mix(in srgb, var(--accent-green) 13%, transparent)" textAnchor={isZoomed?"end":"middle"} fontFamily="monospace" fontWeight="700">FRESH & TRUSTED</text>
          <text x={isZoomed?vb.x+12*iz:P+W/4} y={isZoomed?vb.y+vb.h-10*iz:P+H-14} fontSize={11*iz} fill="color-mix(in srgb, var(--accent-red) 13%, transparent)" textAnchor={isZoomed?"start":"middle"} fontFamily="monospace" fontWeight="700">STALE & DISPUTED</text>
          <text x={isZoomed?vb.x+vb.w-12*iz:P+W*3/4} y={isZoomed?vb.y+vb.h-10*iz:P+H-14} fontSize={11*iz} fill="color-mix(in srgb, var(--accent-amber) 13%, transparent)" textAnchor={isZoomed?"end":"middle"} fontFamily="monospace" fontWeight="700">FRESH BUT DISPUTED</text>
        </>;})()}
        {/* Data dots */}
        {scored.map((s,i)=>{const cx=P+(1-s.freshness)*W+s.jx,cy=P+(1-s.confidence)*H+s.jy;const isH=hovDot===i||selDot===i;const isSel=selDot===i;
          const dotC=STATUS_C[s.worst];
          const baseR=4+Math.min(2,s.attCount/5);
          const dimDot=attFilterMatch&&!attFilterMatch.has(s.id);
          return <g key={i} onMouseEnter={()=>{if(selDot===null)setHovDot(i);}} onMouseLeave={()=>{if(selDot===null)setHovDot(null);}} onClick={e=>{if(!dimDot)onDotClick(e,s,i);}} style={{cursor:dimDot?"default":"pointer",opacity:dimDot?.1:1,transition:"opacity .2s",pointerEvents:dimDot?"none":"auto"}}>
            {isSel&&<circle cx={cx} cy={cy} r={18*invZoom} fill="none" stroke="var(--accent-indigo)" strokeWidth={2*invZoom} opacity={.6}/>}
            <circle cx={cx} cy={cy} r={(isH?baseR*2:baseR*1.4)*invZoom} fill={dotC} opacity={isH?".15":".06"}/>
            <SvgMark type={s.type} cx={cx} cy={cy} r={(isH?baseR+2:baseR)*invZoom} nonScaling/>
            {/* Status accent ring */}
            <circle cx={cx} cy={cy} r={(isH?baseR+2:baseR)*invZoom*.95} fill="none" stroke={dotC} strokeWidth={1.2*invZoom} opacity={isH?.7:.35} vectorEffect="non-scaling-stroke"/>
          </g>;})}
        {/* Tooltip (persistent or hover) */}
        {tooltipIdx!==null&&(()=>{const s=scored[tooltipIdx];const cx=P+(1-s.freshness)*W+s.jx,cy=P+(1-s.confidence)*H+s.jy;
          const dotC=STATUS_C[s.worst];
          const statusLabel=s.worst==='red'?'Disputed':s.worst==='amber'?'Issues detected':'All verified';
          return <g style={{pointerEvents:"none"}} transform={`translate(${cx},${cy}) scale(${invZoom}) translate(${-cx},${-cy})`}>
            <rect x={cx+14} y={cy-28} width={175} height={42} rx={5} fill="var(--bg-surface)" stroke="var(--border)" strokeWidth="1"/>
            <text x={cx+22} y={cy-12} fontSize="10" fill="var(--text-bright)" fontWeight="600">{s.name}</text>
            <text x={cx+22} y={cy} fontSize="8.5" fill="var(--text-secondary)" fontFamily="monospace">{s.supplier}</text>
            <text x={cx+22} y={cy+10} fontSize="7.5" fill={dotC} fontFamily="monospace">{s.attCount} claims · {statusLabel}</text>
          </g>;})()}
      </svg>
      {/* HTML axis labels */}
      <div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",pointerEvents:"none",zIndex:5}}>
        <span style={{fontSize:10,color:"var(--text-tertiary)",fontFamily:"monospace",background:"var(--bg-deep)",padding:"3px 10px",borderRadius:4}}>{'\u2190'} STALE · · · FRESH {'\u2192'}</span>
      </div>
      <div style={{position:"absolute",left:4,top:"50%",transform:"translateY(-50%) rotate(-90deg)",transformOrigin:"center center",pointerEvents:"none",zIndex:5}}>
        <span style={{fontSize:10,color:"var(--text-tertiary)",fontFamily:"monospace",background:"var(--bg-deep)",padding:"3px 10px",borderRadius:4}}>CLAIM CONFIDENCE {'\u2192'}</span>
      </div>
      {/* Zoom controls */}
      <div style={{position:"absolute",top:8,right:8,display:"flex",flexDirection:"column",gap:2,zIndex:6}}>
        {[{l:"+",fn:zoomIn,dis:isMaxZoom},{l:"\u2212",fn:zoomOut},{l:"\u27F3",fn:zoomReset}].map(b=><button key={b.l} onClick={b.dis?undefined:b.fn} style={{width:26,height:26,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:4,color:b.dis?"var(--border-hover)":"var(--text-secondary)",cursor:b.dis?"default":"pointer",fontSize:14,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",padding:0,opacity:b.dis?.4:1}}>{b.l}</button>)}
      </div>
    </div>

    {/* Legend — status colors + type marks */}
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:6}}>
      {[{c:'var(--accent-green)',l:'All Verified'},{c:'var(--accent-amber)',l:'Expired / Pending'},{c:'var(--accent-red)',l:'Contested / Revoked'}].map(s=><div key={s.l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:"50%",background:s.c,opacity:.35,border:`1.5px solid ${s.c}`}}/><span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace"}}>{s.l}</span></div>)}
    </div>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:20}}>
      {usedTypes.map(k=>{const v=TT[k]||TT.component;return<div key={k} style={{display:"flex",alignItems:"center",gap:4}}><NodeIcon type={k} size={12}/><span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace"}}>{nodeTypeLabels?.[k]||v.label}</span></div>;})}
    </div>

    {/* ═══════════ Data panels grid ═══════════ */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16,paddingBottom:40}}>

      {/* Panel 1: Attestation Health */}
      <div style={cardStyle}>
        <div style={headerStyle}>ATTESTATION HEALTH</div>
        <div style={{display:"flex",gap:12,marginBottom:14}}>
          {[{k:'verified',l:'Verified',c:'var(--accent-green)'},{k:'expired',l:'Expired',c:'var(--accent-amber)'},{k:'pending',l:'Pending',c:'var(--text-tertiary)'},{k:'contested',l:'Contested',c:'var(--accent-red)'},{k:'revoked',l:'Revoked',c:'var(--accent-red)'}].map(x=><div key={x.k} style={{textAlign:"center",flex:1}}>
            <div style={{fontSize:22,fontWeight:700,color:x.c,fontFamily:"var(--font-mono)"}}>{fst.ah[x.k]||0}</div>
            <div style={{fontSize:9,color:x.c,opacity:.7}}>{x.l}</div>
          </div>)}
        </div>
        {fst.ah.total>0&&<div style={{...barBg,height:6,display:"flex",marginBottom:14}}>
          <div style={{height:"100%",width:`${Math.round(fst.ah.verified/fst.ah.total*100)}%`,background:"var(--accent-green)",borderRadius:"2px 0 0 2px"}}/>
          {(fst.ah.expired+fst.ah.pending)>0&&<div style={{height:"100%",width:`${Math.round((fst.ah.expired+fst.ah.pending)/fst.ah.total*100)}%`,background:"var(--accent-amber)",opacity:.6}}/>}
          {(fst.ah.contested+fst.ah.revoked)>0&&<div style={{height:"100%",width:`${Math.round((fst.ah.contested+fst.ah.revoked)/fst.ah.total*100)}%`,background:"var(--accent-red)",borderRadius:"0 2px 2px 0"}}/>}
        </div>}
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".06em",marginBottom:8}}>HEALTH BY TIER</div>
        {TYPE_ORDER.filter(t=>fst.abt[t]).map(t=>{const d=fst.abt[t];const pct=d.total>0?Math.round(d.verified/d.total*100):0;const barC=pct<50?"var(--accent-red)":pct<80?"var(--accent-amber)":"var(--accent-green)";
          return <div key={t} style={{...rowBase,marginBottom:4}}>
            <NodeIcon type={t} size={11}/>
            <span style={{fontSize:9,color:(TT[t]||TT.component).text,width:75,flexShrink:0}}>{(TT[t]||TT.component).label}</span>
            <div style={{flex:1,...barBg}}><div style={{height:"100%",width:`${pct}%`,background:barC,borderRadius:2,minWidth:pct>0?2:0}}/></div>
            <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",width:50,textAlign:"right",flexShrink:0}}>{d.verified}/{d.total}</span>
          </div>;})}
      </div>

      {/* Panel 2: Disputed Claims */}
      <div style={cardStyle}>
        <div style={headerStyle}>DISPUTED CLAIMS</div>
        <div style={bigNum(fst.disputed.length>0?"var(--accent-red)":"var(--accent-green)")}>{fst.disputed.length}</div>
        <div style={bigLabel}>nodes with contested / revoked claims{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div>
        <div style={{marginTop:14,maxHeight:expList.disp?LIST_EXP_H:undefined,overflowY:expList.disp?"auto":undefined}}>
          {fst.disputed.length===0
            ?<div style={{fontSize:11,color:"var(--accent-green)",fontFamily:"monospace"}}>No disputed claims detected {'\u2713'}</div>
            :(fst.disputed.length>LIST_SHOW&&!expList.disp?fst.disputed.slice(0,LIST_SHOW):fst.disputed).map(n=>{const rk=`disp-${n.id}`;const isH=hovRow===rk;
              const raw=n.rawAttestations||[];const bad=raw.filter(a=>a.status==='contested'||a.status==='revoked').length;
              return <div key={n.id}
                onClick={()=>onSelect(n)} onMouseEnter={()=>setHovRow(rk)} onMouseLeave={()=>setHovRow(null)}
                style={{...clickRow,background:isH?"var(--bg-raised)":"transparent"}}>
                <span style={{fontSize:8,background:"var(--accent-red-bg)",color:"var(--accent-red)",padding:"1px 5px",borderRadius:3,fontWeight:700,fontFamily:"monospace",flexShrink:0}}>{bad}{'\u2717'}</span>
                <NodeIcon type={n.type} size={12}/>
                <span style={{fontSize:10,color:(TT[n.type]||TT.component).text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</span>
                <span style={{fontSize:9,color:"var(--text-secondary)",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{n.supplier}</span>
              </div>;})}
        </div>
        {fst.disputed.length>LIST_SHOW&&<button onClick={()=>togList("disp")} style={{background:"none",border:"none",color:"var(--accent-red)",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"6px 0"}}>{expList.disp?"Show less \u2191":`Show all ${fst.disputed.length} \u2192`}</button>}
      </div>

      {/* Panel 3: Chain Completeness */}
      <div style={cardStyle}>
        <div style={headerStyle}>CHAIN COMPLETENESS</div>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}>
            <span style={bigNum("var(--accent-cyan)")}>{fst.tr.ad}%</span>
            <span style={{fontSize:10,color:"var(--text-secondary)"}}>Active Depth</span>
          </div>
          <div style={barBg}><div style={{height:"100%",width:`${fst.tr.ad}%`,background:"linear-gradient(90deg,#22d3ee,#3b82f6)",borderRadius:2}}/></div>
          <div style={{fontSize:9,color:"var(--text-muted)",marginTop:3,fontFamily:"monospace"}}>{fst.tr.raw} of {fst.tr.raw+fst.tr.other} {'\u2192'} Raw Source</div>
        </div>
        <div>
          <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}>
            <span style={bigNum("var(--accent-indigo)")}>{fst.tr.nc}%</span>
            <span style={{fontSize:10,color:"var(--text-secondary)"}}>Coverage</span>
          </div>
          <div style={barBg}><div style={{height:"100%",width:`${fst.tr.nc}%`,background:"linear-gradient(90deg,#818cf8,#6366f1)",borderRadius:2}}/></div>
          <div style={{fontSize:9,color:"var(--text-muted)",marginTop:3,fontFamily:"monospace"}}>{fst.tr.ph} nodes pending</div>
        </div>
      </div>

      {/* Panel 4: Evaluation Coverage */}
      <div style={cardStyle}>
        <div style={headerStyle}>EVALUATION COVERAGE</div>
        <div style={{display:"flex",gap:16,marginBottom:14}}>
          <div><div style={bigNum(fst.evalCount===fst.evalTotal?"var(--accent-green)":"var(--accent-indigo)")}>{fst.evalCount}<span style={{fontSize:14,color:"var(--text-tertiary)"}}>/{fst.evalTotal}</span></div><div style={bigLabel}>nodes evaluated{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div></div>
          <div><div style={bigNum(fst.unevaluated.length>0?"var(--accent-amber)":"var(--accent-green)")}>{fst.evalTotal>0?Math.round(fst.evalCount/fst.evalTotal*100):0}%</div><div style={bigLabel}>coverage</div></div>
        </div>
        {fst.evalTotal>0&&<div style={{...barBg,height:6,display:"flex",marginBottom:14}}>
          <div style={{height:"100%",width:`${Math.round(fst.evalCount/fst.evalTotal*100)}%`,background:"var(--accent-indigo)",borderRadius:"2px 0 0 2px"}}/>
          <div style={{height:"100%",width:`${Math.round(fst.unevaluated.length/fst.evalTotal*100)}%`,background:"var(--border-hover)",borderRadius:"0 2px 2px 0"}}/>
        </div>}
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".06em",marginBottom:8}}>UNEVALUATED NODES</div>
        <div style={{marginTop:4,maxHeight:expList.eval?LIST_EXP_H:undefined,overflowY:expList.eval?"auto":undefined}}>
          {fst.unevaluated.length===0
            ?<div style={{fontSize:11,color:"var(--accent-green)",fontFamily:"monospace"}}>All nodes evaluated {'\u2713'}</div>
            :(fst.unevaluated.length>LIST_SHOW&&!expList.eval?fst.unevaluated.slice(0,LIST_SHOW):fst.unevaluated).map(n=>{const rk=`eval-${n.id}`;const isH=hovRow===rk;
              return <div key={n.id}
                onClick={()=>onSelect(n)} onMouseEnter={()=>setHovRow(rk)} onMouseLeave={()=>setHovRow(null)}
                style={{...clickRow,background:isH?"var(--bg-raised)":"transparent"}}>
                <span style={{fontSize:8,background:"var(--accent-indigo-bg)",color:"var(--accent-indigo)",padding:"1px 5px",borderRadius:3,fontWeight:700,fontFamily:"monospace",flexShrink:0}}>?</span>
                <NodeIcon type={n.type} size={12}/>
                <span style={{fontSize:10,color:(TT[n.type]||TT.component).text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</span>
                <span style={{fontSize:9,color:"var(--text-secondary)",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{n.supplier}</span>
              </div>;})}
        </div>
        {fst.unevaluated.length>LIST_SHOW&&<button onClick={()=>togList("eval")} style={{background:"none",border:"none",color:"var(--accent-indigo)",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"6px 0"}}>{expList.eval?"Show less \u2191":`Show all ${fst.unevaluated.length} \u2192`}</button>}
      </div>

      {/* Panel 5: Single-Source Dependencies */}
      <div style={cardStyle}>
        <div style={headerStyle}>SINGLE-SOURCE DEPENDENCIES</div>
        <div style={bigNum(fst.ss.length>0?"var(--accent-amber)":"var(--accent-green)")}>{fst.ss.length}</div>
        <div style={bigLabel}>single-source nodes{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div>
        <div style={{marginTop:14,maxHeight:expList.ss?LIST_EXP_H:undefined,overflowY:expList.ss?"auto":undefined}}>
          {fst.ss.length===0
            ?<div style={{fontSize:11,color:"var(--accent-green)",fontFamily:"monospace"}}>No single-source dependencies detected {'\u2713'}</div>
            :(fst.ss.length>LIST_SHOW&&!expList.ss?fst.ss.slice(0,LIST_SHOW):fst.ss).map(n=>{const rk=`ss-${n.id}`;const isH=hovRow===rk;return <div key={n.id}
              onClick={()=>onSelect(n)} onMouseEnter={()=>setHovRow(rk)} onMouseLeave={()=>setHovRow(null)}
              style={{...clickRow,background:isH?"var(--bg-raised)":"transparent"}}>
              <NodeIcon type={n.type} size={12}/>
              <span style={{fontSize:10,color:(TT[n.type]||TT.component).text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</span>
              <span style={{fontSize:9,color:"var(--text-secondary)",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{n.supplier}</span>
              {n.notes&&<span style={{fontSize:9,color:"var(--text-muted)",fontFamily:"monospace",flexShrink:0,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.notes}</span>}
            </div>;})}
        </div>
        {fst.ss.length>LIST_SHOW&&<button onClick={()=>togList("ss")} style={{background:"none",border:"none",color:"var(--accent-amber)",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"6px 0"}}>{expList.ss?"Show less \u2191":`Show all ${fst.ss.length} \u2192`}</button>}
      </div>

      {/* Panel 6: ITAR Controlled */}
      {fst.itarN.length>0&&<div style={cardStyle}>
        <div style={headerStyle}>ITAR CONTROLLED</div>
        <div style={bigNum("var(--accent-red)")}>{fst.it}</div>
        <div style={bigLabel}>ITAR restricted{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div>
        <div style={{marginTop:14,maxHeight:expList.itar?LIST_EXP_H:undefined,overflowY:expList.itar?"auto":undefined}}>
          {(fst.itarN.length>LIST_SHOW&&!expList.itar?fst.itarN.slice(0,LIST_SHOW):fst.itarN).map(n=>{const rk=`itar-${n.id}`;const isH=hovRow===rk;return <div key={n.id}
            onClick={()=>onSelect(n)} onMouseEnter={()=>setHovRow(rk)} onMouseLeave={()=>setHovRow(null)}
            style={{...clickRow,background:isH?"var(--bg-raised)":"transparent"}}>
            <NodeIcon type={n.type} size={12}/>
            <span style={{fontSize:10,color:(TT[n.type]||TT.component).text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</span>
            <span style={{fontSize:9,color:"var(--text-secondary)",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{n.supplier}</span>
            <span style={{fontSize:9,color:"var(--text-muted)",fontFamily:"monospace",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{n.location}</span>
          </div>;})}
        </div>
        {fst.itarN.length>LIST_SHOW&&<button onClick={()=>togList("itar")} style={{background:"none",border:"none",color:"var(--accent-red)",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"6px 0"}}>{expList.itar?"Show less \u2191":`Show all ${fst.itarN.length} \u2192`}</button>}
      </div>}

      {/* Panel 7: Expiring Claims */}
      <div style={cardStyle}>
        <div style={headerStyle}>EXPIRING CLAIMS</div>
        <div style={bigNum(fst.expiring.length>0?"var(--accent-amber)":"var(--accent-green)")}>{fst.expiring.length}</div>
        <div style={bigLabel}>nodes with claims expiring within 180 days{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div>
        <div style={{marginTop:14,maxHeight:expList.exp?LIST_EXP_H:undefined,overflowY:expList.exp?"auto":undefined}}>
          {fst.expiring.length===0
            ?<div style={{fontSize:11,color:"var(--accent-green)",fontFamily:"monospace"}}>No claims expiring soon {'\u2713'}</div>
            :(fst.expiring.length>LIST_SHOW&&!expList.exp?fst.expiring.slice(0,LIST_SHOW):fst.expiring).map(n=>{const rk=`exp-${n.id}`;const isH=hovRow===rk;
              const raw=n.rawAttestations||[];
              const soonest=raw.filter(a=>a.status==='verified'&&a.validUntil).map(a=>{const d=(new Date(a.validUntil).getTime()-REF_T)/MS_D;return d>0&&d<=180?d:Infinity;}).reduce((a,b)=>Math.min(a,b),Infinity);
              return <div key={n.id}
                onClick={()=>onSelect(n)} onMouseEnter={()=>setHovRow(rk)} onMouseLeave={()=>setHovRow(null)}
                style={{...clickRow,background:isH?"var(--bg-raised)":"transparent"}}>
                <span style={{fontSize:8,background:"var(--accent-amber-bg)",color:"var(--accent-amber)",padding:"1px 5px",borderRadius:3,fontWeight:700,fontFamily:"monospace",flexShrink:0}}>{soonest<Infinity?`${Math.round(soonest)}d`:''}</span>
                <NodeIcon type={n.type} size={12}/>
                <span style={{fontSize:10,color:(TT[n.type]||TT.component).text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</span>
                <span style={{fontSize:9,color:"var(--text-secondary)",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{n.supplier}</span>
              </div>;})}
        </div>
        {fst.expiring.length>LIST_SHOW&&<button onClick={()=>togList("exp")} style={{background:"none",border:"none",color:"var(--accent-amber)",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"6px 0"}}>{expList.exp?"Show less \u2191":`Show all ${fst.expiring.length} \u2192`}</button>}
      </div>

      {/* Panel 8: Geographic Concentration */}
      <div style={cardStyle}>
        <div style={headerStyle}>GEOGRAPHIC CONCENTRATION</div>
        <div style={bigNum("var(--accent-blue)")}>{fst.cc}</div>
        <div style={bigLabel}>countries{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div>
        <div style={{marginTop:14,maxHeight:expList.geo?LIST_EXP_H:undefined,overflowY:expList.geo?"auto":undefined}}>
          {(fst.countries.length>LIST_SHOW&&!expList.geo?fst.countries.slice(0,LIST_SHOW):fst.countries).map(([co,ct])=>{const pct=fst.total>0?Math.round(ct/fst.total*100):0;return <div key={co} style={rowBase}>
            <span style={{fontSize:10,color:"var(--text-secondary)",width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{co}</span>
            <div style={{flex:1,...barBg}}><div style={{height:"100%",width:`${pct}%`,background:"var(--accent-blue)",borderRadius:2,opacity:.5,minWidth:2}}/></div>
            <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",width:50,textAlign:"right",flexShrink:0}}>{ct} ({pct}%)</span>
          </div>;})}
        </div>
        {fst.countries.length>LIST_SHOW&&<button onClick={()=>togList("geo")} style={{background:"none",border:"none",color:"var(--accent-blue)",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"6px 0"}}>{expList.geo?"Show less \u2191":`Show all ${fst.countries.length} \u2192`}</button>}
      </div>

      {/* Panel 9: Token Types */}
      <div style={cardStyle}>
        <div style={headerStyle}>TOKEN TYPES</div>
        {Object.entries(fst.tb).sort((a,b)=>b[1]-a[1]).map(([type,ct])=>{const t=TT[type]||TT.component;const total=Object.values(fst.tb).reduce((a,b)=>a+b,0);const pct=total>0?Math.round(ct/total*100):0;
          return <div key={type} style={rowBase}>
            <NodeIcon type={type} size={12}/>
            <span style={{fontSize:10,color:t.text,width:85,flexShrink:0}}>{t.label}</span>
            <div style={{flex:1,...barBg}}><div style={{height:"100%",width:`${pct}%`,background:t.border,borderRadius:2,opacity:.5,minWidth:2}}/></div>
            <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",width:55,textAlign:"right",flexShrink:0}}>{ct} ({pct}%)</span>
          </div>;})}
      </div>
    </div>
  </div>;
}
