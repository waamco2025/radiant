import { useState, useEffect } from 'react';
import { VERTICALS } from '../data/tokens';
import RadiantLogo from './RadiantLogo';

const VIEW_LABELS={graph:'Network Graph',map:'Supply Map',risk:'Risk Matrix'};

export default function Footer({vert,view,networkName,viewLabel}) {
  const v=VERTICALS.find(x=>x.id===vert);
  const displayName=(networkName||v?.label||'').toUpperCase();
  const[blk]=useState(()=>Math.floor(Math.random()*100)+200);
  const[ts,setTs]=useState(()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  useEffect(()=>{const i=setInterval(()=>setTs(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})),60000);return()=>clearInterval(i);},[]);

  return <div style={{height:26,flexShrink:0,display:"flex",alignItems:"center",padding:"0 16px",borderTop:"1px solid var(--border)",background:"var(--bg-app-header)",gap:12}}>
    <RadiantLogo size={12}/>
    <span style={{fontSize:9,color:"var(--text-tertiary)",fontFamily:"monospace",fontWeight:600}}>{displayName}</span>
    <div style={{flex:1}}/>
    <span style={{fontSize:9,color:"var(--text-muted)",fontFamily:"monospace"}}>{viewLabel||VIEW_LABELS[view]||''}</span>
    <div style={{flex:1}}/>
    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:"var(--accent-green)",display:"inline-block",animation:"pdot 2s ease-in-out infinite"}}/>
      <span style={{fontSize:9,color:"var(--accent-green)",fontFamily:"monospace"}}>CONNECTED</span>
    </span>
    <span style={{fontSize:9,color:"var(--text-muted)",fontFamily:"monospace"}}>BLK #{blk}</span>
    <span style={{fontSize:9,color:"var(--text-faint)",fontFamily:"monospace"}}>{ts}</span>
  </div>;
}
