import { TT } from '../data/tokens';

export default function NodeIcon({type, size=14}) {
  const c = (TT[type]||TT.component).border;
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{flexShrink:0, display:"inline-block", verticalAlign:"middle"}}>
    {iconFor(type, c)}
  </svg>;
}

function iconFor(type, c) {
  switch(type) {
    case "customer":
      return <polygon points="12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5"
        fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>;
    case "system":
      return <>
        <polygon points="12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5"
          fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
        <polygon points="12,7 16.3,9.5 16.3,14.5 12,17 7.7,14.5 7.7,9.5"
          fill={c} fillOpacity=".3" stroke="none"/>
      </>;
    case "assembly":
      return <>
        <polygon points="12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5"
          fill={c} fillOpacity=".08" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
        <line x1="12" y1="3" x2="12" y2="12" stroke={c} strokeWidth="1" opacity=".5"/>
        <line x1="4.2" y1="16.5" x2="12" y2="12" stroke={c} strokeWidth="1" opacity=".5"/>
        <line x1="19.8" y1="16.5" x2="12" y2="12" stroke={c} strokeWidth="1" opacity=".5"/>
      </>;
    case "subassembly":
      return <>
        <line x1="12" y1="7" x2="7" y2="16" stroke={c} strokeWidth="1" opacity=".4"/>
        <line x1="12" y1="7" x2="17" y2="16" stroke={c} strokeWidth="1" opacity=".4"/>
        <line x1="7" y1="16" x2="17" y2="16" stroke={c} strokeWidth="1" opacity=".4"/>
        <circle cx="12" cy="7" r="3" fill="none" stroke={c} strokeWidth="1.3"/>
        <circle cx="7" cy="16" r="3" fill="none" stroke={c} strokeWidth="1.3"/>
        <circle cx="17" cy="16" r="3" fill="none" stroke={c} strokeWidth="1.3"/>
      </>;
    case "component":
      return <>
        <polygon points="12,4 19,8 12,12 5,8"
          fill={c} fillOpacity=".15" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
        <polygon points="5,8 12,12 12,20 5,16"
          fill={c} fillOpacity=".08" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
        <polygon points="19,8 12,12 12,20 19,16"
          fill={c} fillOpacity=".04" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
      </>;
    case "process":
      return <>
        <polygon points="10.6,6.7 9.7,3.3 14.3,3.3 13.4,6.7 15.9,8.1 18.4,5.6 20.7,9.7 17.3,10.6 17.3,13.4 20.7,14.3 18.4,18.4 15.9,15.9 13.4,17.3 14.3,20.7 9.7,20.7 10.6,17.3 8.1,15.9 5.6,18.4 3.3,14.3 6.7,13.4 6.7,10.6 3.3,9.7 5.6,5.6 8.1,8.1"
          fill={c} fillOpacity=".1" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="2.5" fill="none" stroke={c} strokeWidth="1.3"/>
      </>;
    case "material":
      return <>
        <path d="M12,3 C12,3 20,11 20,15 C20,18.9 16.4,21 12,21 C7.6,21 4,18.9 4,15 C4,11 12,3 12,3 Z"
          fill={c} fillOpacity=".1" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
        <circle cx="10" cy="14" r="1" fill={c} opacity=".5"/>
        <circle cx="14" cy="13.5" r="1" fill={c} opacity=".4"/>
        <circle cx="12" cy="17" r="1" fill={c} opacity=".5"/>
      </>;
    case "chemical":
      return <>
        <circle cx="9" cy="12" r="6" fill={c} fillOpacity=".08" stroke={c} strokeWidth="1.3"/>
        <circle cx="15" cy="12" r="6" fill={c} fillOpacity=".08" stroke={c} strokeWidth="1.3"/>
      </>;
    case "rawsource":
      return <polygon points="12,3 14.5,9.5 21,12 14.5,14.5 12,21 9.5,14.5 3,12 9.5,9.5"
        fill="none" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>;
    default:
      return <circle cx="12" cy="12" r="8" fill="none" stroke={c} strokeWidth="1.5"/>;
  }
}
