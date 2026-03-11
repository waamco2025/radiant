export const TT = {
  customer:    { bg:"var(--tt-customer-bg)", border:"var(--tt-customer-border)", text:"var(--tt-customer-text)", borderFaint:"var(--tt-customer-border-faint)", label:"Organization" },
  program:     { bg:"var(--tt-program-bg)", border:"var(--tt-program-border)", text:"var(--tt-program-text)", borderFaint:"var(--tt-program-border-faint)", label:"Program" },
  system:      { bg:"var(--tt-system-bg)", border:"var(--tt-system-border)", text:"var(--tt-system-text)", borderFaint:"var(--tt-system-border-faint)", label:"System" },
  assembly:    { bg:"var(--tt-assembly-bg)", border:"var(--tt-assembly-border)", text:"var(--tt-assembly-text)", borderFaint:"var(--tt-assembly-border-faint)", label:"Assembly" },
  subassembly: { bg:"var(--tt-subassembly-bg)", border:"var(--tt-subassembly-border)", text:"var(--tt-subassembly-text)", borderFaint:"var(--tt-subassembly-border-faint)", label:"Sub-Assembly" },
  component:   { bg:"var(--tt-component-bg)", border:"var(--tt-component-border)", text:"var(--tt-component-text)", borderFaint:"var(--tt-component-border-faint)", label:"Component" },
  process:     { bg:"var(--tt-process-bg)", border:"var(--tt-process-border)", text:"var(--tt-process-text)", borderFaint:"var(--tt-process-border-faint)", label:"Process" },
  material:    { bg:"var(--tt-material-bg)", border:"var(--tt-material-border)", text:"var(--tt-material-text)", borderFaint:"var(--tt-material-border-faint)", label:"Material" },
  chemical:    { bg:"var(--tt-chemical-bg)", border:"var(--tt-chemical-border)", text:"var(--tt-chemical-text)", borderFaint:"var(--tt-chemical-border-faint)", label:"Compound" },
  rawsource:   { bg:"var(--tt-rawsource-bg)", border:"var(--tt-rawsource-border)", text:"var(--tt-rawsource-text)", borderFaint:"var(--tt-rawsource-border-faint)", label:"Raw Source" },
};

export const CS = { compliant:{c:"var(--cs-compliant-color)",bg:"var(--cs-compliant-bg)",l:"Compliant",i:"✓"}, expiring:{c:"var(--cs-expiring-color)",bg:"var(--cs-expiring-bg)",l:"Expiring Soon",i:"⚠"}, expired:{c:"var(--cs-expired-color)",bg:"var(--cs-expired-bg)",l:"Non-Compliant",i:"✕"}, pending:{c:"var(--cs-pending-color)",bg:"var(--cs-pending-bg)",l:"Pending Review",i:"…"} };

export const PERSONAS = [{id:"engineer",label:"Engineer",icon:"⚙"},{id:"procurement",label:"Procurement",icon:"🔗",soon:true},{id:"compliance",label:"Quality / Compliance",icon:"✓",soon:true},{id:"risk",label:"Risk Analyst",icon:"◎",soon:true},{id:"manager",label:"Program Manager",icon:"▦",soon:true}];

export const VERTICALS = [{id:"aerospace",label:"Stellar Dynamics Aerospace",icon:"✦",desc:"Supply chain provenance"},{id:"healthcare",label:"FastCo Health Systems",icon:"✚",desc:"Personnel credentials"},{id:"govco",label:"GovCo Federal Satellite Agency",icon:"★",desc:"Component provenance"},{id:"microco",label:"MicroCo Microelectronics",icon:"◈",desc:"Assembly & process tracking"},{id:"autoco",label:"AutoCo Motors",icon:"⬢",desc:"Vehicle supply chain"}];

export const SUPPLIER_PERSONA = {
  id: 'supplier-david-park',
  name: 'David Park',
  title: 'Supply Chain Manager',
  org: 'Curtiss-Wright Defense Solutions',
  role: 'supplier',
  location: 'Bethlehem, PA, USA',
  customerNetworks: [
    { verticalKey: 'aerospace', customerName: 'Stellar Dynamics Aerospace', supplierNodeId: 'n1195' },
    { verticalKey: 'govco', customerName: 'GovCo Federal Satellite Agency', supplierNodeId: 'n733' },
  ],
};
