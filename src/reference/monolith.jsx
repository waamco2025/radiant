import { useState, useCallback, useMemo, useRef } from "react";

const TT = {
  customer:    { bg:"#1a1a2e", border:"var(--accent-indigo)", text:"var(--accent-indigo-text)", label:"Network Owner" },
  system:      { bg:"#1a2040", border:"var(--accent-indigo-dim)", text:"var(--accent-indigo-light)", label:"System" },
  assembly:    { bg:"#1a2744", border:"var(--accent-blue)", text:"#93bbfc", label:"Assembly" },
  subassembly: { bg:"#1a2f3a", border:"var(--accent-cyan)", text:"#a5f3fc", label:"Sub-Assembly" },
  component:   { bg:"#1f2b1a", border:"var(--accent-lime)", text:"#d9f99d", label:"Component" },
  process:     { bg:"#2a2517", border:"var(--accent-amber)", text:"#fde68a", label:"Process" },
  material:    { bg:"#2a1f1a", border:"var(--accent-orange)", text:"#fed7aa", label:"Material" },
  chemical:    { bg:"#2a1a2a", border:"var(--accent-purple-light)", text:"#e9d5ff", label:"Compound" },
  rawsource:   { bg:"#2a1a1a", border:"var(--accent-red)", text:"#fca5a5", label:"Raw Source" },
};
const CS = { compliant:{c:"var(--accent-green)",bg:"var(--accent-green-bg)",l:"Compliant",i:"✓"}, expiring:{c:"var(--accent-amber)",bg:"var(--accent-amber-bg)",l:"Expiring Soon",i:"⚠"}, expired:{c:"var(--accent-red)",bg:"var(--accent-red-bg)",l:"Non-Compliant",i:"✕"}, pending:{c:"var(--text-tertiary)",bg:"var(--bg-surface)",l:"Pending Review",i:"…"} };
const PERSONAS = [{id:"engineer",label:"Engineer",icon:"⚙"},{id:"procurement",label:"Procurement",icon:"🔗",soon:true},{id:"compliance",label:"Quality / Compliance",icon:"✓",soon:true},{id:"risk",label:"Risk Analyst",icon:"◎",soon:true},{id:"manager",label:"Program Manager",icon:"▦",soon:true}];
const VERTICALS = [{id:"aerospace",label:"Stellar Dynamics Aerospace",icon:"✦",desc:"Supply chain provenance"},{id:"healthcare",label:"MedTrace Health Systems",icon:"✚",soon:true,desc:"Personnel credentials"},{id:"govco",label:"GovCo Federal Satellite Agency",icon:"★",soon:true,desc:"Component provenance"},{id:"microco",label:"MicroCo Microelectronics",icon:"◈",soon:true,desc:"Assembly & process tracking"}];

// Unicode shape markers per type — simple, no SVG transforms needed
// Unicode icons for HTML contexts (sidebar, detail, legends)
const TYPE_MARK = { customer:"⬡", system:"⬢", assembly:"◆", subassembly:"⊛", component:"⬣", process:"⚙", material:"◧", chemical:"◎", rawsource:"✦" };
function NodeIcon({type, size=14}) {
  const c = (TT[type]||TT.component).border;
  return <span style={{fontSize:size, color:c, lineHeight:1, flexShrink:0, display:"inline-block", width:size, textAlign:"center"}}>{TYPE_MARK[type]||"●"}</span>;
}

// Simple SVG marker for use inside <svg> — no transform/scale
function SvgMark({type, cx, cy, r}) {
  const c = (TT[type]||TT.component).border;
  const s = r || 5;
  switch(type) {
    case "customer": return <polygon points={`${cx},${cy-s} ${cx+s*.87},${cy-s*.5} ${cx+s*.87},${cy+s*.5} ${cx},${cy+s} ${cx-s*.87},${cy+s*.5} ${cx-s*.87},${cy-s*.5}`} fill="none" stroke={c} strokeWidth="1.2"/>;
    case "system": return <polygon points={`${cx},${cy-s} ${cx+s*.87},${cy-s*.5} ${cx+s*.87},${cy+s*.5} ${cx},${cy+s} ${cx-s*.87},${cy+s*.5} ${cx-s*.87},${cy-s*.5}`} fill={c} fillOpacity=".3" stroke={c} strokeWidth="1"/>;
    case "assembly": return <polygon points={`${cx},${cy-s} ${cx+s},${cy} ${cx},${cy+s} ${cx-s},${cy}`} fill={c} fillOpacity=".15" stroke={c} strokeWidth="1.2"/>;
    case "subassembly": return <><circle cx={cx-s*.5} cy={cy-s*.3} r={s*.4} fill="none" stroke={c} strokeWidth="1"/><circle cx={cx+s*.5} cy={cy-s*.3} r={s*.4} fill="none" stroke={c} strokeWidth="1"/><circle cx={cx} cy={cy+s*.4} r={s*.4} fill="none" stroke={c} strokeWidth="1"/></>;
    case "component": return <rect x={cx-s*.7} y={cy-s*.7} width={s*1.4} height={s*1.4} fill={c} fillOpacity=".15" stroke={c} strokeWidth="1.2" rx="1"/>;
    case "process": return <><circle cx={cx} cy={cy} r={s*.8} fill="none" stroke={c} strokeWidth="1.2"/><circle cx={cx} cy={cy} r={s*.3} fill="none" stroke={c} strokeWidth=".8"/></>;
    case "material": return <path d={`M${cx},${cy-s} C${cx+s},${cy-s*.2} ${cx+s*.6},${cy+s} ${cx},${cy+s} C${cx-s*.6},${cy+s} ${cx-s},${cy-s*.2} ${cx},${cy-s}Z`} fill={c} fillOpacity=".15" stroke={c} strokeWidth="1.2"/>;
    case "chemical": return <><circle cx={cx-s*.35} cy={cy} r={s*.55} fill={c} fillOpacity=".08" stroke={c} strokeWidth="1"/><circle cx={cx+s*.35} cy={cy} r={s*.55} fill={c} fillOpacity=".08" stroke={c} strokeWidth="1"/></>;
    case "rawsource": return <polygon points={`${cx},${cy-s} ${cx+s*.3},${cy-s*.3} ${cx+s},${cy} ${cx+s*.3},${cy+s*.3} ${cx},${cy+s} ${cx-s*.3},${cy+s*.3} ${cx-s},${cy} ${cx-s*.3},${cy-s*.3}`} fill="none" stroke={c} strokeWidth="1.2" strokeLinejoin="round"/>;
    default: return <circle cx={cx} cy={cy} r={s*.7} fill="none" stroke={c} strokeWidth="1.2"/>;
  }
}

function RadiantLogo({size=22}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{flexShrink:0}}>
    <polygon points="12,5 16.5,7.5 16.5,12.5 12,15 7.5,12.5 7.5,7.5" fill="none" stroke="var(--accent-indigo)" strokeWidth="1.2" opacity=".9"/>
    <polygon points="12,7.5 14,10 12,12.5 10,10" fill="var(--accent-indigo)" opacity=".3"/>
    <circle cx="12" cy="2" r="1.3" fill="var(--accent-blue)" opacity=".8"/><polygon points="20,5 21.5,7 20,9 18.5,7" fill="var(--accent-cyan)" opacity=".7"/>
    <polygon points="21,14 19,16 17,14" fill="var(--accent-red)" opacity=".7"/><circle cx="12" cy="22" r="1" fill="var(--accent-amber)" opacity=".7"/>
    <polygon points="3,14 5,16 7,14" fill="var(--accent-lime)" opacity=".7"/><polygon points="4,5 5.5,7 4,9 2.5,7" fill="var(--accent-purple-light)" opacity=".7"/>
    {[[12,5,12,2],[16.5,7.5,18.5,7],[16.5,12.5,19,14],[12,15,12,22],[7.5,12.5,5,14],[7.5,7.5,5.5,7]].map(([x1,y1,x2,y2],i)=>
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent-indigo)" strokeWidth=".4" opacity=".4"/>)}
    <circle cx="12" cy="10" r=".6" fill="var(--accent-indigo-text)" opacity=".9"/>
  </svg>;
}

const WPATHS = [
  {id:"na",d:"M58,82 L62,68 L56,56 L65,48 L78,44 L115,34 L160,30 L195,26 L228,30 L256,40 L272,56 L284,70 L274,88 L266,104 L268,118 L258,134 L244,148 L228,158 L216,172 L196,182 L168,198 L150,212 L130,218 L108,210 L86,192 L66,168 L52,140 L46,112 L48,98 Z"},
  {id:"gl",d:"M270,14 L312,8 L345,15 L368,16 L372,24 L355,38 L328,30 L295,24 Z"},
  {id:"sa",d:"M178,220 L200,214 L222,224 L242,244 L252,268 L256,296 L250,324 L238,350 L222,372 L208,388 L194,396 L186,380 L174,340 L168,296 L166,264 L172,234 Z"},
  {id:"eu",d:"M432,48 L452,34 L480,30 L506,32 L522,38 L536,56 L538,72 L526,88 L506,96 L490,100 L474,94 L460,82 L448,70 L436,56 Z"},
  {id:"uk",d:"M440,38 L450,30 L458,36 L454,48 L446,50 Z"},
  {id:"af",d:"M442,138 L478,120 L520,120 L544,130 L562,148 L572,174 L574,188 L568,218 L554,246 L534,268 L510,286 L486,300 L464,302 L450,286 L438,260 L432,228 L434,196 L440,150 Z"},
  {id:"me",d:"M548,100 L582,104 L610,130 L630,160 L622,176 L604,186 L584,178 L568,160 L554,136 L548,112 Z"},
  {id:"as",d:"M540,28 L606,16 L678,18 L750,24 L802,48 L830,84 L840,118 L828,136 L792,148 L746,138 L698,132 L634,122 L586,112 L560,98 L544,76 L538,48 Z"},
  {id:"sea",d:"M718,148 L772,164 L808,192 L818,216 L802,230 L762,224 L736,208 L720,186 L714,162 Z"},
  {id:"jp",d:"M830,56 L842,44 L856,60 L850,76 L840,80 L832,66 Z"},
  {id:"au",d:"M768,282 L832,266 L872,274 L898,294 L904,308 L896,336 L874,356 L844,364 L812,356 L786,334 L772,306 Z"},
];

const CSS = `@keyframes pshim{0%{background-position:-200% center}100%{background-position:200% center}}@keyframes pglow{0%,100%{box-shadow:0 0 8px rgba(99,102,241,.3)}50%{box-shadow:0 0 16px rgba(99,102,241,.6)}}@keyframes ppulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes pfade{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}@keyframes pdash{to{stroke-dashoffset:-20}}`;
function mkhash(){const c="0123456789abcdef";let h="0x";for(let i=0;i<8;i++)h+=c[Math.floor(Math.random()*16)];return h;}

const DATA={id:"stellar",name:"Stellar Dynamics Aerospace",type:"customer",supplier:"Stellar Dynamics Inc.",location:"Houston, TX, USA",lat:29.76,lng:-95.37,compliance:"compliant",block:1,token:mkhash(),
attestations:[{name:"AS9100D",issuer:"BSI Group",expires:"2027-03-15",status:"compliant"},{name:"ITAR Registration",issuer:"DDTC",expires:"2026-08-01",status:"compliant"},{name:"NADCAP",issuer:"PRI",expires:"2025-12-31",status:"expiring"}],
children:[
{id:"engine",name:"Meridian-IV Engine",type:"system",supplier:"Stellar (Engine Div.)",location:"Stennis, MS",lat:30.36,lng:-89.60,compliance:"compliant",block:12,token:mkhash(),
children:[
  {id:"turbopump",name:"HiP Fuel Turbopump",type:"assembly",supplier:"Aerojet Rocketdyne",location:"Sacramento, CA",lat:38.58,lng:-121.49,itar:true,compliance:"compliant",block:45,token:mkhash(),
  attestations:[{name:"AS9100D",issuer:"SAE",expires:"2027-06-30",status:"compliant"},{name:"NADCAP Special",issuer:"PRI",expires:"2025-09-15",status:"expiring"}],evaluated:{date:"2025-11-14",by:"J. Chen",result:"pass"},
  children:[
    {id:"housing",name:"Turbopump Housing",type:"subassembly",supplier:"Precision Castparts",location:"Portland, OR",lat:45.52,lng:-122.68,compliance:"compliant",block:78,token:mkhash(),children:[
      {id:"cast",name:"Investment Casting",type:"process",supplier:"PCC Structurals",location:"Portland, OR",lat:45.52,lng:-122.68,compliance:"compliant",block:91,token:mkhash(),children:[
        {id:"in718",name:"Inconel 718 Billet",type:"material",supplier:"Special Metals Corp",location:"Huntington, WV",lat:38.42,lng:-82.44,compliance:"compliant",block:134,token:mkhash(),convergenceKey:"in718",children:[
          {id:"ni1",name:"Nickel Cathode",type:"rawsource",supplier:"Vale Ltd",location:"Sudbury, Canada",lat:46.49,lng:-81.00,compliance:"compliant",block:201,token:mkhash(),convergenceKey:"ni-sud"},
          {id:"cr1",name:"Chromium Ore",type:"rawsource",supplier:"Samancor Chrome",location:"Bushveld, South Africa",lat:-25.50,lng:28.50,compliance:"compliant",block:202,token:mkhash()},
          {id:"nb1",name:"Ferroniobium",type:"rawsource",supplier:"CBMM",location:"Araxá, Brazil",lat:-19.59,lng:-46.94,compliance:"compliant",block:203,token:mkhash(),notes:"~75% global supply."},
        ]}]},
      {id:"cnc",name:"5-Axis CNC",type:"process",supplier:"Aerojet Rocketdyne",location:"Sacramento, CA",lat:38.58,lng:-121.49,compliance:"compliant",block:95,token:mkhash()},
    ]},
    {id:"impeller",name:"Turbine Impeller",type:"subassembly",supplier:"Howmet Aerospace",location:"Hampton, VA",lat:37.03,lng:-76.35,compliance:"expiring",block:82,token:mkhash(),
    attestations:[{name:"NADCAP Heat Treat",issuer:"PRI",expires:"2025-07-01",status:"expired"},{name:"AS9100D",issuer:"SAE",expires:"2026-04-15",status:"compliant"}],children:[
      {id:"sccast",name:"Single-Crystal Casting",type:"process",supplier:"Howmet Aerospace",location:"Whitehall, MI",lat:43.40,lng:-86.35,compliance:"compliant",block:110,token:mkhash(),children:[
        {id:"mar247",name:"MAR-M-247",type:"material",supplier:"Cannon-Muskegon",location:"Muskegon, MI",lat:43.23,lng:-86.25,compliance:"compliant",block:145,token:mkhash(),children:[
          {id:"co1",name:"Cobalt Metal",type:"rawsource",supplier:"Glencore plc",location:"Katanga, DRC",lat:-10.98,lng:25.99,compliance:"expiring",block:210,token:mkhash(),convergenceKey:"co-drc",notes:"Conflict mineral."},
          {id:"hf1",name:"Hafnium Sponge",type:"rawsource",supplier:"Alkane Resources",location:"Dubbo, Australia",lat:-32.24,lng:148.60,compliance:"compliant",block:211,token:mkhash()},
          {id:"ni2",name:"Nickel (shared)",type:"rawsource",supplier:"Vale Ltd",location:"Sudbury, Canada",lat:46.49,lng:-81.00,compliance:"compliant",block:201,token:mkhash(),convergenceKey:"ni-sud",isConv:true},
        ]}]},
      {id:"tbc",name:"Thermal Barrier Coat",type:"process",supplier:"Praxair Surface Tech",location:"Indianapolis, IN",lat:39.77,lng:-86.16,compliance:"compliant",block:115,token:mkhash(),children:[
        {id:"ysz",name:"YSZ Powder",type:"chemical",supplier:"Oerlikon Metco",location:"Westbury, NY",lat:40.76,lng:-73.59,compliance:"compliant",block:160,token:mkhash(),children:[
          {id:"y1",name:"Yttrium Oxide",type:"rawsource",supplier:"Lynas Rare Earths",location:"Mt Weld, Australia",lat:-28.73,lng:122.55,compliance:"compliant",block:220,token:mkhash()},
          {id:"zr1",name:"Zircon Sand",type:"rawsource",supplier:"Iluka Resources",location:"Murray Basin, Australia",lat:-35.50,lng:144.00,compliance:"compliant",block:221,token:mkhash()},
        ]}]},
    ]},
    {id:"bearings",name:"Ceramic Bearings",type:"subassembly",supplier:"SKF Aerospace",location:"Falconer, NY",lat:42.12,lng:-79.20,compliance:"compliant",block:85,token:mkhash(),children:[
      {id:"si3n4",name:"Si₃N₄ Balls",type:"component",supplier:"CoorsTek",location:"Golden, CO",lat:39.76,lng:-105.22,compliance:"compliant",block:120,token:mkhash()},
      {id:"races",name:"440C Steel Races",type:"component",supplier:"SKF (in-house)",location:"Gothenburg, Sweden",lat:57.71,lng:11.97,compliance:"compliant",block:122,token:mkhash()},
    ]},
    {id:"seals",name:"Shaft Seal Assy",type:"subassembly",supplier:"Eagle Industry",location:"Okazaki, Japan",lat:34.95,lng:137.17,compliance:"compliant",block:88,token:mkhash(),children:[
      {id:"ccface",name:"C-C Seal Face",type:"component",supplier:"SGL Carbon",location:"Wiesbaden, Germany",lat:50.08,lng:8.24,compliance:"compliant",block:130,token:mkhash()}]},
    {id:"sensors",name:"Instrumentation Pkg",type:"subassembly",supplier:"Aerojet Rocketdyne",location:"Sacramento, CA",lat:38.58,lng:-121.49,compliance:"compliant",block:90,token:mkhash(),children:[
      {id:"ptrans",name:"Pressure Transducers",type:"component",supplier:"Kulite Semiconductor",location:"Leonia, NJ",lat:40.86,lng:-73.99,compliance:"compliant",block:135,token:mkhash(),children:[
        {id:"siwafer",name:"EG Silicon Wafer",type:"material",supplier:"Shin-Etsu Chemical",location:"Takefu, Japan",lat:35.90,lng:136.17,compliance:"compliant",block:178,token:mkhash(),children:[
          {id:"qtz",name:"HiP Quartz",type:"rawsource",supplier:"Covia Holdings",location:"Spruce Pine, NC",lat:35.91,lng:-82.07,compliance:"compliant",block:250,token:mkhash(),notes:"SOLE global source."}]}]},
      {id:"thermo",name:"Thermocouples",type:"component",supplier:"Omega Engineering",location:"Norwalk, CT",lat:41.12,lng:-73.41,compliance:"compliant",block:137,token:mkhash()},
      {id:"accel",name:"Accelerometers",type:"component",supplier:"PCB Piezotronics",location:"Depew, NY",lat:42.90,lng:-78.69,compliance:"compliant",block:139,token:mkhash()},
    ]},
    {id:"fasteners",name:"ITAR Fastener Set",type:"subassembly",supplier:"SPS Technologies",location:"Jenkintown, PA",lat:40.10,lng:-75.13,itar:true,compliance:"compliant",block:92,token:mkhash(),children:[
      {id:"a286",name:"A-286 Bolts",type:"component",supplier:"SPS Technologies",location:"Jenkintown, PA",lat:40.10,lng:-75.13,compliance:"compliant",block:140,token:mkhash()}]},
  ]},
  {id:"chamber",name:"Combustion Chamber",type:"assembly",supplier:"Aerojet Rocketdyne",location:"Sacramento, CA",lat:38.58,lng:-121.49,itar:true,compliance:"compliant",block:48,token:mkhash(),children:[
    {id:"liner",name:"Copper Alloy Liner",type:"subassembly",supplier:"Materion Corp",location:"Elmore, OH",lat:41.47,lng:-83.59,compliance:"compliant",block:100,token:mkhash(),children:[
      {id:"narloy",name:"NARloy-Z Billet",type:"material",supplier:"Materion",location:"Elmore, OH",lat:41.47,lng:-83.59,compliance:"compliant",block:155,token:mkhash(),children:[
        {id:"cu1",name:"OFHC Copper",type:"rawsource",supplier:"Freeport-McMoRan",location:"Morenci, AZ",lat:33.08,lng:-109.35,compliance:"compliant",block:230,token:mkhash()},
        {id:"ag1",name:"Silver Grain",type:"rawsource",supplier:"Fresnillo plc",location:"Fresnillo, Mexico",lat:23.17,lng:-102.87,compliance:"compliant",block:231,token:mkhash()},
      ]}]},
    {id:"injector",name:"Injector Plate Assy",type:"subassembly",supplier:"Aerojet Rocketdyne",location:"Sacramento, CA",lat:38.58,lng:-121.49,compliance:"expiring",block:102,token:mkhash(),isNew:true,
    attestations:[{name:"NADCAP Brazing",issuer:"PRI",expires:"2025-05-01",status:"expired"}],children:[
      {id:"injorifice",name:"Pt-Ir Orifice Inserts",type:"component",supplier:"Johnson Matthey",location:"Royston, UK",lat:52.05,lng:-0.02,compliance:"compliant",block:165,token:mkhash(),isNew:true},
      {id:"injmanifold",name:"Inconel 625 Manifold",type:"component",supplier:"Special Metals Corp",location:"Huntington, WV",lat:38.42,lng:-82.44,compliance:"compliant",block:167,token:mkhash(),convergenceKey:"in-sup",isNew:true},
    ]},
  ]},
  {id:"nozzle",name:"Nozzle Extension",type:"assembly",supplier:"Aerojet Rocketdyne",location:"Sacramento, CA",lat:38.58,lng:-121.49,itar:true,compliance:"compliant",block:50,token:mkhash(),childCount:14,children:[],placeholder:true},
  {id:"tvc",name:"Thrust Vector Control",type:"assembly",supplier:"Moog Inc.",location:"East Aurora, NY",lat:42.77,lng:-78.62,compliance:"compliant",block:52,token:mkhash(),isNew:true,childCount:9,children:[],placeholder:true},
  {id:"valves",name:"Propellant Valves",type:"assembly",supplier:"Parker Hannifin",location:"Irvine, CA",lat:33.68,lng:-117.83,compliance:"pending",block:55,token:mkhash(),childCount:11,children:[],placeholder:true},
]},
{id:"avionics",name:"Avionics & Flight Control",type:"system",supplier:"Stellar (Avionics)",location:"Denver, CO",lat:39.74,lng:-104.99,compliance:"compliant",block:15,token:mkhash(),childCount:47,children:[],placeholder:true},
{id:"structures",name:"Airframe & Structures",type:"system",supplier:"Stellar (Structures)",location:"Wichita, KS",lat:37.69,lng:-97.34,compliance:"compliant",block:18,token:mkhash(),childCount:63,children:[],placeholder:true},
{id:"payload",name:"Payload Integration",type:"system",supplier:"Stellar Dynamics",location:"Houston, TX",lat:29.76,lng:-95.37,compliance:"compliant",block:20,token:mkhash(),childCount:22,children:[],placeholder:true},
]};

function countN(n){let c=1+(n.childCount||0);if(n.children)n.children.forEach(x=>c+=countN(x));return c;}
function maxD(n,d=0){if((!n.children||!n.children.length)&&!n.childCount)return d;if(n.children?.length)return Math.max(...n.children.map(c=>maxD(c,d+1)));return d+2;}
function colLocs(n,a=[]){if(n.lat!==undefined)a.push(n);if(n.children)n.children.forEach(c=>colLocs(c,a));return a;}
function convKeys(n,s={},d=new Set()){if(n.convergenceKey){if(s[n.convergenceKey])d.add(n.convergenceKey);else s[n.convergenceKey]=true;}if(n.children)n.children.forEach(c=>convKeys(c,s,d));return d;}
function compCounts(n,c={compliant:0,expiring:0,expired:0,pending:0}){if(n.compliance)c[n.compliance]=(c[n.compliance]||0)+1;if(n.children)n.children.forEach(x=>compCounts(x,c));return c;}
function newCount(n){let c=n.isNew?1:0;if(n.children)n.children.forEach(x=>c+=newCount(x));return c;}
function traceability(n){let raw=0,other=0,ph=0;function w(x){if(x.placeholder){ph+=(x.childCount||0)*3;return;}if(!x.children||!x.children.length){if(x.type==="rawsource")raw++;else other++;return;}x.children.forEach(w);}w(n);const at=raw+other;return{raw,other,ph,ad:at>0?Math.round(raw/at*100):0,nc:Math.round(at/(at+ph)*100)};}
function itarCount(n){let c=n.itar?1:0;if(n.children)n.children.forEach(x=>c+=itarCount(x));return c;}
function evalStats(n){let e=0,ne=0;function w(x){if(x.type!=="customer"&&x.type!=="system"){if(x.evaluated)e++;else ne++;}if(x.children)x.children.forEach(w);}w(n);return{e,ne};}
function countryBk(n){const c={};function w(x){if(x.location){const co=x.location.split(",").pop().trim();c[co]=(c[co]||0)+1;}if(x.children)x.children.forEach(w);}w(n);return c;}
function typeBk(n){const c={};function w(x){if(x.type!=="customer"){c[x.type]=(c[x.type]||0)+1;}if(x.children)x.children.forEach(w);}w(n);return c;}

function TN({node,depth=0,ex,tog,onSel,selId,rev,onRev}){
  const t=TT[node.type]||TT.component;const hk=(node.children?.length>0)||node.placeholder;const isE=ex[node.id];const isSel=selId===node.id;const isNew=node.isNew&&!rev.has(node.id);const cs=node.compliance?CS[node.compliance]:null;
  return <div style={{marginLeft:depth?14:0}}>
    <div onClick={()=>{if(isNew)onRev(node.id);onSel(node);if(hk)tog(node.id);}} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 6px",marginBottom:1,borderRadius:5,cursor:"pointer",background:isNew?"linear-gradient(90deg,#1a1a3e,#2a1a4e,#1a1a3e)":isSel?t.bg:"transparent",backgroundSize:isNew?"200% 100%":undefined,animation:isNew?"pshim 3s linear infinite,pglow 2s ease-in-out infinite":undefined,borderLeft:`3px solid ${isSel?t.border:isNew?"var(--accent-indigo-dim)":"transparent"}`,transition:"all .2s"}}
      onMouseEnter={e=>{if(!isSel&&!isNew)e.currentTarget.style.background=`${t.bg}88`;}} onMouseLeave={e=>{if(!isSel&&!isNew)e.currentTarget.style.background="transparent";}}>
      <span style={{fontFamily:"monospace",fontSize:12,color:hk?t.border:"var(--text-faint)",width:12,flexShrink:0,display:"inline-block"}}>{hk?(isE?"▾":"›"):"·"}</span>
      <NodeIcon type={node.type} size={12}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontWeight:600,color:t.text}}>{node.name}</span>
          {node.itar&&<span style={{fontSize:7,background:"#7f1d1d",color:"#fca5a5",padding:"0 3px",borderRadius:2,fontWeight:700}}>ITAR</span>}
          {isNew&&<span style={{fontSize:7,background:"#312e81",color:"var(--accent-indigo-light)",padding:"0 4px",borderRadius:2,fontWeight:700,animation:"ppulse 1.5s ease-in-out infinite"}}>✦ NEW</span>}
          {cs&&node.compliance!=="compliant"&&<span style={{width:5,height:5,borderRadius:"50%",background:cs.c,flexShrink:0}}/>}
        </div>
        <div style={{fontSize:9,color:"var(--text-muted)",fontFamily:"monospace"}}>{node.supplier}</div>
      </div>
    </div>
    {hk&&isE&&!node.placeholder&&<div style={{borderLeft:`1px solid ${t.border}22`,marginLeft:12}}>{node.children.map(c=><TN key={c.id} node={c} depth={depth+1} ex={ex} tog={tog} onSel={onSel} selId={selId} rev={rev} onRev={onRev}/>)}</div>}
    {node.placeholder&&isE&&<div style={{marginLeft:26,padding:"6px",color:"var(--text-muted)",fontSize:10,fontStyle:"italic",fontFamily:"monospace"}}>{node.childCount} pending…</div>}
  </div>;
}

function WMap({data,expanded,onToggle}){
  const ls=useMemo(()=>colLocs(data),[data]);
  const[hovI,setHovI]=useState(null);
  const toX=lng=>((lng+180)/360)*1000, toY=lat=>((90-lat)/180)*500;
  return <div onClick={e=>{if(!expanded)onToggle();}} style={{position:"absolute",cursor:expanded?undefined:"pointer",...(expanded?{inset:0,zIndex:60,background:"#070810ee",backdropFilter:"blur(10px)"}:{bottom:12,right:12,width:210,height:115,zIndex:40,borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",background:"#0a0c10ee"}),transition:"all .3s"}}>
    <div style={{position:"absolute",top:5,left:8,fontSize:8,color:"var(--text-muted)",fontFamily:"monospace",letterSpacing:".08em",zIndex:2}}>SUPPLY MAP</div>
    {expanded&&<button onClick={e=>{e.stopPropagation();onToggle();}} style={{position:"absolute",top:8,right:12,zIndex:70,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-secondary)",cursor:"pointer",padding:"3px 8px",fontSize:11,fontFamily:"monospace"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent-indigo)";e.currentTarget.style.color="var(--text-bright)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-secondary)";}}>✕ Close</button>}
    <svg viewBox="0 0 1000 500" style={{width:"100%",height:expanded?"calc(100% - 36px)":"100%"}} preserveAspectRatio="xMidYMid meet">
      {WPATHS.map(w=><path key={w.id} d={w.d} fill="#0f1520" stroke="var(--border)" strokeWidth=".8"/>)}
      {ls.map((l,i)=>{const cx=toX(l.lng),cy=toY(l.lat);const isH=hovI===i;const sz=expanded?8:4;
        return <g key={i} onMouseEnter={()=>setHovI(i)} onMouseLeave={()=>setHovI(null)} style={{cursor:"pointer"}}>
          <circle cx={cx} cy={cy} r={expanded?14:6} fill={(TT[l.type]||TT.component).border} opacity=".08"/>
          <SvgMark type={l.type} cx={cx} cy={cy} r={sz}/>
          {expanded&&isH&&<g>
            <rect x={cx+16} y={cy-22} width={128} height={38} rx={4} fill={(TT[l.type]||TT.component).bg} stroke={(TT[l.type]||TT.component).border} strokeWidth=".6" strokeOpacity=".5"/>
            <text x={cx+24} y={cy-8} fontSize="7.5" fill={(TT[l.type]||TT.component).border} fontFamily="monospace" fontWeight="700">{(TT[l.type]||TT.component).label}</text>
            <text x={cx+24} y={cy+2} fontSize="9" fill={(TT[l.type]||TT.component).text} fontWeight="600">{l.name.length>15?l.name.slice(0,13)+"…":l.name}</text>
            <text x={cx+24} y={cy+11} fontSize="6.5" fill="var(--text-muted)" fontFamily="monospace">{l.token}</text>
            <rect x={cx+148} y={cy-22} width={128} height={38} rx={4} fill="var(--bg-app-header)" stroke="var(--border)" strokeWidth=".6"/>
            <text x={cx+156} y={cy-8} fontSize="7.5" fill="var(--text-tertiary)" fontFamily="monospace" fontWeight="600">Supplier</text>
            <text x={cx+156} y={cy+2} fontSize="9" fill="var(--text-primary)" fontWeight="500">{(l.supplier||"").length>15?l.supplier.slice(0,13)+"…":l.supplier}</text>
            <text x={cx+156} y={cy+11} fontSize="7" fill="var(--text-muted)" fontFamily="monospace">{l.location}</text>
          </g>}
        </g>;
      })}
    </svg>
    {expanded&&<div style={{position:"absolute",bottom:8,left:0,right:0,display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap",padding:"0 16px"}}>
      {Object.entries(TT).filter(([k])=>!["customer","system"].includes(k)).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:3}}><NodeIcon type={k} size={11}/><span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace"}}>{v.label}</span></div>)}
    </div>}
  </div>;
}

function NetGraph({data,onSelect,rev,onRev}){
  const[zoom,setZoom]=useState(0.42);const[pan,setPan]=useState({x:0,y:0});const dragRef=useRef({active:false,startX:0,startY:0,panX:0,panY:0});const svgRef=useRef(null);const[hov,setHov]=useState(null);const[selG,setSelG]=useState(null);
  const{gN,gE}=useMemo(()=>{
    const nodes=[],edges=[],conv={},dm={};
    function walk(n,d,pid){if(n.convergenceKey&&conv[n.convergenceKey]){if(pid)edges.push({from:pid,to:conv[n.convergenceKey],conv:true});return;}nodes.push({...n,depth:d});if(n.convergenceKey)conv[n.convergenceKey]=n.id;if(pid)edges.push({from:pid,to:n.id});if(!dm[d])dm[d]=[];dm[d].push(n.id);if(n.children)n.children.forEach(c=>walk(c,d+1,n.id));}
    walk(data,0,null);
    const colW=480,rowH=78,pos={};
    Object.entries(dm).forEach(([d,ids])=>{const depth=parseInt(d);const x=80+depth*colW;const startY=-(ids.length-1)*rowH/2;ids.forEach((id,i)=>{pos[id]={x,y:startY+i*rowH};});});
    return{gN:nodes.map(n=>({...n,x:pos[n.id]?.x||0,y:pos[n.id]?.y||0})),gE:edges};
  },[data]);
  const bds=useMemo(()=>{let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;gN.forEach(n=>{x0=Math.min(x0,n.x);x1=Math.max(x1,n.x);y0=Math.min(y0,n.y);y1=Math.max(y1,n.y);});return{minX:x0-60,maxX:x1+440,minY:y0-60,maxY:y1+60};},[gN]);
  const byId=useMemo(()=>{const m={};gN.forEach(n=>m[n.id]=n);return m;},[gN]);
  const hlE=useMemo(()=>{const t=hov||selG;if(!t)return new Set();const s=new Set();const visited=new Set([t]);const traceUp=id=>{gE.forEach((e,i)=>{if(e.to===id){s.add(i);if(!visited.has(e.from)){visited.add(e.from);traceUp(e.from);}}});};const traceDown=id=>{gE.forEach((e,i)=>{if(e.from===id){s.add(i);if(!visited.has(e.to)){visited.add(e.to);traceDown(e.to);}}});};traceUp(t);traceDown(t);return s;},[hov,selG,gE]);
  const conn=useMemo(()=>{const t=hov||selG;if(!t)return new Set();const s=new Set([t]);const up=id=>{gE.forEach(e=>{if(e.to===id&&!s.has(e.from)){s.add(e.from);up(e.from);}});};const dn=id=>{gE.forEach(e=>{if(e.from===id&&!s.has(e.to)){s.add(e.to);dn(e.to);}});};up(t);dn(t);return s;},[hov,selG,gE]);
  const vW=bds.maxX-bds.minX,vH=bds.maxY-bds.minY;
  const CW=195,CH=58,GAP=6,TOTAL=CW*2+GAP;

  return <div style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",cursor:dragRef.current.active?"grabbing":"grab"}}
    onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.06,Math.min(3,z*(e.deltaY>0?.9:1.1))));}}
    onMouseDown={e=>{if(e.button===0){dragRef.current={active:true,startX:e.clientX,startY:e.clientY,panX:pan.x,panY:pan.y};e.currentTarget.style.cursor="grabbing";}}}
    onMouseMove={e=>{const d=dragRef.current;if(d.active){const mul=2;const nx=d.panX+(e.clientX-d.startX)*mul;const ny=d.panY+(e.clientY-d.startY)*mul;if(svgRef.current){const vb=`${bds.minX-nx/zoom} ${bds.minY-ny/zoom} ${vW/zoom} ${vH/zoom}`;svgRef.current.setAttribute("viewBox",vb);}}}}
    onMouseUp={e=>{const d=dragRef.current;if(d.active){const mul=2;setPan({x:d.panX+(e.clientX-d.startX)*mul,y:d.panY+(e.clientY-d.startY)*mul});d.active=false;e.currentTarget.style.cursor="grab";}}}
    onMouseLeave={e=>{const d=dragRef.current;if(d.active){const mul=2;setPan({x:d.panX+(e.clientX-d.startX)*mul,y:d.panY+(e.clientY-d.startY)*mul});d.active=false;e.currentTarget.style.cursor="grab";}}}>
    <div style={{position:"absolute",top:54,right:16,zIndex:30,display:"flex",flexDirection:"column",gap:2}}>
      {[["+",()=>setZoom(z=>Math.min(3,z*1.3))],["−",()=>setZoom(z=>Math.max(.06,z*.77))],["FIT",()=>{setZoom(.42);setPan({x:0,y:0});}]].map(([l,fn])=>
        <button key={l} onClick={fn} style={{width:28,height:28,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text-secondary)",cursor:"pointer",fontSize:l==="FIT"?9:16,fontFamily:l==="FIT"?"monospace":undefined,display:"flex",alignItems:"center",justifyContent:"center"}}>{l}</button>)}
      <div style={{fontSize:9,color:"var(--text-faint)",fontFamily:"monospace",textAlign:"center",marginTop:4}}>{Math.round(zoom*100)}%</div>
    </div>
    <svg ref={svgRef} style={{width:"100%",height:"100%"}} viewBox={`${bds.minX-pan.x/zoom} ${bds.minY-pan.y/zoom} ${vW/zoom} ${vH/zoom}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--text-faint)"/></marker>
        <marker id="aH" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-indigo)"/></marker>
        <marker id="aC" markerWidth="4" markerHeight="3" refX="4" refY="1.5" orient="auto"><polygon points="0 0,4 1.5,0 3" fill="var(--accent-purple-light)"/></marker>
        <filter id="gl"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {gE.map((e,i)=>{const from=byId[e.from],to=byId[e.to];if(!from||!to)return null;const hl=hlE.has(i);const mx=(from.x+TOTAL+to.x)/2;
        return <path key={i} d={`M${from.x+TOTAL} ${from.y} C${mx} ${from.y},${mx} ${to.y},${to.x-6} ${to.y}`}
          fill="none" stroke={e.conv?(hl?"var(--accent-purple-light)":"#c084fc22"):(hl?"var(--accent-indigo)":"var(--border)")} strokeWidth={e.conv?(hl?1.2:.6):(hl?2.5:1)} strokeDasharray={e.conv?"5,4":"none"}
          markerEnd={e.conv?(hl?"url(#aC)":""):(hl?"url(#aH)":"url(#arr)")} opacity={!hov&&!selG?.5:hl?1:.1}
          style={e.conv?{animation:"pdash 2s linear infinite"}:undefined}/>;
      })}
      {gN.map(n=>{const t=TT[n.type]||TT.component;const isNew=n.isNew&&!rev.has(n.id);const isH=hov===n.id;const isS=selG===n.id;const dim=(hov||selG)&&!conn.has(n.id);const comp=n.compliance?CS[n.compliance]:null;
        const lx=n.x,rx=n.x+CW+GAP;
        return <g key={n.id} onMouseEnter={()=>setHov(n.id)} onMouseLeave={()=>setHov(null)} onClick={e=>{e.stopPropagation();setSelG(n.id);onSelect(n);if(isNew)onRev(n.id);}} style={{cursor:"pointer",opacity:dim?.12:1,transition:"opacity .2s"}}>
          {(isH||isS)&&<rect x={lx-3} y={n.y-CH/2-3} width={TOTAL+6} height={CH+6} rx={9} fill="none" stroke={t.border} strokeWidth="1.5" opacity=".35" filter="url(#gl)"/>}
          <rect x={lx} y={n.y-CH/2} width={CW} height={CH} rx={6} fill={t.bg} stroke={(isH||isS)?t.border:`${t.border}44`} strokeWidth={(isH||isS)?1.5:1}/>
          <rect x={lx+4} y={n.y-CH/2+4} width={CW-8} height={12} rx={2} fill={t.border} fillOpacity=".08"/>
          <SvgMark type={n.type} cx={lx+14} cy={n.y-CH/2+10} r={4}/>
          <text x={lx+24} y={n.y-CH/2+12.5} fontSize="8" fill={t.border} fontWeight="700" fontFamily="monospace" opacity=".7">{t.label}</text>
          <text x={lx+10} y={n.y+2} fontSize="10.5" fill={t.text} fontWeight="600">{n.name.length>20?n.name.slice(0,18)+"…":n.name}</text>
          <text x={lx+10} y={n.y+14} fontSize="7" fill="var(--text-muted)" fontFamily="monospace">{n.token} · BLK {n.block}</text>
          {comp&&<circle cx={lx+CW-10} cy={n.y-CH/2+10} r="3.5" fill={comp.c} opacity=".9"/>}
          <rect x={rx} y={n.y-CH/2} width={CW} height={CH} rx={6} fill="var(--bg-app-header)" stroke={(isH||isS)?`${t.border}88`:"var(--border)"} strokeWidth={(isH||isS)?1.5:1}/>
          <rect x={rx+4} y={n.y-CH/2+4} width={CW-8} height={12} rx={2} fill="var(--border)" fillOpacity=".5"/>
          <text x={rx+10} y={n.y-CH/2+12.5} fontSize="8" fill="var(--text-tertiary)" fontWeight="600" fontFamily="monospace" opacity=".7">Supplier</text>
          <text x={rx+10} y={n.y+2} fontSize="10" fill="var(--text-primary)" fontWeight="500">{(n.supplier||"").length>20?n.supplier.slice(0,18)+"…":n.supplier}</text>
          <text x={rx+10} y={n.y+14} fontSize="7.5" fill="var(--text-muted)" fontFamily="monospace">{(n.location||"").length>22?n.location.slice(0,20)+"…":n.location}</text>
          {isNew&&<g><rect x={lx+TOTAL-32} y={n.y-CH/2-5} width={28} height={12} rx={3} fill="#312e81"/><text x={lx+TOTAL-18} y={n.y-CH/2+3} fontSize="7" fill="var(--accent-indigo-light)" textAnchor="middle" fontWeight="700" fontFamily="monospace">✦ NEW</text></g>}
          {n.itar&&<g><rect x={rx+CW-26} y={n.y+CH/2-12} width={22} height={10} rx={2} fill="#7f1d1d"/><text x={rx+CW-15} y={n.y+CH/2-4.5} fontSize="6" fill="#fca5a5" textAnchor="middle" fontWeight="700" fontFamily="monospace">ITAR</text></g>}
          {n.isConv&&<rect x={lx} y={n.y+CH/2-1} width={TOTAL} height="2" rx="1" fill="var(--accent-purple-light)" opacity=".3"/>}
        </g>;
      })}
    </svg>
    <div style={{position:"absolute",bottom:12,left:16,display:"flex",gap:10,padding:"6px 10px",background:"#0a0c10dd",borderRadius:6,border:"1px solid var(--border)"}}>
      {[{c:"var(--border)",l:"Supply Link"},{c:"var(--accent-purple-light)",l:"Convergence",dash:true},{c:"var(--accent-green)",l:"Compliant",dot:true},{c:"var(--accent-amber)",l:"Expiring",dot:true},{c:"var(--accent-red)",l:"Non-Compliant",dot:true}].map(x=><div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
        {x.dot?<div style={{width:7,height:7,borderRadius:"50%",background:x.c}}/>:<div style={{width:14,height:2,background:x.c,opacity:.6}}/>}
        <span style={{fontSize:8,color:"var(--text-muted)",fontFamily:"monospace"}}>{x.l}</span>
      </div>)}
    </div>
  </div>;
}

function RiskMatrix({data}){
  const suppliers=useMemo(()=>{const l=[];function w(n){if(n.type!=="customer"&&n.type!=="system")l.push(n);if(n.children)n.children.forEach(w);}w(data);return l;},[data]);
  const scored=useMemo(()=>suppliers.map(s=>{
    let cr=s.compliance==="compliant"?.1+Math.random()*.12:s.compliance==="expiring"?.55+Math.random()*.15:s.compliance==="expired"?.82+Math.random()*.12:.3+Math.random()*.15;
    let cn=.15+Math.random()*.2;
    if(s.notes?.match(/SOLE|~75%/))cn=.82+Math.random()*.12;
    else if(s.convergenceKey)cn=.48+Math.random()*.15;
    else if(s.notes?.match(/Conflict/i))cn=.62+Math.random()*.12;
    return{...s,cr,cn};
  }),[suppliers]);
  const[hovDot,setHovDot]=useState(null);
  const st=useMemo(()=>{const comp=compCounts(data);const tr=traceability(data);const it=itarCount(data);const ev=evalStats(data);const co=countryBk(data);const tb=typeBk(data);const countries=Object.entries(co).sort((a,b)=>b[1]-a[1]);const total=Object.values(co).reduce((a,b)=>a+b,0);return{comp,tr,it,ev,countries,total,cc:countries.length,tb};},[data]);
  const W=640,H=400,P=56;
  return <div style={{width:"100%",height:"100%",overflow:"auto",padding:"20px 30px"}}>
    <div style={{fontSize:13,fontWeight:700,color:"var(--text-secondary)",fontFamily:"var(--font-mono)",marginBottom:16,letterSpacing:".04em"}}>SUPPLY CHAIN RISK MATRIX</div>
    <svg width={W+P*2} height={H+P*2} style={{display:"block",marginBottom:8}}>
      <rect x={P} y={P} width={W/2} height={H/2} fill="#052e1606"/><rect x={P+W/2} y={P} width={W/2} height={H/2} fill="#450a0a08"/><rect x={P} y={P+H/2} width={W/2} height={H/2} fill="#052e160a"/><rect x={P+W/2} y={P+H/2} width={W/2} height={H/2} fill="#451a0306"/>
      <text x={P+W/4} y={P+26} fontSize="11" fill="#f59e0b22" textAnchor="middle" fontFamily="monospace" fontWeight="700">MONITOR</text>
      <text x={P+W*3/4} y={P+26} fontSize="11" fill="#ef444422" textAnchor="middle" fontFamily="monospace" fontWeight="700">CRITICAL</text>
      <text x={P+W/4} y={P+H-14} fontSize="11" fill="#22c55e22" textAnchor="middle" fontFamily="monospace" fontWeight="700">MANAGED</text>
      <text x={P+W*3/4} y={P+H-14} fontSize="11" fill="#f5920b22" textAnchor="middle" fontFamily="monospace" fontWeight="700">DIVERSIFY</text>
      {[.25,.5,.75].map(v=><g key={v}><line x1={P+v*W} y1={P} x2={P+v*W} y2={P+H} stroke="var(--border)" strokeWidth=".5" strokeDasharray="4,6"/><line x1={P} y1={P+v*H} x2={P+W} y2={P+v*H} stroke="var(--border)" strokeWidth=".5" strokeDasharray="4,6"/></g>)}
      <line x1={P+W/2} y1={P} x2={P+W/2} y2={P+H} stroke="var(--border)" strokeWidth="1"/><line x1={P} y1={P+H/2} x2={P+W} y2={P+H/2} stroke="var(--border)" strokeWidth="1"/>
      <line x1={P} y1={P+H} x2={P+W} y2={P+H} stroke="#2a3040" strokeWidth="1.5"/><line x1={P} y1={P} x2={P} y2={P+H} stroke="#2a3040" strokeWidth="1.5"/>
      <text x={P+W/2} y={P+H+36} fontSize="10" fill="var(--text-tertiary)" textAnchor="middle" fontFamily="monospace">CONCENTRATION RISK →</text>
      <text x="16" y={P+H/2} fontSize="10" fill="var(--text-tertiary)" textAnchor="middle" fontFamily="monospace" transform={`rotate(-90,16,${P+H/2})`}>COMPLIANCE RISK →</text>
      {scored.map((s,i)=>{const cx=P+s.cn*W,cy=P+(1-s.cr)*H;const isH=hovDot===i;
        return <g key={i} onMouseEnter={()=>setHovDot(i)} onMouseLeave={()=>setHovDot(null)} style={{cursor:"pointer"}}>
          <circle cx={cx} cy={cy} r={isH?14:8} fill={(TT[s.type]||TT.component).border} opacity={isH?".12":".05"}/>
          <SvgMark type={s.type} cx={cx} cy={cy} r={isH?7:5}/>
          {isH&&<g><rect x={cx+14} y={cy-28} width={165} height={42} rx={5} fill="var(--bg-surface)" stroke="var(--border)" strokeWidth="1"/>
            <text x={cx+22} y={cy-12} fontSize="10" fill="var(--text-bright)" fontWeight="600">{s.name}</text>
            <text x={cx+22} y={cy} fontSize="8.5" fill="var(--text-secondary)" fontFamily="monospace">{s.supplier}</text>
            <text x={cx+22} y={cy+10} fontSize="7.5" fill={CS[s.compliance]?.c||"var(--text-tertiary)"} fontFamily="monospace">{CS[s.compliance]?.l||"Unknown"}</text>
          </g>}
        </g>;})}
    </svg>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:20}}>
      {Object.entries(TT).filter(([k])=>!["customer","system"].includes(k)).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:4}}><NodeIcon type={k} size={12}/><span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace"}}>{v.label}</span></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:16,maxWidth:840}}>
      <div style={{background:"var(--bg-app-header)",border:"1px solid var(--border)",borderRadius:8,padding:16}}>
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".08em",marginBottom:12}}>SUPPLIER CERTIFICATIONS</div>
        {[{k:"compliant",l:"Valid"},{k:"expiring",l:"Expiring Soon"},{k:"expired",l:"Non-Compliant"},{k:"pending",l:"Pending"}].filter(x=>st.comp[x.k]>0).map(x=>{const c=CS[x.k];const tot=st.comp.compliant+st.comp.expiring+st.comp.expired+st.comp.pending;const pct=Math.round(st.comp[x.k]/tot*100);
          return <div key={x.k} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:c.c}}>{c.i} {x.l}</span><span style={{fontSize:10,color:c.c,fontWeight:700,fontFamily:"monospace"}}>{st.comp[x.k]} ({pct}%)</span></div><div style={{height:4,background:"var(--bg-surface)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c.c,borderRadius:2,opacity:.6}}/></div></div>;})}
      </div>
      <div style={{background:"var(--bg-app-header)",border:"1px solid var(--border)",borderRadius:8,padding:16}}>
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".08em",marginBottom:12}}>SECURITY & EVALUATION</div>
        <div style={{display:"flex",gap:12,marginBottom:16}}>
          {[{v:st.it,l:"ITAR",cl:"#fca5a5",bg:"#1c0a0a",bc:"#7f1d1d33"},{v:st.ev.e,l:"Evaluated",cl:"var(--accent-green)",bg:"var(--accent-green-bg)",bc:"#22c55e33"},{v:st.ev.ne,l:"Not Eval'd",cl:"var(--accent-amber)",bg:"var(--bg-surface)",bc:"var(--border)"}].map(x=>
            <div key={x.l} style={{flex:1,textAlign:"center",padding:10,background:x.bg,borderRadius:6,border:`1px solid ${x.bc}`}}><div style={{fontSize:20,fontWeight:700,color:x.cl,fontFamily:"monospace"}}>{x.v}</div><div style={{fontSize:8,color:x.cl,opacity:.7}}>{x.l}</div></div>)}
        </div>
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",marginBottom:8}}>TRACEABILITY</div>
        {[{l:"Active Depth",v:st.tr.ad,cl:"var(--accent-cyan)",g:"linear-gradient(90deg,#22d3ee,#3b82f6)",t:`${st.tr.raw} of ${st.tr.raw+st.tr.other} → raw source`},
          {l:"Coverage",v:st.tr.nc,cl:"var(--accent-indigo)",g:"linear-gradient(90deg,#818cf8,#6366f1)",t:`~${st.tr.ph} nodes pending`}].map(x=>
          <div key={x.l} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"var(--text-secondary)"}}>{x.l}</span><span style={{fontSize:10,color:x.cl,fontWeight:700,fontFamily:"monospace"}}>{x.v}%</span></div><div style={{height:4,background:"var(--bg-surface)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${x.v}%`,background:x.g,borderRadius:2}}/></div><div style={{fontSize:8,color:"var(--text-muted)",marginTop:2}}>{x.t}</div></div>)}
      </div>
      <div style={{background:"var(--bg-app-header)",border:"1px solid var(--border)",borderRadius:8,padding:16}}>
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".08em",marginBottom:12}}>GEOGRAPHIC DISTRIBUTION</div>
        <div style={{fontSize:20,fontWeight:700,color:"var(--accent-blue)",fontFamily:"monospace",marginBottom:6}}>{st.cc} <span style={{fontSize:11,color:"var(--text-tertiary)",fontWeight:400}}>countries</span></div>
        {st.countries.slice(0,8).map(([co,ct])=>{const pct=Math.round(ct/st.total*100);return <div key={co} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{fontSize:10,color:"var(--text-secondary)",width:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{co}</span><div style={{flex:1,height:4,background:"var(--bg-surface)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:"var(--accent-blue)",borderRadius:2,opacity:.5}}/></div><span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",width:40,textAlign:"right"}}>{ct} ({pct}%)</span></div>;})}
      </div>
      <div style={{background:"var(--bg-app-header)",border:"1px solid var(--border)",borderRadius:8,padding:16}}>
        <div style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",letterSpacing:".08em",marginBottom:12}}>TOKEN TYPES</div>
        {Object.entries(st.tb).sort((a,b)=>b[1]-a[1]).map(([type,ct])=>{const t=TT[type]||TT.component;const total=Object.values(st.tb).reduce((a,b)=>a+b,0);const pct=Math.round(ct/total*100);
          return <div key={type} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><NodeIcon type={type} size={12}/><span style={{fontSize:10,color:t.text,width:85}}>{t.label}</span><div style={{flex:1,height:4,background:"var(--bg-surface)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:t.border,borderRadius:2,opacity:.5}}/></div><span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",width:40,textAlign:"right"}}>{ct} ({pct}%)</span></div>;})}
      </div>
    </div>
  </div>;
}

function Detail({node,onClose}){
  if(!node)return null;const t=TT[node.type]||TT.component;const cs=node.compliance?CS[node.compliance]:null;
  return <div style={{width:340,flexShrink:0,borderLeft:"1px solid var(--border)",overflow:"auto",background:"var(--bg-app-header)",animation:"pfade .2s ease"}}>
    <div style={{padding:"16px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}><NodeIcon type={node.type} size={18}/><span style={{fontSize:10,color:t.border,fontFamily:"monospace",fontWeight:700}}>{t.label}</span></div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:16,padding:0}}>×</button>
      </div>
      <h2 style={{fontSize:15,fontWeight:700,color:"var(--text-bright)",margin:"0 0 4px"}}>{node.name}</h2>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}><span style={{fontSize:9,background:"var(--bg-surface)",color:"var(--text-tertiary)",padding:"2px 6px",borderRadius:3,fontFamily:"monospace"}}>{node.token}</span><span style={{fontSize:9,background:"var(--bg-surface)",color:"var(--text-tertiary)",padding:"2px 6px",borderRadius:3,fontFamily:"monospace"}}>BLK #{node.block}</span></div>
      {[{l:"SUPPLIER",v:node.supplier},{l:"LOCATION",v:node.location}].filter(f=>f.v).map(f=><div key={f.l} style={{marginBottom:12}}><div style={{fontSize:9,color:"var(--text-tertiary)",letterSpacing:".08em",marginBottom:2,fontFamily:"monospace"}}>{f.l}</div><div style={{fontSize:12,color:"var(--text-primary)"}}>{f.v}</div></div>)}
      {node.notes&&<div style={{marginBottom:14}}><div style={{fontSize:9,color:"var(--text-tertiary)",marginBottom:2,fontFamily:"monospace"}}>NOTES</div><div style={{fontSize:11,color:"var(--text-secondary)",lineHeight:1.6}}>{node.notes}</div></div>}
      {cs&&<div style={{marginBottom:14}}><div style={{fontSize:9,color:"var(--text-tertiary)",marginBottom:6,fontFamily:"monospace"}}>COMPLIANCE</div><div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:cs.bg,borderRadius:5,border:`1px solid ${cs.c}33`}}><span style={{fontSize:14,color:cs.c}}>{cs.i}</span><div style={{fontSize:12,fontWeight:600,color:cs.c}}>{cs.l}</div></div></div>}
      <div style={{marginBottom:14}}><div style={{fontSize:9,color:"var(--text-tertiary)",marginBottom:6,fontFamily:"monospace"}}>EVALUATION</div>
        {node.evaluated?<div style={{padding:"8px 10px",background:"var(--accent-green-bg)",borderRadius:5,border:"1px solid #22c55e33"}}><div style={{fontSize:11,fontWeight:600,color:"var(--accent-green)"}}>✓ {node.evaluated.result.toUpperCase()}</div><div style={{fontSize:10,color:"var(--text-tertiary)"}}>{node.evaluated.date} by {node.evaluated.by}</div></div>
        :<button style={{width:"100%",padding:"8px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-secondary)",cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>{["rawsource","material","chemical","component"].includes(node.type)?"⚙ Run Parts Eval":"✓ Run Supplier Eval"}</button>}</div>
      {node.attestations?.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:9,color:"var(--text-tertiary)",marginBottom:6,fontFamily:"monospace"}}>ATTESTATIONS ({node.attestations.length})</div>
        {node.attestations.map((a,i)=>{const s=CS[a.status]||CS.pending;return <div key={i} style={{padding:"8px 10px",background:"var(--bg-surface)",borderRadius:5,marginBottom:4,borderLeft:`2px solid ${s.c}`}}><div style={{fontSize:11,fontWeight:600,color:"var(--text-primary)"}}>{a.name}</div><div style={{fontSize:10,color:"var(--text-tertiary)",display:"flex",justifyContent:"space-between"}}><span>{a.issuer}</span><span style={{color:s.c}}>Exp: {a.expires}</span></div></div>;})}</div>}
      {node.itar&&<div style={{padding:"10px",background:"#1c0a0a",border:"1px solid #7f1d1d",borderRadius:6,fontSize:11,color:"#fca5a5",marginBottom:14}}>⚠ ITAR CONTROLLED — Export restricted</div>}
      {node.children?.length>0&&<div><div style={{fontSize:9,color:"var(--text-tertiary)",marginBottom:6,fontFamily:"monospace"}}>INPUTS ({node.children.length})</div>
        {node.children.map(c=><div key={c.id} style={{fontSize:11,padding:"3px 6px",marginBottom:1,color:TT[c.type]?.text||"#aaa",display:"flex",alignItems:"center",gap:5}}><NodeIcon type={c.type} size={11}/>{c.name}</div>)}</div>}
    </div>
  </div>;
}

export default function Radiant(){
  const[exMap,setExMap]=useState({"stellar":true,"engine":true});const[sel,setSel]=useState(null);const[persona,setPers]=useState("engineer");const[vert,setVert]=useState("aerospace");
  const[showP,setShowP]=useState(false);const[showV,setShowV]=useState(false);const[mapExp,setMapExp]=useState(false);const[rev,setRev]=useState(new Set());const[sFocus,setSF]=useState(false);const[sideCol,setSC]=useState(false);const[view,setView]=useState("graph");
  const tog=useCallback(id=>setExMap(p=>({...p,[id]:!p[id]})),[]);
  const expAll=useCallback(()=>{const m={};const w=n=>{m[n.id]=true;if(n.children)n.children.forEach(w);};w(DATA);setExMap(m);},[]);
  const colAll=useCallback(()=>setExMap({"stellar":true,"engine":true}),[]);
  const doRev=useCallback(id=>setRev(p=>new Set([...p,id])),[]);
  const stats=useMemo(()=>({total:countN(DATA),depth:maxD(DATA),conv:convKeys(DATA).size,comp:compCounts(DATA),newN:newCount(DATA),trace:traceability(DATA)}),[]);
  const p=PERSONAS.find(x=>x.id===persona),v=VERTICALS.find(x=>x.id===vert);
  return <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"var(--bg-deep)",color:"var(--text-primary)",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",overflow:"hidden"}}>
    <style>{CSS}</style>
    <div style={{height:48,flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"0 16px",borderBottom:"1px solid var(--border)",background:"var(--bg-app-header)",zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginRight:4}}><RadiantLogo size={22}/><div style={{lineHeight:1}}><div style={{fontSize:14,fontWeight:700,color:"var(--text-bright)",fontFamily:"var(--font-mono)"}}>RADIANT</div><div style={{fontSize:8,color:"var(--text-muted)",fontFamily:"monospace",letterSpacing:".1em"}}>by PROVENANCE</div></div></div>
      <div style={{width:1,height:24,background:"var(--border)",margin:"0 4px"}}/>
      {["Supplier Requirements","Parts Requirements"].map(l=><button key={l} style={{padding:"5px 10px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-secondary)",cursor:"pointer",fontSize:11,whiteSpace:"nowrap"}}>{l}</button>)}
      <div style={{flex:1}}/>
      <div style={{position:"relative",width:sFocus?340:240,transition:"width .2s"}}><input placeholder="Search suppliers, parts…" onFocus={()=>setSF(true)} onBlur={()=>setSF(false)} style={{width:"100%",padding:"5px 10px 5px 28px",background:"var(--bg-surface)",border:`1px solid ${sFocus?"var(--accent-blue)":"var(--border)"}`,borderRadius:5,color:"var(--text-primary)",fontSize:11,outline:"none"}}/><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"var(--text-muted)"}}>⌕</span></div>
      <div style={{flex:1}}/>
      <div style={{position:"relative"}}><button onClick={()=>{setShowV(!showV);setShowP(false);}} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-primary)",cursor:"pointer",fontSize:11}}><span style={{color:"var(--accent-indigo)"}}>{v?.icon}</span><span style={{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v?.label}</span><span style={{fontSize:9,color:"var(--text-muted)"}}>▾</span></button>
        {showV&&<div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:6,padding:4,zIndex:100,minWidth:300,boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}>{VERTICALS.map(x=><div key={x.id} onClick={()=>{if(!x.soon){setVert(x.id);setShowV(false);}}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:4,cursor:x.soon?"default":"pointer",opacity:x.soon?.4:1,color:x.id===vert?"var(--accent-indigo)":"var(--text-primary)",fontSize:12}}><span>{x.icon}</span><div style={{flex:1}}><div>{x.label}</div><div style={{fontSize:9,color:"var(--text-muted)"}}>{x.desc}</div></div>{x.soon&&<span style={{fontSize:8,color:"var(--text-muted)",fontFamily:"monospace"}}>COMING SOON</span>}</div>)}</div>}</div>
      <div style={{position:"relative"}}><button onClick={()=>{setShowP(!showP);setShowV(false);}} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-secondary)",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}><span>{p?.icon}</span>{p?.label}<span style={{fontSize:9,color:"var(--text-muted)"}}>▾</span></button>
        {showP&&<div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:6,padding:4,zIndex:100,minWidth:220,boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}>{PERSONAS.map(x=><div key={x.id} onClick={()=>{if(!x.soon){setPers(x.id);setShowP(false);}}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:4,cursor:x.soon?"default":"pointer",opacity:x.soon?.4:1,color:x.id===persona?"var(--accent-indigo)":"var(--text-primary)",fontSize:12}}><span>{x.icon}</span>{x.label}{x.soon&&<span style={{fontSize:8,color:"var(--text-muted)",marginLeft:"auto",fontFamily:"monospace"}}>COMING SOON</span>}</div>)}</div>}</div>
    </div>
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:sideCol?40:360,flexShrink:0,display:"flex",flexDirection:"column",borderRight:"1px solid var(--border)",background:"#0b0d12",transition:"width .25s",overflow:"hidden"}}>
        <div style={{padding:sideCol?"10px 8px":"10px 12px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          <button onClick={()=>setSC(!sideCol)} style={{background:"none",border:"none",color:"var(--text-tertiary)",cursor:"pointer",fontSize:14,padding:"2px 4px"}}>{sideCol?"»":"«"}</button>
          {!sideCol&&<><span style={{fontSize:10,fontWeight:700,color:"var(--text-secondary)",fontFamily:"monospace"}}>SUPPLY CHAIN</span><button style={{fontSize:9,padding:"2px 6px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:3,color:"var(--accent-indigo)",cursor:"pointer",fontFamily:"monospace"}}>+ System</button><div style={{flex:1}}/><button onClick={expAll} style={{fontSize:9,padding:"2px 6px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-tertiary)",cursor:"pointer",fontFamily:"monospace"}}>Expand</button><button onClick={colAll} style={{fontSize:9,padding:"2px 6px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-tertiary)",cursor:"pointer",fontFamily:"monospace"}}>Collapse</button></>}
        </div>
        {!sideCol&&<>
          <div style={{padding:"6px 12px",borderBottom:"1px solid var(--border)",display:"flex",gap:10,flexWrap:"wrap",flexShrink:0}}>
            {[{l:"TOKENS",v:stats.total,c:"var(--accent-blue)"},{l:"DEPTH",v:stats.depth,c:"var(--accent-cyan)"},{l:"CONVERGE",v:stats.conv,c:"var(--accent-purple-light)"}].map(s=><div key={s.l} style={{display:"flex",alignItems:"baseline",gap:3}}><span style={{fontSize:13,fontWeight:700,color:s.c,fontFamily:"monospace"}}>{s.v}</span><span style={{fontSize:8,color:"var(--text-muted)"}}>{s.l}</span></div>)}
            <div style={{display:"flex",alignItems:"baseline",gap:3}}><span style={{fontSize:13,fontWeight:700,color:"var(--accent-green)",fontFamily:"monospace"}}>{stats.comp.compliant}</span><span style={{fontSize:8,color:"var(--text-muted)"}}>OK</span></div>
            {stats.comp.expiring>0&&<div style={{display:"flex",alignItems:"baseline",gap:3}}><span style={{fontSize:13,fontWeight:700,color:"var(--accent-amber)",fontFamily:"monospace"}}>{stats.comp.expiring}</span><span style={{fontSize:8,color:"var(--text-muted)"}}>⚠</span></div>}
            {stats.newN>0&&<div style={{display:"flex",alignItems:"baseline",gap:3,animation:"ppulse 2s ease-in-out infinite"}}><span style={{fontSize:13,fontWeight:700,color:"var(--accent-indigo)",fontFamily:"monospace"}}>{stats.newN}</span><span style={{fontSize:8,color:"var(--accent-indigo)"}}>✦ NEW</span></div>}
          </div>
          <div style={{padding:"8px 12px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            <div style={{fontSize:8,color:"var(--text-tertiary)",marginBottom:6,fontFamily:"monospace"}}>TRACEABILITY</div>
            {[{l:"Active Depth",v:stats.trace.ad,cl:"var(--accent-cyan)",g:"linear-gradient(90deg,#22d3ee,#3b82f6)",t:`${stats.trace.raw}/${stats.trace.raw+stats.trace.other} → raw`},
              {l:"Coverage",v:stats.trace.nc,cl:"var(--accent-indigo)",g:"linear-gradient(90deg,#818cf8,#6366f1)",t:`~${stats.trace.ph} pending`}].map(x=>
              <div key={x.l} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:9,color:"var(--text-secondary)"}}>{x.l}</span><span style={{fontSize:9,color:x.cl,fontWeight:700,fontFamily:"monospace"}}>{x.v}%</span></div><div style={{height:3,background:"var(--bg-surface)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${x.v}%`,background:x.g,borderRadius:2}}/></div><div style={{fontSize:7,color:"var(--text-muted)",marginTop:1}}>{x.t}</div></div>)}
          </div>
          <div style={{padding:"5px 12px",borderBottom:"1px solid var(--border)",display:"flex",gap:6,flexWrap:"wrap",flexShrink:0}}>
            {Object.entries(TT).map(([k,vv])=><div key={k} style={{display:"flex",alignItems:"center",gap:3}}><NodeIcon type={k} size={10}/><span style={{fontSize:8,color:"var(--text-muted)"}}>{vv.label}</span></div>)}
          </div>
          <div style={{flex:1,overflow:"auto",padding:"6px 8px"}}><TN node={DATA} ex={exMap} tog={tog} onSel={setSel} selId={sel?.id} rev={rev} onRev={doRev}/></div>
        </>}
      </div>
      <div style={{flex:1,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:12,left:16,zIndex:30,display:"flex",gap:1,background:"var(--bg-surface)",borderRadius:6,border:"1px solid var(--border)",overflow:"hidden"}}>
          {[{id:"graph",l:"Network Graph"},{id:"risk",l:"Risk Matrix"}].map(tab=><button key={tab.id} onClick={()=>setView(tab.id)} style={{padding:"6px 14px",fontSize:11,fontFamily:"monospace",border:"none",cursor:"pointer",background:view===tab.id?"var(--border)":"transparent",color:view===tab.id?"var(--text-primary)":"var(--text-muted)"}}>{tab.l}</button>)}
        </div>
        {view==="graph"&&<NetGraph data={DATA} onSelect={setSel} rev={rev} onRev={doRev}/>}
        {view==="risk"&&<RiskMatrix data={DATA}/>}
        {!mapExp&&view==="graph"&&<WMap data={DATA} expanded={false} onToggle={()=>setMapExp(true)}/>}
        {mapExp&&<WMap data={DATA} expanded={true} onToggle={()=>setMapExp(false)}/>}
      </div>
      {sel&&<Detail node={sel} onClose={()=>setSel(null)}/>}
    </div>
    <div style={{height:26,flexShrink:0,display:"flex",alignItems:"center",padding:"0 16px",borderTop:"1px solid var(--border)",background:"var(--bg-app-header)",gap:16}}>
      <RadiantLogo size={12}/><span style={{fontSize:9,color:"var(--text-faint)",fontFamily:"monospace"}}>{v?.label?.toUpperCase()}</span><div style={{flex:1}}/><span style={{fontSize:9,color:"var(--accent-green)",fontFamily:"monospace"}}>● CONNECTED</span><span style={{fontSize:9,color:"var(--text-faint)",fontFamily:"monospace"}}>BLK 251</span>
    </div>
  </div>;
}
