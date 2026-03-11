// Seeded PRNG for deterministic generation
function mulberry32(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return h;
}

const SUPPLIERS = [
  'Precision Dynamics Corp', 'Meridian Manufacturing', 'Atlas Materials',
  'Apex Components Ltd', 'Sterling Technologies', 'Pacific Fabrication',
  'Nordic Precision AB', 'Titan Alloys', 'Quantum Machining',
  'Summit Engineering', 'Horizon Metals', 'Vanguard Composites',
  'Delta Process Systems', 'Pinnacle Industries', 'Centurion Materials',
  'Forge Advanced Mfg', 'Eclipse Precision', 'Nexus Components',
  'Keystone Fabrication', 'Pioneer Materials Co', 'Arcadia Systems',
  'Nova Technical', 'Ridgeline Manufacturing', 'Catalyst Precision',
];

const LOCATIONS = [
  'Phoenix, AZ, USA', 'Stuttgart, Germany', 'Osaka, Japan',
  'Toronto, Canada', 'S\u00e3o Paulo, Brazil', 'Seoul, South Korea',
  'Sheffield, UK', 'Milan, Italy', 'Taipei, Taiwan',
  'Monterrey, Mexico', 'Bangalore, India', 'Singapore',
  'Lyon, France', 'Melbourne, Australia', 'Shenzhen, China',
  'Tel Aviv, Israel', 'Zurich, Switzerland', 'Prague, Czech Republic',
  'Gothenburg, Sweden', 'Busan, South Korea',
];

const COUNTRIES = [
  'USA', 'Germany', 'Japan', 'Canada', 'Brazil', 'South Korea',
  'UK', 'Italy', 'Taiwan', 'Mexico', 'India', 'Singapore',
  'France', 'Australia', 'China', 'Israel', 'Switzerland',
  'Czech Republic', 'Sweden', 'South Korea',
];

const NAMES_BY_VERTICAL = {
  aerospace: [
    'Turbine Blade Assembly', 'Thrust Chamber', 'Gimbal Actuator',
    'Hydraulic Pump', 'Fuel Injector Plate', 'Turbopump Housing',
    'Heat Shield Panel', 'Guidance Sensor Module', 'LOX Valve Assembly',
    'Thermal Protection Tile', 'Avionics Controller', 'Propellant Line',
    'Bearing Assembly', 'Igniter Module', 'Nozzle Extension',
    'Pressure Transducer', 'Flow Control Valve', 'Structural Fitting',
    'Wire Harness Assembly', 'Connector Backshell',
  ],
  healthcare: [
    'Catheter Assembly', 'Surgical Stapler', 'Implant Housing',
    'Biocompatible Coating', 'Sterilization Pouch', 'Syringe Barrel',
    'Needle Assembly', 'Drug Delivery Pump', 'Orthopedic Screw',
    'Diagnostic Sensor', 'Infusion Set', 'Heart Valve Frame',
    'Stent Component', 'Dialysis Membrane', 'Endoscope Tip',
    'Prosthetic Joint', 'Blood Bag Tubing', 'Surgical Mesh',
    'Pacemaker Housing', 'Dental Implant Abutment',
  ],
  govco: [
    'Solar Panel Array', 'Star Tracker', 'Reaction Wheel',
    'Thermal Radiator', 'Antenna Feed Horn', 'Transponder Module',
    'Battery Cell Pack', 'Structural Bus Panel', 'Deployment Mechanism',
    'Command Receiver', 'Telemetry Encoder', 'Power Distribution Unit',
    'Optical Payload Lens', 'Propulsion Thruster', 'Momentum Wheel',
    'Solar Cell Cover Glass', 'Harness Assembly', 'Connector Panel',
    'Thermal Blanket Layer', 'Radiation Shield',
  ],
  microco: [
    'MOSFET Die', 'Substrate Wafer', 'Wire Bond Assembly',
    'Lead Frame', 'Ceramic Package', 'Die Attach Film',
    'Epoxy Molding Compound', 'Gold Bonding Wire', 'Silicon Ingot',
    'Photomask Set', 'Capacitor Array', 'Resistor Network',
    'Crystal Oscillator', 'Power Regulator IC', 'FPGA Module',
    'Memory Controller', 'RF Amplifier Die', 'Sensor ASIC',
    'Voltage Reference', 'Signal Processor',
  ],
  autoco: [
    'Brake Caliper Assembly', 'ECU Module', 'Wiring Harness',
    'Catalytic Converter', 'Fuel Rail', 'Throttle Body',
    'Steering Column', 'Suspension Bushing', 'Turbocharger Housing',
    'Exhaust Manifold', 'Wheel Hub Assembly', 'Alternator Core',
    'Transmission Gear', 'Radiator Assembly', 'Oxygen Sensor',
    'Ignition Coil', 'Control Arm', 'Driveshaft Assembly',
    'Intercooler Core', 'Differential Housing',
  ],
};

const TYPE_DISTRIBUTION = ['component', 'component', 'component', 'component', 'component', 'component', 'component', 'component',
  'material', 'material', 'material', 'material', 'material',
  'assembly', 'assembly', 'assembly',
  'rawsource', 'rawsource',
  'process', 'process'];

const MATERIALS = ['Inconel 718', 'Ti-6Al-4V', '316L SS', 'Al 7075-T6', 'Haynes 230', 'Copper C11000', 'PEEK', 'Hastelloy X', 'Monel 400', 'Invar 36'];
const ALLOYS = ['Grade 5', 'Grade 23', 'AMS 5662', 'AMS 5663', 'AMS 4928', 'ASTM B637', 'UNS N07718', 'AMS 5596'];
const COMPOSITIONS = ['Ni 52%, Cr 19%, Fe 18%', 'Ti 90%, Al 6%, V 4%', 'Fe 65%, Cr 17%, Ni 12%', 'Al 90%, Zn 5.6%, Mg 2.5%', 'Ni 57%, Cr 22%, W 14%'];
const HEAT_TREATMENTS = ['Solution Annealed', 'Precipitation Hardened', 'Stress Relieved', 'Normalized', 'Quench & Tempered', 'Age Hardened'];
const SURFACE_FINISHES = ['Ra 0.8 \u00b5m', 'Ra 1.6 \u00b5m', 'Ra 3.2 \u00b5m', '16 \u00b5in', '32 \u00b5in', 'Electropolished', 'Passivated', 'Anodized'];
const CERTS = ['AS9100 Rev D', 'ISO 13485', 'NIST 800-171', 'ISO 9001:2015', 'NADCAP', 'ITAR Registered'];
const CERT_BODIES = ['Bureau Veritas', 'T\u00dcV S\u00dcD', 'SGS', 'Intertek', 'DNV GL', 'Lloyd\'s Register', 'BSI Group'];
const COMPLIANCE = ['AS9100D', 'ISO 9001:2015', 'NADCAP AC7004', 'MIL-STD-810G', 'RTCA DO-160G', 'ISO 13485:2016'];
const TEST_METHODS = ['ASTM E8', 'ASTM B557', 'ISO 6892-1', 'MIL-STD-1553', 'RTCA DO-160'];
const TEST_LABS = ['Element Materials', 'Westmoreland Mechanical', 'Touchstone Research', 'IMR Test Labs', 'NTS'];
const EXPORT_CONTROLS = ['EAR99', 'ITAR Cat XV', 'No restrictions', 'Dual-use'];
const ACTIVITIES = ['Registered on chain', 'Certification uploaded', 'Evaluation completed', 'Disclosure type updated', 'New attestation added'];

const FIELD_TEMPLATE = {
  identification: {
    label: 'Identification',
    fields: [
      { key: 'partNumber', label: 'Part Number', type: 'text' },
      { key: 'serialNumber', label: 'Serial / Lot Number', type: 'text' },
      { key: 'revision', label: 'Revision', type: 'text' },
      { key: 'dateOfManufacture', label: 'Date of Manufacture', type: 'date' },
      { key: 'shelfLife', label: 'Shelf Life', type: 'text' },
    ],
  },
  materialComposition: {
    label: 'Material Composition',
    fields: [
      { key: 'primaryMaterial', label: 'Primary Material', type: 'text' },
      { key: 'alloyGrade', label: 'Alloy / Grade', type: 'text' },
      { key: 'composition', label: 'Chemical Composition', type: 'text' },
      { key: 'heatTreatment', label: 'Heat Treatment', type: 'text' },
      { key: 'surfaceFinish', label: 'Surface Finish', type: 'text' },
    ],
  },
  mechanicalProperties: {
    label: 'Mechanical Properties',
    fields: [
      { key: 'tensileStrength', label: 'Tensile Strength', type: 'text' },
      { key: 'yieldStrength', label: 'Yield Strength', type: 'text' },
      { key: 'hardness', label: 'Hardness', type: 'text' },
      { key: 'elongation', label: 'Elongation', type: 'text' },
      { key: 'impactResistance', label: 'Impact Resistance', type: 'text' },
    ],
  },
  certifications: {
    label: 'Certifications',
    fields: [
      { key: 'primaryCert', label: 'Primary Certification', type: 'text' },
      { key: 'certBody', label: 'Certifying Body', type: 'text' },
      { key: 'certDate', label: 'Certification Date', type: 'date' },
      { key: 'certExpiry', label: 'Certification Expiry', type: 'date' },
      { key: 'complianceStandard', label: 'Compliance Standard', type: 'text' },
    ],
  },
  testing: {
    label: 'Test Results',
    fields: [
      { key: 'testMethod', label: 'Test Method', type: 'text' },
      { key: 'testDate', label: 'Test Date', type: 'date' },
      { key: 'testResult', label: 'Result', type: 'text' },
      { key: 'testLab', label: 'Testing Laboratory', type: 'text' },
      { key: 'reportRef', label: 'Report Reference', type: 'text' },
    ],
  },
  supplyChain: {
    label: 'Supply Chain',
    fields: [
      { key: 'countryOfOrigin', label: 'Country of Origin', type: 'text' },
      { key: 'manufacturingSite', label: 'Manufacturing Site', type: 'text' },
      { key: 'batchNumber', label: 'Batch / Heat Number', type: 'text' },
      { key: 'rawMaterialSource', label: 'Raw Material Source', type: 'text' },
      { key: 'exportControl', label: 'Export Control Status', type: 'text' },
    ],
  },
};

// Collect all field keys for disclosure visibility
const ALL_FIELD_KEYS = [];
for (const cat of Object.values(FIELD_TEMPLATE)) {
  for (const f of cat.fields) ALL_FIELD_KEYS.push(f.key);
}

export { FIELD_TEMPLATE, ALL_FIELD_KEYS };

export function generatePlatformAssets(verticalKey) {
  const seed = hashStr(verticalKey || 'aerospace') + 9999;
  const rand = mulberry32(seed);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const range = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const chance = pct => rand() < pct;

  const HEX = '0123456789abcdef';
  const mkToken = () => { let h = '0x'; for (let i = 0; i < 8; i++) h += HEX[Math.floor(rand() * 16)]; return h; };

  const names = NAMES_BY_VERTICAL[verticalKey] || NAMES_BY_VERTICAL.aerospace;
  const assets = [];

  for (let i = 0; i < 80; i++) {
    const nameBase = names[i % names.length];
    const suffix = i >= names.length ? ` ${String.fromCharCode(65 + Math.floor(i / names.length) - 1)}` : '';
    const name = nameBase + suffix;
    const type = pick(TYPE_DISTRIBUTION);
    const locIdx = Math.floor(rand() * LOCATIONS.length);
    const loc = LOCATIONS[locIdx];
    const country = COUNTRIES[locIdx];
    const supplier = pick(SUPPLIERS);
    const block = range(180000, 240000);
    const regYear = chance(0.5) ? 2025 : 2026;
    const regMonth = String(range(1, 12)).padStart(2, '0');
    const regDay = String(range(1, 28)).padStart(2, '0');
    const registeredDate = `${regYear}-${regMonth}-${regDay}`;

    // Claims summary
    const total = range(1, 12);
    const verifiedPct = 0.6 + rand() * 0.3; // 60-90%
    const verified = Math.round(total * verifiedPct);
    const remaining = total - verified;
    const contested = remaining > 0 && chance(0.15) ? range(1, Math.min(remaining, 2)) : 0;
    const expired = remaining - contested > 0 && chance(0.3) ? range(1, remaining - contested) : 0;
    const pending = remaining - contested - expired;

    const claimsSummary = { total, verified, pending, expired, contested };
    const health = contested > 0 ? 'critical' : (expired > 0 || pending > 0) ? 'warning' : verified > 0 ? 'healthy' : 'unknown';

    // Disclosure types
    const types = [];
    if (chance(0.7)) types.push('full');
    if (chance(0.6)) types.push('selective');
    if (total >= 3 && chance(0.4)) types.push('derivative');
    if (types.length === 0) types.push('full');
    const disclosureTypes = types;

    // Data fields
    const partPrefix = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const partNum = `${partPrefix}-${range(1000, 9999)}-${String.fromCharCode(65 + range(0, 25))}`;
    const serialNum = `SN-${String(regYear).slice(2)}${regMonth}-${String(range(1000, 9999))}`;
    const mat = pick(MATERIALS);
    const tensile = range(800, 1400);
    const yieldStr = Math.round(tensile * (0.7 + rand() * 0.2));
    const hardness = range(28, 62);
    const certDate = `${chance(0.5) ? 2024 : 2025}-${String(range(1, 12)).padStart(2, '0')}-${String(range(1, 28)).padStart(2, '0')}`;
    const certExpiryYear = parseInt(certDate.slice(0, 4)) + range(1, 3);
    const certExpiry = `${certExpiryYear}${certDate.slice(4)}`;
    const testDate = `${chance(0.5) ? 2025 : 2026}-${String(range(1, 12)).padStart(2, '0')}-${String(range(1, 28)).padStart(2, '0')}`;

    const dataFields = {
      partNumber: partNum,
      serialNumber: serialNum,
      revision: `Rev ${String.fromCharCode(65 + range(0, 5))}`,
      dateOfManufacture: `${regYear}-${regMonth}-${String(range(1, 28)).padStart(2, '0')}`,
      shelfLife: `${range(12, 120)} months`,
      primaryMaterial: mat,
      alloyGrade: pick(ALLOYS),
      composition: pick(COMPOSITIONS),
      heatTreatment: pick(HEAT_TREATMENTS),
      surfaceFinish: pick(SURFACE_FINISHES),
      tensileStrength: `${tensile} MPa`,
      yieldStrength: `${yieldStr} MPa`,
      hardness: `${hardness} HRC`,
      elongation: `${range(5, 25)}%`,
      impactResistance: `${range(15, 80)} J`,
      primaryCert: pick(CERTS),
      certBody: pick(CERT_BODIES),
      certDate,
      certExpiry,
      complianceStandard: pick(COMPLIANCE),
      testMethod: pick(TEST_METHODS),
      testDate,
      testResult: chance(0.85) ? 'Pass' : 'Conditional Pass',
      testLab: pick(TEST_LABS),
      reportRef: `RPT-${range(10000, 99999)}`,
      countryOfOrigin: country,
      manufacturingSite: loc,
      batchNumber: `HT-${range(100000, 999999)}`,
      rawMaterialSource: pick(SUPPLIERS),
      exportControl: pick(EXPORT_CONTROLS),
    };

    // Disclosure visibility
    const selectiveCount = range(15, 20);
    const shuffled = [...ALL_FIELD_KEYS].sort(() => rand() - 0.5);
    const selectiveFields = shuffled.slice(0, selectiveCount);

    const disclosureVisibility = {
      full: [...ALL_FIELD_KEYS],
      selective: selectiveFields,
      derivative: [],
    };

    // Activity log
    const activityCount = range(3, 5);
    const activity = [];
    for (let a = 0; a < activityCount; a++) {
      const actYear = chance(0.5) ? 2025 : 2026;
      const actMonth = String(range(1, 12)).padStart(2, '0');
      const actDay = String(range(1, 28)).padStart(2, '0');
      activity.push({
        action: pick(ACTIVITIES),
        date: `${actYear}-${actMonth}-${actDay}`,
        actor: supplier,
      });
    }
    activity.sort((a, b) => b.date.localeCompare(a.date));

    assets.push({
      id: `plat-${verticalKey || 'aerospace'}-${i}`,
      name,
      type,
      supplier,
      location: loc,
      country,
      token: mkToken(),
      block,
      registeredDate,
      claimsSummary,
      health,
      disclosureTypes,
      dataFields,
      disclosureVisibility,
      activity,
    });
  }

  return assets;
}
