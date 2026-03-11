import { TT } from '../data/tokens';

export default function SvgMark({type, cx, cy, r, nonScaling, lod}) {
  const c = (TT[type]||TT.component).border;
  const s = r || 5;
  const ve = nonScaling ? "non-scaling-stroke" : undefined;
  const b = lod ? 1 : 0; // stroke boost for LOD mode
  switch(type) {
    case "customer": return <polygon points={`${cx},${cy-s} ${cx+s*.87},${cy-s*.5} ${cx+s*.87},${cy+s*.5} ${cx},${cy+s} ${cx-s*.87},${cy+s*.5} ${cx-s*.87},${cy-s*.5}`} fill="none" stroke={c} strokeWidth={1.2+b} vectorEffect={ve}/>;
    case "system": return <polygon points={`${cx},${cy-s} ${cx+s*.87},${cy-s*.5} ${cx+s*.87},${cy+s*.5} ${cx},${cy+s} ${cx-s*.87},${cy+s*.5} ${cx-s*.87},${cy-s*.5}`} fill={c} fillOpacity=".3" stroke={c} strokeWidth={1+b} vectorEffect={ve}/>;
    case "assembly": return <polygon points={`${cx},${cy-s} ${cx+s},${cy} ${cx},${cy+s} ${cx-s},${cy}`} fill={c} fillOpacity=".15" stroke={c} strokeWidth={1.2+b} vectorEffect={ve}/>;
    case "subassembly": return <><circle cx={cx-s*.5} cy={cy-s*.3} r={s*.4} fill={lod?c:"none"} fillOpacity={lod?".15":undefined} stroke={c} strokeWidth={1+b} vectorEffect={ve}/><circle cx={cx+s*.5} cy={cy-s*.3} r={s*.4} fill={lod?c:"none"} fillOpacity={lod?".15":undefined} stroke={c} strokeWidth={1+b} vectorEffect={ve}/><circle cx={cx} cy={cy+s*.4} r={s*.4} fill={lod?c:"none"} fillOpacity={lod?".15":undefined} stroke={c} strokeWidth={1+b} vectorEffect={ve}/></>;
    case "component": return <rect x={cx-s*.7} y={cy-s*.7} width={s*1.4} height={s*1.4} fill={c} fillOpacity=".15" stroke={c} strokeWidth={1.2+b} rx="1" vectorEffect={ve}/>;
    case "process": return <><circle cx={cx} cy={cy} r={s*.8} fill={lod?"var(--accent-orange)":"none"} fillOpacity={lod?".15":undefined} stroke={c} strokeWidth={1.2+b} vectorEffect={ve}/><circle cx={cx} cy={cy} r={s*.3} fill="none" stroke={c} strokeWidth={.8+b} vectorEffect={ve}/></>;
    case "material": return <path d={`M${cx},${cy-s} C${cx+s},${cy-s*.2} ${cx+s*.6},${cy+s} ${cx},${cy+s} C${cx-s*.6},${cy+s} ${cx-s},${cy-s*.2} ${cx},${cy-s}Z`} fill={c} fillOpacity=".15" stroke={c} strokeWidth={1.2+b} vectorEffect={ve}/>;
    case "chemical": return <><circle cx={cx-s*.35} cy={cy} r={s*.55} fill={c} fillOpacity=".08" stroke={c} strokeWidth={1+b} vectorEffect={ve}/><circle cx={cx+s*.35} cy={cy} r={s*.55} fill={c} fillOpacity=".08" stroke={c} strokeWidth={1+b} vectorEffect={ve}/></>;
    case "rawsource": return <polygon points={`${cx},${cy-s} ${cx+s*.3},${cy-s*.3} ${cx+s},${cy} ${cx+s*.3},${cy+s*.3} ${cx},${cy+s} ${cx-s*.3},${cy+s*.3} ${cx-s},${cy} ${cx-s*.3},${cy-s*.3}`} fill={lod?"var(--accent-red)":"none"} fillOpacity={lod?".15":undefined} stroke={c} strokeWidth={1.2+b} strokeLinejoin="round" vectorEffect={ve}/>;
    default: return <circle cx={cx} cy={cy} r={s*.7} fill="none" stroke={c} strokeWidth={1.2+b} vectorEffect={ve}/>;
  }
}
