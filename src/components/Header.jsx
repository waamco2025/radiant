import { useState, useRef, useEffect } from 'react';
import { VERTICALS } from '../data/tokens';
import RadiantLogo from './RadiantLogo';

export default function Header({vert, onVertChange, vertConfig, credits, supplierCredits, onCreditsClick, onInviteClick, onRequirementsClick, onSystemClick, appMode, onRoleChange, supplierPersona, onRegisterAsset, onAssetDirectoryClick, assetDirActive, theme, onToggleTheme}) {
  const[showV,setShowV]=useState(false);
  const[showAcct,setShowAcct]=useState(false);
  const v=VERTICALS.find(x=>x.id===vert);
  const roles=vertConfig?.roles||[];
  const isSupplier=appMode==='supplier';

  /* Active persona info */
  const activeName=isSupplier?(supplierPersona?.name||'David Park'):(roles.find(r=>r.active)?.name||'Thomas Crowley');
  const activeTitle=isSupplier?(supplierPersona?.title||'Supply Chain Manager'):(roles.find(r=>r.active)?.title||'Engineer');
  const activeInitials=activeName.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();

  /* Close dropdowns on outside click */
  const vRef=useRef(null);const aRef=useRef(null);
  useEffect(()=>{
    const h=e=>{
      if(showV&&vRef.current&&!vRef.current.contains(e.target))setShowV(false);
      if(showAcct&&aRef.current&&!aRef.current.contains(e.target))setShowAcct(false);
    };
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);
  },[showV,showAcct]);

  const roleIcon=t=>{
    const m={'Network Administrator':'◉','Engineer':'⚙','Supply Chain Manager':'⬡','Supplier':'⬡','Staff':'⬡','Contractor':'⬡','Vendor':'⬡'};
    return m[t]||'○';
  };

  const handleRoleClick=(r)=>{
    if(r.soon)return;
    if(onRoleChange){
      if(r.roleType==='supplier')onRoleChange('supplier');
      else onRoleChange('buyer');
    }
    setShowAcct(false);
  };

  return <div style={{height:48,flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"0 16px",borderBottom:"1px solid var(--border)",background:"var(--bg-app-header)",zIndex:50}}>
    {/* ── Left: Logo ── */}
    <div style={{display:"flex",alignItems:"center",gap:6,marginRight:4}}>
      <RadiantLogo size={22}/>
      <div style={{lineHeight:1}}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--text-bright)",fontFamily:"var(--font-mono)"}}>RADIANT</div>
        <div style={{fontSize:8,color:"var(--text-muted)",fontFamily:"monospace",letterSpacing:".1em"}}>by PROVENANCE</div>
      </div>
    </div>
    <div style={{width:1,height:24,background:"var(--border)",margin:"0 4px"}}/>

    {/* ── Vertical selector (buyer) or static org label (supplier) ── */}
    {isSupplier
      ? <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-primary)",fontSize:12,fontWeight:500,userSelect:"none"}}>
          <span style={{color:"var(--accent-indigo)",fontSize:14}}>⬡</span>
          <span style={{maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{supplierPersona?.org}</span>
        </div>
      : <div ref={vRef} style={{position:"relative"}}>
          <button onClick={()=>{setShowV(!showV);setShowAcct(false);}} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-primary)",cursor:"pointer",fontSize:12,fontWeight:500,transition:"border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-hover)";}} onMouseLeave={e=>{if(!showV)e.currentTarget.style.borderColor="var(--border)";}}>
            <span style={{color:"var(--accent-indigo)",fontSize:14}}>{v?.icon}</span>
            <span style={{maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v?.label}</span>
            <span style={{fontSize:9,color:"var(--text-muted)"}}>▾</span>
          </button>
          {showV&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:6,padding:4,zIndex:100,minWidth:300,boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}>
            {VERTICALS.map(x=><div key={x.id} onClick={()=>{if(!x.soon){onVertChange(x.id);setShowV(false);}}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:4,cursor:x.soon?"default":"pointer",opacity:x.soon?.4:1,color:x.id===vert?"var(--accent-indigo)":"var(--text-primary)",fontSize:12}}>
              <span>{x.icon}</span>
              <div style={{flex:1}}>
                <div>{x.label}</div>
                <div style={{fontSize:9,color:"var(--text-muted)"}}>{x.desc}</div>
              </div>
              {x.soon&&<span style={{fontSize:8,color:"var(--text-muted)",fontFamily:"monospace"}}>COMING SOON</span>}
            </div>)}
          </div>}
        </div>
    }

    {/* ── Supplier-only buttons ── */}
    {isSupplier&&<>
      <div style={{width:1,height:24,background:"var(--border)",margin:"0 4px"}}/>
      <button onClick={onRegisterAsset} style={{padding:"5px 10px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--accent-indigo)",cursor:"pointer",fontSize:11,whiteSpace:"nowrap",fontFamily:"var(--font-mono)",fontWeight:600,transition:"border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent-indigo)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";}}>+ Register Asset</button>
    </>}

    {/* ── Buyer-only buttons ── */}
    {!isSupplier&&<>
      <div style={{width:1,height:24,background:"var(--border)",margin:"0 4px"}}/>
      <button onClick={onRequirementsClick} style={{padding:"5px 12px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-secondary)",cursor:"pointer",fontSize:11,whiteSpace:"nowrap",transition:"border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-hover)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";}}>Requirements</button>
      <button onClick={onSystemClick} style={{padding:"5px 10px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--accent-indigo)",cursor:"pointer",fontSize:11,whiteSpace:"nowrap",fontFamily:"var(--font-mono)",fontWeight:600,transition:"border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent-indigo)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";}}>+ {vertConfig?.tierHierarchy?.find(t=>t.key==='program')?.label||'Program'}</button>
      <button onClick={onInviteClick} style={{padding:"5px 10px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--accent-indigo)",cursor:"pointer",fontSize:11,whiteSpace:"nowrap",fontFamily:"var(--font-mono)",fontWeight:600,transition:"border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent-indigo)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";}}>+ Invite</button>
      <button onClick={onAssetDirectoryClick} style={{padding:"5px 12px",background:assetDirActive?"var(--border-faint)":"transparent",border:`1px solid ${assetDirActive?"var(--accent-indigo)":"var(--border)"}`,borderRadius:5,color:assetDirActive?"var(--accent-indigo-text)":"var(--text-secondary)",cursor:"pointer",fontSize:11,whiteSpace:"nowrap",transition:"border-color .2s, color .2s, background .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=assetDirActive?"var(--accent-indigo)":"var(--border-hover)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=assetDirActive?"var(--accent-indigo)":"var(--border)";}}>Asset Directory</button>
    </>}

    <div style={{flex:1}}/>

    {/* ── Right: Credits + Account menu ── */}
    {(isSupplier?supplierCredits:credits)!=null&&<button onClick={onCreditsClick} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--accent-indigo)",cursor:"pointer",fontSize:11,fontFamily:"var(--font-mono)",fontWeight:600,transition:"border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent-indigo)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";}}>
      <span style={{fontSize:13}}>◇</span>{isSupplier?supplierCredits:credits}<span style={{fontSize:8,color:"var(--text-muted)",fontWeight:400}}>credits</span>
    </button>}

    {/* Theme toggle */}
    <button onClick={onToggleTheme} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'} style={{display:"flex",alignItems:"center",justifyContent:"center",width:32,height:32,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-secondary)",cursor:"pointer",fontSize:15,transition:"border-color .2s, color .2s",padding:0}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-hover)";e.currentTarget.style.color="var(--text-primary)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-secondary)";}}>
      {theme==='dark'?'☀':'☾'}
    </button>

    <div ref={aRef} style={{position:"relative"}}>
      <button onClick={()=>{setShowAcct(!showAcct);setShowV(false);}} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-primary)",cursor:"pointer",fontSize:11,fontFamily:"monospace",transition:"border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-hover)";}} onMouseLeave={e=>{if(!showAcct)e.currentTarget.style.borderColor="var(--border)";}}>
        <div style={{width:20,height:20,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--text-bright)"}}>{activeInitials}</div>
        <span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeName}</span>
        <span style={{fontSize:9,color:"var(--text-muted)"}}>▾</span>
      </button>
      {showAcct&&<div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:6,padding:0,zIndex:100,minWidth:260,boxShadow:"0 8px 24px rgba(0,0,0,.5)",overflow:"hidden"}}>
        {/* User info header */}
        <div style={{padding:"12px 14px 10px",borderBottom:"1px solid var(--border)",background:"var(--bg-card)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"var(--text-bright)",flexShrink:0}}>{activeInitials}</div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text-bright)"}}>{activeName}</div>
              <div style={{fontSize:10,color:"var(--text-tertiary)"}}>{activeTitle}</div>
            </div>
          </div>
        </div>

        {/* Role switching */}
        <div style={{padding:"6px 0"}}>
          <div style={{padding:"4px 14px 6px",fontSize:9,color:"var(--text-muted)",fontFamily:"monospace",letterSpacing:".08em"}}>SWITCH ROLE</div>
          {roles.map((r,i)=>{
            const isCurrent=isSupplier?(r.roleType==='supplier'):!!r.active;
            return <div key={i} onClick={()=>handleRoleClick(r)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",cursor:r.soon?"default":"pointer",opacity:r.soon?.45:1,background:isCurrent?"rgba(99,102,241,.08)":"transparent",transition:"background .15s"}} onMouseEnter={e=>{if(!r.soon&&!isCurrent)e.currentTarget.style.background="rgba(255,255,255,.04)";}} onMouseLeave={e=>{if(!isCurrent)e.currentTarget.style.background="transparent";}}>
              <span style={{fontSize:12,color:isCurrent?"var(--accent-indigo)":"var(--text-tertiary)",width:16,textAlign:"center"}}>{roleIcon(r.title)}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:isCurrent?"var(--accent-indigo-text)":"var(--text-primary)"}}>{r.name}</div>
                <div style={{fontSize:9,color:isCurrent?"var(--accent-indigo)":"var(--text-muted)"}}>{r.title}</div>
              </div>
              {isCurrent&&<span style={{fontSize:8,color:"var(--accent-indigo)",fontFamily:"monospace",fontWeight:600}}>ACTIVE</span>}
              {r.soon&&<span style={{fontSize:8,color:"var(--text-muted)",fontFamily:"monospace"}}>COMING SOON</span>}
            </div>;
          })}
        </div>

        {/* Account actions */}
        <div style={{borderTop:"1px solid var(--border)",padding:"6px 0"}}>
          {[{icon:'⚙',label:'Account Settings'},{icon:'☰',label:'Preferences'},{icon:'↗',label:'Logout'}].map(a=><div key={a.label} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",cursor:"default",opacity:.4}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.02)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <span style={{fontSize:11,color:"var(--text-tertiary)",width:16,textAlign:"center"}}>{a.icon}</span>
            <span style={{fontSize:11,color:"var(--text-secondary)",flex:1}}>{a.label}</span>
            <span style={{fontSize:8,color:"var(--text-muted)",fontFamily:"monospace"}}>COMING SOON</span>
          </div>)}
        </div>
      </div>}
    </div>
  </div>;
}
