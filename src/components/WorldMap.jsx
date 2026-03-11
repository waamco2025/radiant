import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { geoEqualEarth } from 'd3-geo';
import { TT } from '../data/tokens';
import { colLocs, countryBk } from '../data/dataset';
import NodeIcon from './NodeIcon';
import SvgMark from './SvgMark';
import DetailPanel from './DetailPanel';

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const DECAY = 0.92, VEL_STOP = 0.5;
const LIST_SHOW = 12, LIST_EXP_H = 432;
const MAP_H = 460; // fixed map height (px)
const CLUSTER_R = 30; // cluster screen-distance threshold in px
const DBLCLICK_MS = 250; // double-click window

/* ── GeoJSON name → dataset country name ── */
const GEO_ALIASES = {
  'United States of America':'USA','United Kingdom':'UK',
  'Republic of Korea':'South Korea','Korea':'South Korea',
  'Democratic Republic of the Congo':'DRC','Dem. Rep. Congo':'DRC',
  'Russian Federation':'Russia','Czechia':'Czech Republic',
  'Republic of China':'Taiwan',
};
function matchGeo(geoName, dataCountries) {
  if (!geoName) return null;
  if (dataCountries[geoName]) return geoName;
  const a = GEO_ALIASES[geoName];
  if (a && dataCountries[a]) return a;
  for (const dc of Object.keys(dataCountries)) {
    if (geoName.includes(dc) || dc.includes(geoName)) return dc;
  }
  return null;
}

/* ── Region classification ── */
const REGION_RE = [
  ['North America',/USA|United States|Canada|Mexico/i],
  ['Europe',/Germany|France|UK|United Kingdom|Italy|Spain|Netherlands|Belgium|Switzerland|Sweden|Norway|Denmark|Finland|Austria|Poland|Czech|Ireland|Portugal|Romania|Hungary|Greece|Luxembourg/i],
  ['Asia-Pacific',/China|Japan|South Korea|Korea|Taiwan|India|Singapore|Australia|New Zealand|Thailand|Vietnam|Malaysia|Indonesia|Philippines/i],
  ['South America',/Brazil|Argentina|Chile|Colombia|Peru|Venezuela|Ecuador|Uruguay/i],
  ['Middle East & Africa',/Israel|Saudi Arabia|UAE|Turkey|South Africa|Egypt|Nigeria|Kenya|Morocco|DRC|Qatar/i],
];
function getRegion(c){for(const[r,re]of REGION_RE)if(re.test(c))return r;return'Other';}
const REGION_C={'North America':'var(--accent-blue)','Europe':'var(--accent-green)','Asia-Pacific':'var(--accent-amber)','South America':'var(--accent-purple)','Middle East & Africa':'var(--accent-red)','Other':'var(--text-tertiary)'};

/* ── Projection helper (matches react-simple-maps config) ── */
const PROJ_SCALE = 150, SVG_W = 900, SVG_H = 460;
function makeProj(){
  return geoEqualEarth().scale(PROJ_SCALE).translate([SVG_W/2, SVG_H/2]);
}

export default function SupplyMap({data,onSelect,sel,onCloseSel,onViewChain,resetZoomKey,nodeTypeLabels,attFilterMatch}){
  /* ════ Data ════ */
  const ls=useMemo(()=>colLocs(data),[data]);
  const usedTypes=useMemo(()=>{const s=new Set();const w=n=>{if(n.type!=='customer'&&n.type!=='system')s.add(n.type);if(n.children)n.children.forEach(w);};w(data);return Object.keys(TT).filter(k=>s.has(k));},[data]);
  const totalNodes=useMemo(()=>{let c=0;const w=n=>{c++;if(n.children)n.children.forEach(w);};w(data);return c;},[data]);

  const nodesByCountry=useMemo(()=>{
    const m={};
    const walk=n=>{if(n.location){const co=n.location.split(",").pop().trim();if(co){if(!m[co])m[co]=[];m[co].push(n);}}if(n.children)n.children.forEach(walk);};
    walk(data);return m;
  },[data]);

  const itarData=useMemo(()=>{
    const countries=new Set(),byCountry={};
    const walk=n=>{if(n.itar&&n.location){const co=n.location.split(",").pop().trim();if(co){countries.add(co);byCountry[co]=(byCountry[co]||0)+1;}}if(n.children)n.children.forEach(walk);};
    walk(data);return{countries,byCountry};
  },[data]);

  const countryStats=useMemo(()=>{
    const co=countryBk(data);const entries=Object.entries(co).sort((a,b)=>b[1]-a[1]);
    const total=entries.reduce((s,[,c])=>s+c,0);return{entries,total,count:entries.length};
  },[data]);

  const regionData=useMemo(()=>{
    const r={};countryStats.entries.forEach(([c,n])=>{const rg=getRegion(c);r[rg]=(r[rg]||0)+n;});
    return Object.entries(r).sort((a,b)=>b[1]-a[1]);
  },[countryStats]);

  const itarExposure=useMemo(()=>
    Object.entries(itarData.byCountry).map(([co,ic])=>{
      const total=nodesByCountry[co]?.length||ic;return{co,ic,total,pct:Math.round(ic/total*100)};
    }).sort((a,b)=>b.ic-a.ic)
  ,[itarData,nodesByCountry]);

  /* ════ Filtered data (sidebar filter reactivity) ════ */
  const filteredCountryStats=useMemo(()=>{
    if(!attFilterMatch)return countryStats;
    const co={};
    const walk=n=>{if(n.type!=='customer'&&n.type!=='system'&&n.location&&attFilterMatch.has(n.id)){const c=n.location.split(",").pop().trim();if(c)co[c]=(co[c]||0)+1;}if(n.children)n.children.forEach(walk);};
    walk(data);
    const entries=Object.entries(co).sort((a,b)=>b[1]-a[1]);
    const total=entries.reduce((s,[,c])=>s+c,0);
    return{entries,total,count:entries.length};
  },[data,attFilterMatch,countryStats]);

  const filteredRegionData=useMemo(()=>{
    if(!attFilterMatch)return regionData;
    const r={};filteredCountryStats.entries.forEach(([c,n])=>{const rg=getRegion(c);r[rg]=(r[rg]||0)+n;});
    return Object.entries(r).sort((a,b)=>b[1]-a[1]);
  },[attFilterMatch,filteredCountryStats,regionData]);

  const filteredItarExposure=useMemo(()=>{
    if(!attFilterMatch)return itarExposure;
    const byCountry={};
    const walk=n=>{if(n.itar&&n.location&&attFilterMatch.has(n.id)){const co=n.location.split(",").pop().trim();if(co)byCountry[co]=(byCountry[co]||0)+1;}if(n.children)n.children.forEach(walk);};
    walk(data);
    return Object.entries(byCountry).map(([co,ic])=>{
      const total=nodesByCountry[co]?.length||ic;return{co,ic,total,pct:Math.round(ic/total*100)};
    }).sort((a,b)=>b.ic-a.ic);
  },[data,attFilterMatch,itarExposure,nodesByCountry]);

  /* ════ Keyboard zoom reset ════ */
  useEffect(()=>{if(resetZoomKey>0){setZoom(1);setPanXY({x:0,y:0});}},[resetZoomKey]);

  /* ════ Projection for clustering ════ */
  const proj=useMemo(()=>makeProj(),[]);
  const projected=useMemo(()=>ls.map(l=>{const[px,py]=proj([l.lng,l.lat]);return{node:l,px,py};}),[ls,proj]);

  /* ════ UI state ════ */
  const[zoom,setZoom]=useState(1);
  const[panXY,setPanXY]=useState({x:0,y:0});
  const[hovI,setHovI]=useState(null);
  const[tooltipNode,setTooltipNode]=useState(null); // node for persistent SVG tooltip
  const[countrySel,setCountrySel]=useState(null);
  const[clusterSel,setClusterSel]=useState(null); // {members, screenX, screenY, location}
  const[clusterSelNode,setClusterSelNode]=useState(null); // highlighted row in cluster tooltip
  const[hovRow,setHovRow]=useState(null);
  const[expList,setExpList]=useState({});
  const togList=useCallback(k=>setExpList(p=>({...p,[k]:!p[k]})),[]);
  const[containerW,setContainerW]=useState(900);

  /* ════ Refs ════ */
  const mapRef=useRef(null);
  const dragRef=useRef({active:false,startX:0,startY:0,panX:0,panY:0,wasDrag:false});
  const momentumRef=useRef(null);
  const velRef=useRef({vx:0,vy:0});
  const lastMRef=useRef({x:0,y:0,t:0});
  const clickTimerRef=useRef(null); // {timer, key}

  useEffect(()=>()=>{if(momentumRef.current)cancelAnimationFrame(momentumRef.current);},[]);

  /* ════ ResizeObserver for container width ════ */
  useEffect(()=>{
    const el=mapRef.current;if(!el)return;
    setContainerW(el.clientWidth);
    const ro=new ResizeObserver(entries=>{for(const e of entries)setContainerW(e.contentRect.width);});
    ro.observe(el);return()=>ro.disconnect();
  },[]);

  /* ════ Clustering ════ */
  const clusters=useMemo(()=>{
    // screen-space scale: SVG coord → screen px
    const scale=containerW/SVG_W*zoom;
    const cellSize=CLUSTER_R/scale; // cell size in SVG coords
    const grid={};
    const selId=sel?.id;

    // Place each point into a grid cell
    for(const p of projected){
      // If selected node, always show individually
      if(p.node.id===selId){continue;}
      const cx=Math.floor(p.px/cellSize),cy=Math.floor(p.py/cellSize);
      const key=`${cx}_${cy}`;
      if(!grid[key])grid[key]={members:[],sumX:0,sumY:0};
      grid[key].members.push(p);
      grid[key].sumX+=p.px;
      grid[key].sumY+=p.py;
    }

    // Build result arrays
    const singles=[]; // individual markers
    const merged=[]; // cluster indicators

    // Add selected node as individual
    if(selId){
      const sp=projected.find(p=>p.node.id===selId);
      if(sp)singles.push(sp);
    }

    for(const cell of Object.values(grid)){
      if(cell.members.length===1){
        singles.push(cell.members[0]);
      } else {
        merged.push({
          members:cell.members,
          px:cell.sumX/cell.members.length,
          py:cell.sumY/cell.members.length,
          count:cell.members.length,
        });
      }
    }
    return{singles,merged};
  },[projected,containerW,zoom,sel]);

  /* ════ Pan clamping ════ */
  const clampPan=useCallback((px,py,z)=>{
    if(z<=1)return{x:0,y:0};
    const el=mapRef.current;if(!el)return{x:px,y:py};
    const mxX=el.clientWidth*(z-1)/2, mxY=el.clientHeight*(z-1)/2;
    return{x:Math.max(-mxX,Math.min(mxX,px)),y:Math.max(-mxY,Math.min(mxY,py))};
  },[]);

  /* ════ Zoom ════ */
  const doZoomIn=useCallback(()=>setZoom(z=>{const nz=Math.min(z*1.3,6);setPanXY(p=>clampPan(p.x,p.y,nz));return nz;}),[clampPan]);
  const doZoomOut=useCallback(()=>setZoom(z=>{const nz=Math.max(z/1.3,1);if(nz<=1)setPanXY({x:0,y:0});else setPanXY(p=>clampPan(p.x,p.y,nz));return nz;}),[clampPan]);
  const doZoomReset=useCallback(()=>{setZoom(1);setPanXY({x:0,y:0});},[]);

  /* Zoom to point (for double-click) */
  const zoomToPoint=useCallback((screenX,screenY)=>{
    const el=mapRef.current;if(!el)return;
    const rect=el.getBoundingClientRect();
    const cx=rect.width/2, cy=rect.height/2;
    const relX=screenX-rect.left-cx, relY=screenY-rect.top-cy;
    setZoom(z=>{
      const nz=Math.min(z*2,6);
      const ratio=nz/z;
      setPanXY(p=>{
        const nx=(relX)*(1-ratio)+p.x*ratio;
        const ny=(relY)*(1-ratio)+p.y*ratio;
        return clampPan(nx,ny,nz);
      });
      return nz;
    });
  },[clampPan]);

  /* Wheel zoom */
  useEffect(()=>{
    const el=mapRef.current;if(!el)return;
    const h=e=>{e.preventDefault();setZoom(z=>{const nz=e.deltaY>0?Math.max(1,z*0.9):Math.min(6,z*1.1);setPanXY(p=>clampPan(p.x,p.y,nz));return nz;});};
    el.addEventListener('wheel',h,{passive:false});return()=>el.removeEventListener('wheel',h);
  },[clampPan]);

  /* ════ Drag pan ════ */
  const onMD=useCallback(e=>{
    if(e.button!==0||zoom<=1)return;
    e.preventDefault();
    if(momentumRef.current){cancelAnimationFrame(momentumRef.current);momentumRef.current=null;}
    dragRef.current={active:true,startX:e.clientX,startY:e.clientY,panX:panXY.x,panY:panXY.y,wasDrag:false};
    lastMRef.current={x:e.clientX,y:e.clientY,t:performance.now()};
    velRef.current={vx:0,vy:0};
  },[panXY,zoom]);

  const onMM=useCallback(e=>{
    const d=dragRef.current;if(!d.active)return;
    const dx=e.clientX-d.startX,dy=e.clientY-d.startY;
    if(Math.abs(dx)>3||Math.abs(dy)>3)d.wasDrag=true;
    const now=performance.now(),last=lastMRef.current,dt=now-last.t;
    if(dt>0&&dt<100)velRef.current={vx:(e.clientX-last.x)/dt*16,vy:(e.clientY-last.y)/dt*16};
    lastMRef.current={x:e.clientX,y:e.clientY,t:now};
    setPanXY(clampPan(d.panX+dx,d.panY+dy,zoom));
  },[zoom,clampPan]);

  const endDrag=useCallback(()=>{
    const d=dragRef.current;if(!d.active)return;d.active=false;
    let px=panXY.x,py=panXY.y;
    const dt=performance.now()-lastMRef.current.t;
    const v=dt<50?velRef.current:{vx:0,vy:0};
    if(Math.abs(v.vx)>VEL_STOP||Math.abs(v.vy)>VEL_STOP){
      let vx=v.vx,vy=v.vy;
      const anim=()=>{vx*=DECAY;vy*=DECAY;if(Math.abs(vx)<VEL_STOP&&Math.abs(vy)<VEL_STOP){momentumRef.current=null;return;}px+=vx;py+=vy;const c=clampPan(px,py,zoom);px=c.x;py=c.y;setPanXY({x:px,y:py});momentumRef.current=requestAnimationFrame(anim);};
      momentumRef.current=requestAnimationFrame(anim);
    }
  },[panXY,zoom,clampPan]);

  /* ════ Double-click + single-click disambiguation ════ */
  const handleMapDblClick=useCallback(e=>{
    e.preventDefault();e.stopPropagation();
    zoomToPoint(e.clientX,e.clientY);
  },[zoomToPoint]);

  /* ════ Click / hover handlers ════ */
  const onBgClick=useCallback(e=>{
    if(dragRef.current.wasDrag)return;
    // Single-click on background — deselect
    setCountrySel(null);setTooltipNode(null);setClusterSel(null);setClusterSelNode(null);if(onCloseSel)onCloseSel();
  },[onCloseSel]);

  const hovNodeRef=useRef(null);
  const onPtEnter=useCallback((e,node)=>{
    if(sel?.id===node.id)return;
    hovNodeRef.current=node;
  },[sel]);

  const onPtLeave=useCallback(()=>{setHovI(null);hovNodeRef.current=null;},[]);

  const onPtClick=useCallback((e,node,idx)=>{
    e.stopPropagation();if(dragRef.current.wasDrag)return;
    setCountrySel(null);setClusterSel(null);setClusterSelNode(null);
    setTooltipNode(node);
    setHovI(idx);
    onSelect(node);
  },[onSelect]);

  const onClusterClick=useCallback((e,cluster,idx)=>{
    e.stopPropagation();if(dragRef.current.wasDrag)return;
    const el=mapRef.current;if(!el)return;
    const rect=el.getBoundingClientRect();
    const loc=cluster.members[0]?.node?.location||'';
    setTooltipNode(null);setCountrySel(null);if(onCloseSel)onCloseSel();
    setClusterSelNode(null);
    setClusterSel({
      members:cluster.members,
      count:cluster.count,
      location:loc,
      screenX:e.clientX-rect.left,
      screenY:e.clientY-rect.top,
      clusterIdx:idx,
    });
  },[onCloseSel]);

  const onGeoClick=useCallback((e,geoName)=>{
    e.stopPropagation();if(dragRef.current.wasDrag)return;
    const matched=matchGeo(geoName,nodesByCountry);
    if(matched&&nodesByCountry[matched]?.length){
      if(onCloseSel)onCloseSel();setTooltipNode(null);setClusterSel(null);setClusterSelNode(null);setCountrySel(matched);
    }
  },[nodesByCountry,onCloseSel]);

  /* Clear countrySel/clusterSel when node selected externally (not from cluster list) */
  useEffect(()=>{if(sel){setCountrySel(null);}},[sel]);

  /* Escape closes country panel or cluster tooltip */
  useEffect(()=>{
    if(!countrySel&&!clusterSel)return;
    const h=e=>{if(e.key==='Escape'){if(clusterSel){setClusterSel(null);setClusterSelNode(null);}else if(countrySel)setCountrySel(null);}};
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[countrySel,clusterSel]);

  /* ════ Country panel data ════ */
  const cpData=useMemo(()=>{
    if(!countrySel||!nodesByCountry[countrySel])return null;
    const nodes=nodesByCountry[countrySel];
    return{name:countrySel,nodes,count:nodes.length,hasItar:nodes.some(n=>n.itar)};
  },[countrySel,nodesByCountry]);

  /* ════ Tooltip: find projected coords for tooltipNode ════ */
  const tooltipProj=useMemo(()=>{
    if(!tooltipNode)return null;
    const p=projected.find(p=>p.node.id===tooltipNode.id);
    return p||null;
  },[tooltipNode,projected]);

  /* ════ Styles ════ */
  const panelOpen=!!sel||!!countrySel;
  const card={background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:8,padding:16};
  const hdr={fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".08em",marginBottom:12,fontWeight:700};
  const bigN=c=>({fontSize:26,fontWeight:700,color:c,fontFamily:"var(--font-mono)",lineHeight:1.1});
  const bigL={fontSize:10,color:"var(--text-tertiary)",fontFamily:"monospace",marginTop:2};
  const barBg={height:4,background:"var(--bg-app-header)",borderRadius:2,overflow:"hidden"};
  const rowB={display:"flex",alignItems:"center",gap:8,padding:"3px 4px",borderRadius:4,marginBottom:2};
  const clkRow={...rowB,cursor:"pointer",transition:"background .12s"};
  const invZ=1/zoom;

  return <div style={{width:"100%",height:"100%",position:"relative",overflow:"hidden"}}>
    {/* ═══ Scrollable content ═══ */}
    <div style={{width:panelOpen?"calc(100% - 370px)":"100%",height:"100%",overflow:"auto",padding:"20px 30px",transition:"width .25s"}}>
      <div style={{fontSize:13,fontWeight:700,color:"var(--text-secondary)",fontFamily:"var(--font-mono)",marginTop:36,marginBottom:16,letterSpacing:".04em",display:"flex",alignItems:"center",gap:8}}>SUPPLY MAP{attFilterMatch&&<span style={{fontSize:8,fontWeight:700,color:"var(--accent-indigo)",background:"var(--accent-indigo-bg)",padding:"2px 6px",borderRadius:3,letterSpacing:".04em",border:"1px solid color-mix(in srgb, var(--accent-indigo) 20%, transparent)"}}>FILTERED · {attFilterMatch.size} of {totalNodes}</span>}</div>

      {/* ── Map area ── */}
      <div style={{position:"relative",marginBottom:8}}>
        <div ref={mapRef} style={{overflow:"hidden",borderRadius:8,border:"1px solid var(--border)",background:"var(--bg-deep)",cursor:zoom>1?"grab":"default",userSelect:"none",WebkitUserSelect:"none",height:MAP_H}}
          onClick={onBgClick} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={endDrag} onMouseLeave={endDrag} onDoubleClick={handleMapDblClick}>
          <div style={{transform:`translate(${panXY.x}px,${panXY.y}px) scale(${zoom})`,transformOrigin:"center center",height:"100%"}}>
            <ComposableMap projection="geoEqualEarth" projectionConfig={{scale:PROJ_SCALE}} width={SVG_W} height={SVG_H} style={{width:"100%",height:"100%",display:"block"}}>
              <Geographies geography={GEO_URL}>
                {({geographies})=>geographies.map(geo=>{
                  const gn=geo.properties?.name||geo.properties?.NAME||'';
                  const mc=matchGeo(gn,nodesByCountry);
                  const isItar=mc?itarData.countries.has(mc):false;
                  return <Geography key={geo.rsmKey} geography={geo}
                    fill={isItar?"var(--bg-card)":"var(--bg-card)"}
                    stroke={isItar?"var(--accent-red-bg)":"var(--border)"} strokeWidth={0.5}
                    onClick={e=>onGeoClick(e,gn)}
                    style={{default:{outline:"none"},hover:{outline:"none",fill:isItar?"var(--accent-indigo-bg)":"var(--bg-card)",cursor:"pointer"},pressed:{outline:"none"}}}/>;
                })}
              </Geographies>

              {/* Individual markers (singles from clustering) */}
              {clusters.singles.map((p,i)=>{const l=p.node;const isH=hovI===l.id;const isSel=sel?.id===l.id;const t=TT[l.type]||TT.component;const dimmed=attFilterMatch&&!attFilterMatch.has(l.id);
                return <Marker key={l.id} coordinates={[l.lng,l.lat]}>
                  <g onMouseEnter={e=>{setHovI(l.id);onPtEnter(e,l);}} onMouseLeave={onPtLeave}
                    onClick={e=>onPtClick(e,l,l.id)} style={{cursor:"pointer",opacity:dimmed?.15:1,transition:"opacity .2s"}}>
                    <g transform={`scale(${invZ})`}>
                      {isSel&&<circle r={16} fill="none" stroke="var(--accent-indigo)" strokeWidth={2} opacity={.6}/>}
                      <circle r={isH||isSel?14:10} fill={t.border} opacity=".1"/>
                      <SvgMark type={l.type} cx={0} cy={0} r={isH||isSel?7:5}/>
                    </g>
                  </g>
                </Marker>;})}

              {/* Cluster markers */}
              {clusters.merged.map((cl,i)=>{
                const invPt=proj.invert([cl.px,cl.py]);
                if(!invPt)return null;
                const isSelCl=clusterSel?.clusterIdx===i;
                return <Marker key={`cl-${i}`} coordinates={invPt}>
                  <g onClick={e=>onClusterClick(e,cl,i)} style={{cursor:"pointer"}}
                    onMouseEnter={()=>setHovI(`cl-${i}`)} onMouseLeave={()=>setHovI(null)}>
                    <g transform={`scale(${invZ})`}>
                      <circle r={20} fill={isSelCl?"var(--accent-indigo-bg)":"var(--border)"} stroke={isSelCl?"var(--accent-cyan)":"var(--border-hover)"} strokeWidth={isSelCl?2.5:1.5} opacity={isSelCl?1:hovI===`cl-${i}`?.9:.7}/>
                      <text textAnchor="middle" dy=".35em" fontSize={10} fontFamily="var(--font-mono)" fontWeight={700} fill={isSelCl?"var(--accent-indigo-bg)":"var(--text-secondary)"}>{cl.count}</text>
                    </g>
                  </g>
                </Marker>;
              })}

              {/* SVG tooltip — renders last (on top) */}
              {tooltipProj&&tooltipNode&&<Marker coordinates={[tooltipNode.lng,tooltipNode.lat]}>
                <g transform={`scale(${invZ})`} style={{pointerEvents:"none"}}>
                  <g transform="translate(14,-8)">
                    <rect x={-2} y={-14} width={170} height={44} rx={4} fill="var(--bg-surface)" fillOpacity=".93" stroke="var(--border)" strokeWidth={1}/>
                    <text x={6} y={-1} fontSize={10} fontWeight={600} fill="var(--text-heading)" style={{fontFamily:"var(--font-display)"}}>
                      {tooltipNode.name?.length>22?tooltipNode.name.slice(0,22)+'...':tooltipNode.name}
                    </text>
                    <text x={6} y={11} fontSize={8} fill="var(--text-secondary)" fontFamily="monospace">{tooltipNode.supplier?.length>26?tooltipNode.supplier.slice(0,26)+'...':tooltipNode.supplier}</text>
                    <text x={6} y={22} fontSize={7} fill="var(--text-tertiary)" fontFamily="monospace">{tooltipNode.location?.length>28?tooltipNode.location.slice(0,28)+'...':tooltipNode.location}</text>
                  </g>
                </g>
              </Marker>}

              {/* Hover tooltip (non-persistent) */}
              {hovNodeRef.current&&hovI&&!tooltipNode&&sel?.id!==hovNodeRef.current.id&&
                <Marker coordinates={[hovNodeRef.current.lng,hovNodeRef.current.lat]}>
                  <g transform={`scale(${invZ})`} style={{pointerEvents:"none"}}>
                    <g transform="translate(14,-8)">
                      <rect x={-2} y={-14} width={170} height={44} rx={4} fill="var(--bg-surface)" fillOpacity=".93" stroke="var(--border)" strokeWidth={1}/>
                      <text x={6} y={-1} fontSize={10} fontWeight={600} fill="var(--text-heading)" style={{fontFamily:"var(--font-display)"}}>
                        {hovNodeRef.current.name?.length>22?hovNodeRef.current.name.slice(0,22)+'...':hovNodeRef.current.name}
                      </text>
                      <text x={6} y={11} fontSize={8} fill="var(--text-secondary)" fontFamily="monospace">{hovNodeRef.current.supplier?.length>26?hovNodeRef.current.supplier.slice(0,26)+'...':hovNodeRef.current.supplier}</text>
                      <text x={6} y={22} fontSize={7} fill="var(--text-tertiary)" fontFamily="monospace">{hovNodeRef.current.location?.length>28?hovNodeRef.current.location.slice(0,28)+'...':hovNodeRef.current.location}</text>
                    </g>
                  </g>
                </Marker>}

              {/* Cluster hover tooltip */}
              {typeof hovI==='string'&&hovI.startsWith('cl-')&&(()=>{
                const idx=parseInt(hovI.slice(3));
                const cl=clusters.merged[idx];
                if(!cl)return null;
                const invPt=proj.invert([cl.px,cl.py]);
                if(!invPt)return null;
                return <Marker coordinates={invPt}>
                  <g transform={`scale(${invZ})`} style={{pointerEvents:"none"}}>
                    <g transform="translate(24,-8)">
                      <rect x={-2} y={-14} width={130} height={24} rx={4} fill="var(--bg-surface)" fillOpacity=".93" stroke="var(--border)" strokeWidth={1}/>
                      <text x={6} y={2} fontSize={9} fill="var(--text-secondary)" fontFamily="monospace">{cl.count} nodes</text>
                    </g>
                  </g>
                </Marker>;
              })()}
            </ComposableMap>
          </div>
        </div>
        {/* Zoom controls */}
        <div style={{position:"absolute",top:8,right:8,display:"flex",flexDirection:"column",gap:2,zIndex:10}}>
          {[{l:"+",fn:doZoomIn},{l:"\u2212",fn:doZoomOut},{l:"\u27F3",fn:doZoomReset}].map(b=>
            <button key={b.l} onClick={e=>{e.stopPropagation();b.fn();}} style={{width:26,height:26,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text-secondary)",cursor:"pointer",fontSize:14,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{b.l}</button>)}
        </div>
        {/* Cluster supplier list tooltip */}
        {clusterSel&&<div onClick={e=>e.stopPropagation()} style={{position:"absolute",left:Math.min(clusterSel.screenX+12,((mapRef.current?.clientWidth||600)-310)),top:Math.min(clusterSel.screenY-20,MAP_H-360),zIndex:20,width:300,maxHeight:350,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.5)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px 8px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--text-heading)"}}>{clusterSel.count} nodes</div>
              <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:230}}>{clusterSel.location}</div>
            </div>
            <button onClick={e=>{e.stopPropagation();setClusterSel(null);setClusterSelNode(null);}} style={{background:"none",border:"none",color:"var(--text-tertiary)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>{"\u2715"}</button>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"4px 0"}}>
            {clusterSel.members.map(p=>{const n=p.node;const t=TT[n.type]||TT.component;const isActive=clusterSelNode===n.id;const dimRow=attFilterMatch&&!attFilterMatch.has(n.id);
              const raw=n.rawAttestations||[];let hOk=0,hW=0,hB=0;for(const a of raw){if(a.status==='contested'||a.status==='revoked')hB++;else if(a.status==='expired'||a.status==='pending')hW++;else hOk++;}
              return <div key={n.id} onClick={e=>{e.stopPropagation();setClusterSelNode(n.id);onSelect(n);}}
                onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
                onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background="transparent";}}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",cursor:"pointer",background:isActive?"var(--border)":"transparent",borderLeft:isActive?"2px solid var(--accent-indigo)":"2px solid transparent",transition:"background .1s, opacity .2s",opacity:dimRow?.35:1}}>
                <NodeIcon type={n.type} size={12}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</div>
                  <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.supplier}</div>
                </div>
                <span style={{fontSize:9,fontFamily:"monospace",flexShrink:0,whiteSpace:"nowrap"}}>{hOk>0&&<span style={{color:"var(--accent-green)"}}>{hOk} ✓</span>}{hW>0&&<>{hOk>0?" · ":""}<span style={{color:"var(--accent-amber)"}}>{hW} ⚠</span></>}{hB>0&&<>{(hOk>0||hW>0)?" · ":""}<span style={{color:"var(--accent-red)"}}>{hB} ✗</span></>}</span>
              </div>;})}
          </div>
        </div>}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:20}}>
        {usedTypes.map(k=>{const v=TT[k]||TT.component;return<div key={k} style={{display:"flex",alignItems:"center",gap:4}}><NodeIcon type={k} size={12}/><span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace"}}>{nodeTypeLabels?.[k]||v.label}</span></div>;})}
        {itarExposure.length>0&&<div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:12,height:8,borderRadius:2,background:"var(--bg-card)",border:"1px solid #3d1f2a"}}/>
          <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace"}}>Contains ITAR nodes</span>
        </div>}
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:16,height:16,borderRadius:"50%",background:"var(--border)",border:"1px solid var(--border-hover)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:7,color:"var(--text-secondary)",fontFamily:"monospace",fontWeight:700}}>N</span></div>
          <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace"}}>Clustered nodes</span>
        </div>
      </div>

      {/* ═══ Data panels ═══ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16,paddingBottom:40}}>
        {/* Geographic Concentration */}
        <div style={card}>
          <div style={hdr}>GEOGRAPHIC CONCENTRATION</div>
          <div style={bigN("var(--accent-blue)")}>{filteredCountryStats.count}</div>
          <div style={bigL}>countries{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div>
          <div style={{marginTop:14,maxHeight:expList.geo?LIST_EXP_H:undefined,overflowY:expList.geo?"auto":undefined}}>
            {(filteredCountryStats.entries.length>LIST_SHOW&&!expList.geo?filteredCountryStats.entries.slice(0,LIST_SHOW):filteredCountryStats.entries).map(([co,ct])=>{const pct=filteredCountryStats.total>0?Math.round(ct/filteredCountryStats.total*100):0;
              return <div key={co} style={rowB}>
                <span style={{fontSize:10,color:"var(--text-secondary)",width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{co}</span>
                <div style={{flex:1,...barBg}}><div style={{height:"100%",width:`${pct}%`,background:"var(--accent-blue)",borderRadius:2,opacity:.5,minWidth:2}}/></div>
                <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",width:50,textAlign:"right",flexShrink:0}}>{ct} ({pct}%)</span>
              </div>;})}
          </div>
          {filteredCountryStats.entries.length>LIST_SHOW&&<button onClick={()=>togList("geo")} style={{background:"none",border:"none",color:"var(--accent-blue)",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"6px 0"}}>{expList.geo?"Show less \u2191":`Show all ${filteredCountryStats.entries.length} \u2192`}</button>}
        </div>

        {/* Supplier Distribution by Region */}
        <div style={card}>
          <div style={hdr}>SUPPLIER DISTRIBUTION BY REGION</div>
          <div style={bigN("var(--accent-indigo)")}>{filteredRegionData.length}</div>
          <div style={bigL}>regions{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div>
          <div style={{...barBg,height:20,display:"flex",marginTop:14,marginBottom:14,borderRadius:4}}>
            {filteredRegionData.map(([rg,ct])=>{const pct=filteredCountryStats.total>0?ct/filteredCountryStats.total*100:0;
              return <div key={rg} style={{height:"100%",width:`${pct}%`,background:REGION_C[rg]||REGION_C.Other,opacity:.7,minWidth:pct>0?2:0}} title={`${rg}: ${ct}`}/>;
            })}
          </div>
          {filteredRegionData.map(([rg,ct])=>{const pct=filteredCountryStats.total>0?Math.round(ct/filteredCountryStats.total*100):0;
            return <div key={rg} style={rowB}>
              <div style={{width:8,height:8,borderRadius:2,background:REGION_C[rg]||REGION_C.Other,opacity:.7,flexShrink:0}}/>
              <span style={{fontSize:10,color:"var(--text-secondary)",flex:1}}>{rg}</span>
              <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",flexShrink:0}}>{ct} ({pct}%)</span>
            </div>;})}
        </div>

        {/* ITAR Exposure by Country */}
        {(attFilterMatch?filteredItarExposure.length>0:itarExposure.length>0)&&<div style={card}>
          <div style={hdr}>ITAR EXPOSURE BY COUNTRY</div>
          <div style={bigN("var(--accent-red)")}>{filteredItarExposure.length}</div>
          <div style={bigL}>countries with ITAR suppliers{attFilterMatch&&<span style={{color:"var(--accent-indigo)",marginLeft:4}}>({attFilterMatch.size})</span>}</div>
          <div style={{marginTop:14,maxHeight:expList.itar?LIST_EXP_H:undefined,overflowY:expList.itar?"auto":undefined}}>
            {(filteredItarExposure.length>LIST_SHOW&&!expList.itar?filteredItarExposure.slice(0,LIST_SHOW):filteredItarExposure).map(d=>{const rk=`ie-${d.co}`;const isH=hovRow===rk;
              return <div key={d.co} onMouseEnter={()=>setHovRow(rk)} onMouseLeave={()=>setHovRow(null)}
                style={{...rowB,background:isH?"var(--bg-raised)":"transparent"}}>
                <span style={{fontSize:10,color:"var(--accent-red)",width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{d.co}</span>
                <div style={{flex:1,...barBg}}><div style={{height:"100%",width:`${d.pct}%`,background:"var(--accent-red)",borderRadius:2,opacity:.4,minWidth:2}}/></div>
                <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",width:80,textAlign:"right",flexShrink:0}}>{d.ic} ITAR ({d.pct}%)</span>
              </div>;})}
          </div>
          {filteredItarExposure.length>LIST_SHOW&&<button onClick={()=>togList("itar")} style={{background:"none",border:"none",color:"var(--accent-red)",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"6px 0"}}>{expList.itar?"Show less \u2191":`Show all ${filteredItarExposure.length} \u2192`}</button>}
        </div>}
      </div>
    </div>

    {/* ═══ Node Detail Panel ═══ */}
    {sel&&<div style={{position:"absolute",top:0,right:0,bottom:0,width:360,zIndex:10}} onClick={e=>e.stopPropagation()}>
      <DetailPanel node={sel} onClose={()=>{if(onCloseSel)onCloseSel();setTooltipNode(null);}} onViewChain={onViewChain} onSelect={onSelect}/>
    </div>}

    {/* ═══ Country Detail Panel ═══ */}
    {countrySel&&cpData&&!sel&&<div style={{position:"absolute",top:0,right:0,bottom:0,width:360,zIndex:10,background:"var(--bg-deep)",borderLeft:"1px solid var(--border)",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setCountrySel(null)} style={{position:"sticky",top:0,float:"right",margin:"12px 12px 0 0",background:"none",border:"none",color:"var(--text-tertiary)",cursor:"pointer",fontSize:16,zIndex:2}}>{"\u2715"}</button>
      <div style={{padding:"20px 24px",paddingTop:8}}>
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".08em",marginBottom:4}}>GEOGRAPHIC VIEW</div>
        <div style={{fontSize:18,fontWeight:700,color:"var(--text-heading)",marginBottom:4}}>{cpData.name}</div>
        <div style={{fontSize:12,color:"var(--text-tertiary)",fontFamily:"monospace",marginBottom:cpData.hasItar?12:20}}>{cpData.count} nodes</div>
        {cpData.hasItar&&<div style={{background:"color-mix(in srgb, var(--accent-red-bg) 13%, transparent)",border:"1px solid #7f1d1d55",borderRadius:6,padding:"8px 12px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14}}>{"\u26A0"}</span>
          <span style={{fontSize:10,color:"var(--accent-red)",fontFamily:"monospace"}}>Contains ITAR-controlled nodes</span>
        </div>}
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".08em",marginBottom:8}}>NODES IN {cpData.name.toUpperCase()}</div>
        {cpData.nodes.map(n=>{const rk=`cp-${n.id}`;const isH=hovRow===rk;const nItar=(n.rawAttestations||[]).some(a=>a.predicate==='itar_controlled');
          return <div key={n.id} onClick={e=>{e.stopPropagation();setCountrySel(null);onSelect(n);}}
            onMouseEnter={()=>setHovRow(rk)} onMouseLeave={()=>setHovRow(null)}
            style={{...clkRow,padding:"5px 4px",background:isH?"var(--bg-raised)":"transparent"}}>
            <NodeIcon type={n.type} size={12}/>
            <span style={{fontSize:10,color:(TT[n.type]||TT.component).text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</span>
            {nItar&&<span style={{fontSize:7,background:"var(--accent-red-bg)",color:"var(--accent-red)",padding:"1px 4px",borderRadius:2,fontWeight:700,fontFamily:"monospace",flexShrink:0,lineHeight:"12px"}}>ITAR</span>}
            <span style={{fontSize:9,color:"var(--text-secondary)",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{n.supplier}</span>
          </div>;})}
      </div>
    </div>}
  </div>;
}
