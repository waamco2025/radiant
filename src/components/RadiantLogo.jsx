export default function RadiantLogo({size=22}) {
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
