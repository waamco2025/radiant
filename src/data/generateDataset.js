// Seeded PRNG for deterministic generation
function mulberry32(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function generateDataset(seed = 42) {
  const rand = mulberry32(seed);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const range = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const chance = pct => rand() < pct;
  let idCounter = 0;
  let blockCounter = 1;
  const mkId = () => `n${++idCounter}`;
  const mkBlock = () => { blockCounter += range(1, 8); return blockCounter; };

  // Seeded hash (replaces mkhash which used Math.random)
  const HEX = '0123456789abcdef';
  const mkHash = () => { let h = '0x'; for (let i = 0; i < 8; i++) h += HEX[Math.floor(rand() * 16)]; return h; };

  // Date helpers
  const pad2 = n => String(n).padStart(2, '0');
  const mkIsoDate = (minY, maxY) => {
    const y = range(minY, maxY), m = range(1, 12), d = range(1, 28);
    return `${y}-${pad2(m)}-${pad2(d)}T${pad2(range(0, 23))}:${pad2(range(0, 59))}:00Z`;
  };
  const mkDateOnly = (minY, maxY) => {
    const y = range(minY, maxY), m = range(1, 12), d = range(1, 28);
    return `${y}-${pad2(m)}-${pad2(d)}`;
  };
  const mkRecentDate = () => `2026-02-${pad2(range(1, 16))}T${pad2(range(8, 17))}:${pad2(range(0, 59))}:00Z`;

  // ── Reference data ──────────────────────────────────────────────────
  const COUNTRIES = [
    { loc: "Houston, TX, USA", lat: 29.76, lng: -95.37 },
    { loc: "Sacramento, CA, USA", lat: 38.58, lng: -121.49 },
    { loc: "Denver, CO, USA", lat: 39.74, lng: -104.99 },
    { loc: "Wichita, KS, USA", lat: 37.69, lng: -97.34 },
    { loc: "Portland, OR, USA", lat: 45.52, lng: -122.68 },
    { loc: "Huntington, WV, USA", lat: 38.42, lng: -82.44 },
    { loc: "Golden, CO, USA", lat: 39.76, lng: -105.22 },
    { loc: "Irvine, CA, USA", lat: 33.68, lng: -117.83 },
    { loc: "Leonia, NJ, USA", lat: 40.86, lng: -73.99 },
    { loc: "Seattle, WA, USA", lat: 47.61, lng: -122.33 },
    { loc: "Phoenix, AZ, USA", lat: 33.45, lng: -112.07 },
    { loc: "Tucson, AZ, USA", lat: 32.22, lng: -110.97 },
    { loc: "Stennis, MS, USA", lat: 30.36, lng: -89.60 },
    { loc: "El Segundo, CA, USA", lat: 33.92, lng: -118.42 },
    { loc: "Bethesda, MD, USA", lat: 38.98, lng: -77.09 },
    { loc: "Gothenburg, Sweden", lat: 57.71, lng: 11.97 },
    { loc: "Wiesbaden, Germany", lat: 50.08, lng: 8.24 },
    { loc: "Munich, Germany", lat: 48.14, lng: 11.58 },
    { loc: "Stuttgart, Germany", lat: 48.78, lng: 9.18 },
    { loc: "Toulouse, France", lat: 43.60, lng: 1.44 },
    { loc: "Paris, France", lat: 48.86, lng: 2.35 },
    { loc: "Royston, UK", lat: 52.05, lng: -0.02 },
    { loc: "Bristol, UK", lat: 51.45, lng: -2.59 },
    { loc: "Derby, UK", lat: 52.92, lng: -1.47 },
    { loc: "Okazaki, Japan", lat: 34.95, lng: 137.17 },
    { loc: "Takefu, Japan", lat: 35.90, lng: 136.17 },
    { loc: "Nagoya, Japan", lat: 35.18, lng: 136.91 },
    { loc: "Tokyo, Japan", lat: 35.68, lng: 139.69 },
    { loc: "Sudbury, Canada", lat: 46.49, lng: -81.00 },
    { loc: "Montreal, Canada", lat: 45.50, lng: -73.57 },
    { loc: "Toronto, Canada", lat: 43.65, lng: -79.38 },
    { loc: "Bushveld, South Africa", lat: -25.50, lng: 28.50 },
    { loc: "Johannesburg, South Africa", lat: -26.20, lng: 28.04 },
    { loc: "Araxá, Brazil", lat: -19.59, lng: -46.94 },
    { loc: "São Paulo, Brazil", lat: -23.55, lng: -46.63 },
    { loc: "Dubbo, Australia", lat: -32.24, lng: 148.60 },
    { loc: "Perth, Australia", lat: -31.95, lng: 115.86 },
    { loc: "Morenci, AZ, USA", lat: 33.08, lng: -109.35 },
    { loc: "Fresnillo, Mexico", lat: 23.17, lng: -102.87 },
    { loc: "Seoul, South Korea", lat: 37.57, lng: 126.98 },
    { loc: "Busan, South Korea", lat: 35.18, lng: 129.07 },
    { loc: "Taipei, Taiwan", lat: 25.03, lng: 121.57 },
    { loc: "Hsinchu, Taiwan", lat: 24.80, lng: 120.97 },
    { loc: "Shanghai, China", lat: 31.23, lng: 121.47 },
    { loc: "Shenzhen, China", lat: 22.54, lng: 114.06 },
    { loc: "Bangalore, India", lat: 12.97, lng: 77.59 },
    { loc: "Hyderabad, India", lat: 17.39, lng: 78.49 },
    { loc: "Tel Aviv, Israel", lat: 32.09, lng: 34.78 },
    { loc: "Milan, Italy", lat: 45.46, lng: 9.19 },
    { loc: "Turin, Italy", lat: 45.07, lng: 7.69 },
    { loc: "Warsaw, Poland", lat: 52.23, lng: 21.01 },
    { loc: "Singapore", lat: 1.35, lng: 103.82 },
    { loc: "Kuala Lumpur, Malaysia", lat: 3.14, lng: 101.69 },
    { loc: "Helsinki, Finland", lat: 60.17, lng: 24.94 },
    { loc: "Zurich, Switzerland", lat: 47.38, lng: 8.54 },
    { loc: "Oslo, Norway", lat: 59.91, lng: 10.75 },
    { loc: "Katanga, DRC", lat: -10.98, lng: 25.99 },
    { loc: "Spruce Pine, NC, USA", lat: 35.91, lng: -82.07 },
    { loc: "Manaus, Brazil", lat: -3.12, lng: -60.02 },
    { loc: "Cape Town, South Africa", lat: -33.92, lng: 18.42 },
  ];

  const SUPPLIERS = {
    program: ["Stellar Dynamics Inc.", "Stellar Dynamics Inc.", "Stellar Dynamics Inc."],
    system: ["Stellar (Engine Div.)", "Stellar (Avionics)", "Stellar (Structures)", "Stellar (Payload)", "Stellar (Thermal)", "Stellar (Power Systems)"],
    assembly: ["Aerojet Rocketdyne", "Honeywell Aerospace", "Northrop Grumman", "L3Harris Technologies", "Collins Aerospace", "Safran SA", "Rolls-Royce Defence", "BAE Systems", "Thales Group", "Leonardo DRS", "GE Aerospace", "Moog Inc.", "Parker Hannifin", "Curtiss-Wright", "Ducommun Inc."],
    subassembly: ["Precision Castparts", "Howmet Aerospace", "SKF Aerospace", "Eagle Industry", "Heico Corp", "TransDigm Group", "Triumph Group", "Arconic Corp", "Kaman Aerospace", "Meggitt PLC", "Senior Aerospace", "Woodward Inc.", "Eaton Aerospace", "Cobham Advanced", "Diehl Aviation"],
    component: ["CoorsTek", "Kulite Semiconductor", "Omega Engineering", "PCB Piezotronics", "TE Connectivity", "Amphenol Corp", "Vishay Intertechnology", "Molex LLC", "ITT Inc.", "Ametek Inc.", "Curtiss-Wright", "SPS Technologies", "Lisi Aerospace", "Cherry Aerospace", "PCC Fasteners", "Hi-Shear Corp", "Alcoa Fastening", "Stanley Engineered", "Microsemi Corp", "Texas Instruments"],
    process: ["PCC Structurals", "Bodycote plc", "Praxair Surface Tech", "Oerlikon Metco", "Chromalloy", "Solar Turbines", "Haynes International", "Kennametal Inc.", "Sandvik Coromant", "DMG Mori", "Mazak Corp", "Trumpf GmbH", "EOS GmbH", "Renishaw plc", "GE Additive"],
    material: ["Special Metals Corp", "Cannon-Muskegon", "Materion Corp", "ATI Inc.", "Carpenter Technology", "Haynes International", "Allegheny Technologies", "Sandvik Materials", "Toray Industries", "Hexcel Corp", "Solvay SA", "Cytec Industries", "Contitech AG", "Victrex plc", "Celanese Corp"],
    chemical: ["Oerlikon Metco", "PPG Industries", "Sherwin-Williams", "Henkel AG", "3M Company", "Dow Chemical", "BASF SE", "Cytec Solvay", "Momentive", "Huntsman Corp", "Evonik Industries", "Sika AG", "Lord Corp", "Parker Chomerics", "Loctite Aerospace"],
    rawsource: ["Vale Ltd", "Glencore plc", "Freeport-McMoRan", "Rio Tinto", "BHP Group", "Alcoa Corp", "CBMM", "Samancor Chrome", "Lynas Rare Earths", "Iluka Resources", "Alkane Resources", "Shin-Etsu Chemical", "Covia Holdings", "Fresnillo plc", "Norilsk Nickel", "Anglo American", "Teck Resources", "South32 Ltd", "First Quantum Minerals", "Umicore SA"],
  };

  const PROGRAM_NAMES = [
    { name: "Artemis IV Launch Campaign", key: "artemis" },
    { name: "GPS III Satellite Block II", key: "gps" },
    { name: "Orion Crew Module Qualification", key: "orion" },
  ];

  const SYSTEM_NAMES = [
    { name: "Meridian-IV Engine", key: "engine" },
    { name: "Avionics & Flight Control", key: "avionics" },
    { name: "Airframe & Structures", key: "structures" },
    { name: "Payload Integration", key: "payload" },
    { name: "Thermal Protection System", key: "thermal" },
    { name: "Power Distribution Unit", key: "power" },
  ];

  const ASSEMBLY_NAMES = {
    engine: ["HiP Fuel Turbopump", "Combustion Chamber", "Nozzle Extension", "Thrust Vector Control", "Propellant Valves", "Ignition Assembly", "Fuel Pre-Burner", "Turbine Exhaust System"],
    avionics: ["Flight Computer", "Inertial Navigation Unit", "Comm Transponder", "Power Mgmt Module", "Sensor Fusion Array", "Data Recorder Unit", "Guidance Control", "Telemetry Subsystem"],
    structures: ["Primary Fuselage Ring", "Interstage Adapter", "Payload Fairing", "Thrust Structure", "LOX Tank Assembly", "RP-1 Tank Assembly", "Raceway & Harness", "Landing Leg Array"],
    payload: ["Payload Attach Fitting", "Separation System", "Acoustic Blankets", "Payload Environmental", "Vibration Isolators", "Deployment Mechanism"],
    thermal: ["Ablative Heat Shield", "MLI Blanket Array", "Cryo Insulation Pack", "Active Cooling Loop", "Radiator Panel Array", "Thermal Interface Plates"],
    power: ["Li-Ion Battery Pack", "Solar Array Wing", "Power Converter Unit", "Harness & Distribution", "Pyrotechnic Controller", "Emergency Power Module"],
  };

  const SUBASSEMBLY_PREFIXES = ["Housing", "Impeller", "Manifold", "Bracket", "Seal Pack", "Bearing Set", "Interface Board", "Connector Set", "Insulation Pack", "Cover Plate", "Frame Segment", "Ring Segment", "Shaft Assembly", "Gear Train", "Actuator Unit", "Valve Body", "Filter Module", "Heat Exchanger", "Coupling Assy", "Mount Bracket", "Wiring Harness", "Shield Layer", "Sensor Array", "Control Board", "Pressure Vessel"];
  const COMPONENT_NAMES = ["Retaining Ring", "Seal Face", "Ball Bearing", "Thrust Washer", "O-Ring Set", "Mounting Bolt", "Dowel Pin", "Lock Nut", "Spring Clip", "Gasket", "Pressure Transducer", "Thermocouple", "Accelerometer", "Strain Gauge", "RTD Sensor", "Capacitor Array", "Resistor Network", "MOSFET Module", "FPGA Board", "ASIC Die", "Flex Cable", "Crimp Terminal", "Fiber Optic Link", "Waveguide Section", "Antenna Feed", "PCB Assembly", "Heat Sink", "Thermal Pad", "EMI Shield", "Conformal Coat"];
  const PROCESS_NAMES = ["Investment Casting", "5-Axis CNC", "Electron Beam Welding", "Friction Stir Welding", "Additive Mfg (SLM)", "Thermal Barrier Coat", "Plasma Spray", "Electroless Nickel", "Hard Chrome Plate", "Anodize Type III", "NDT Inspection", "X-Ray CT Scan", "Magnetic Particle Insp.", "Dye Penetrant Test", "Heat Treat HIP"];
  const MATERIAL_NAMES = ["Inconel 718 Billet", "MAR-M-247", "NARloy-Z Billet", "Ti-6Al-4V Plate", "Al 7075-T6 Sheet", "CFRP Prepreg", "Hastelloy X Rod", "Waspaloy Forging", "Rene 41 Bar", "A-286 Wire", "304L SS Sheet", "440C SS Bar", "Cu-Cr-Zr Alloy", "Be-Cu Strip", "Kovar Rod", "Invar 36 Plate", "Haynes 230", "Stellite 6B", "MP35N Wire", "Elgiloy Strip"];
  const CHEMICAL_NAMES = ["YSZ Powder", "Epoxy Adhesive EA9394", "RTV Silicone", "Polyurethane Foam", "Ablator Compound", "LOX-Compatible Grease", "Hydrazine Catalyst", "Primer EC-3960", "Sealant PR-1776", "Lubricant MoS2", "Flux Paste", "Cleaning Solvent", "Potting Compound", "Conformal Coating", "Thermal Grease"];
  const RAW_NAMES = ["Nickel Cathode", "Chromium Ore", "Ferroniobium", "Cobalt Metal", "Hafnium Sponge", "Yttrium Oxide", "Zircon Sand", "OFHC Copper", "Silver Grain", "EG Silicon Wafer", "HiP Quartz", "Tungsten Powder", "Molybdenum Rod", "Tantalum Ingot", "Rhenium Pellet", "Beryllium Pebble", "Lithium Carbonate", "Rare Earth Oxide", "Platinum Sponge", "Iridium Powder", "Ruthenium Grain", "Gallium Metal", "Indium Ingot", "Germanium Crystal", "Titanium Sponge", "Vanadium Pentoxide", "Manganese Ore", "Boron Carbide", "Graphite Flake", "Bauxite Ore"];
  const CERT_NAMES = ["AS9100D", "NADCAP", "ITAR Registration", "ISO 9001", "NADCAP Special Process", "NADCAP Heat Treat", "NADCAP Welding", "NADCAP NDT", "AS6081 (Counterfeit)", "AS6171 (Test Methods)", "ISO 14001", "OHSAS 18001"];
  const NOTES = [
    "SOLE global source.", "~75% global supply.", "Conflict mineral — enhanced due diligence required.",
    "Lead time 16-24 weeks.", "Capacity constrained.", "Alternate source qualification in progress.",
    "Strategic reserve maintained.", "Recycled content available.", "Subject to export controls.",
    "Price volatility — forward contracts recommended.", "Geopolitical risk — monitor closely.",
  ];

  // ── Actor pools ─────────────────────────────────────────────────────
  const CERT_BODIES = [
    { name: "BSI Group", id: "org-bsi-7a3f" },
    { name: "SAE International", id: "org-sae-2b4c" },
    { name: "DDTC", id: "org-ddtc-9e1d" },
    { name: "PRI", id: "org-pri-5f8a" },
    { name: "DNV GL", id: "org-dnv-3c7b" },
    { name: "Lloyd's Register", id: "org-lr-8d2e" },
    { name: "Bureau Veritas", id: "org-bv-4a6f" },
    { name: "TÜV SÜD", id: "org-tuv-1e9c" },
    { name: "SGS SA", id: "org-sgs-6b3d" },
    { name: "Intertek", id: "org-itk-7f4a" },
  ];

  const INSPECTORS = [
    { name: "J. Chen", id: "usr-jchen-a1b2" },
    { name: "M. Rodriguez", id: "usr-mrod-c3d4" },
    { name: "A. Singh", id: "usr-asingh-e5f6" },
    { name: "K. Tanaka", id: "usr-ktanaka-g7h8" },
    { name: "L. Mueller", id: "usr-lmueller-i9j0" },
    { name: "R. Okonkwo", id: "usr-rokonkwo-k1l2" },
    { name: "S. Petrov", id: "usr-spetrov-m3n4" },
    { name: "D. Williams", id: "usr-dwilliams-o5p6" },
    { name: "F. Leclerc", id: "usr-fleclerc-q7r8" },
    { name: "P. Johansson", id: "usr-pjohansson-s9t0" },
    { name: "T. Kim", id: "usr-tkim-u1v2" },
    { name: "B. Okafor", id: "usr-bokafor-w3x4" },
  ];

  const CAL_SERVICES = [
    { name: "Trescal Inc.", id: "org-trescal-a1b2" },
    { name: "Transcat", id: "org-transcat-c3d4" },
    { name: "Simco Electronics", id: "org-simco-e5f6" },
    { name: "Micro Precision", id: "org-mprecision-g7h8" },
    { name: "Essco Calibration", id: "org-essco-i9j0" },
  ];

  const TEST_LABS = [
    { name: "Westmoreland Testing", id: "org-wmt-a1b2" },
    { name: "IMR Test Labs", id: "org-imr-c3d4" },
    { name: "NTS", id: "org-nts-e5f6" },
    { name: "Element Materials", id: "org-element-g7h8" },
    { name: "Exova Group", id: "org-exova-i9j0" },
  ];

  const RISK_ANALYSTS = [
    { name: "Risk Analytics Team", id: "org-riskteam-a1b2" },
    { name: "Supply Chain Intel", id: "org-sci-c3d4" },
  ];

  const RADIANT_SYSTEM = { name: "Radiant Provenance Engine", id: "sys-radiant-001" };
  const EVAL_ACTOR = { name: "Radiant AI Evaluator", id: "sys-radiant-eval-001" };

  // ── Supplier actor cache (same name → same actor) ──────────────────
  const supplierActors = {};
  const mkSupplierActor = name => {
    if (!supplierActors[name]) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
      supplierActors[name] = { name, id: `org-${slug}-${mkHash().slice(2, 6)}` };
    }
    return supplierActors[name];
  };

  // ── Cert date generation (controls compliance distribution) ────────
  // Probabilities tuned so worst-of-N-certs yields ~80% compliant, ~8% expiring, ~6% expired, ~6% pending
  const mkCertDates = () => {
    const roll = rand();
    if (roll < 0.90) {
      return { ts: mkIsoDate(2023, 2025), validUntil: mkDateOnly(2027, 2029), status: "verified" };
    } else if (roll < 0.94) {
      return { ts: mkIsoDate(2023, 2025), validUntil: `2026-${pad2(range(3, 8))}-${pad2(range(1, 28))}`, status: "verified" };
    } else if (roll < 0.97) {
      return { ts: mkIsoDate(2022, 2024), validUntil: mkDateOnly(2024, 2025), status: "expired" };
    } else {
      return { ts: mkIsoDate(2025, 2026), validUntil: null, status: "pending" };
    }
  };

  // ── Convergence keys for shared raw materials ──────────────────────
  const CONVERGENCE_POOL = [
    "ni-cathode", "cr-ore", "co-metal", "hf-sponge", "nb-ferro", "cu-ofhc",
    "ti-sponge", "al-baux", "si-wafer", "y-oxide", "zr-sand", "w-powder",
    "mo-rod", "ta-ingot", "re-pellet", "li-carb", "pt-sponge", "graphite",
    "be-pebble", "mn-ore",
  ];
  const convergenceUsed = {};

  // ── Edge case counters ─────────────────────────────────────────────
  let expiredCalCount = 0;
  let contestedCount = 0;
  let revokedCount = 0;

  // ── Signatory pools (3-5 per org, title matched to claim type) ──────
  const SIG_NAMES = ['M. Chen', 'R. Patel', 'A. Johansson', 'K. Okafor', 'S. Leclerc', 'J. Williams', 'D. Tanaka', 'L. Martinez', 'T. Mueller', 'P. Singh', 'B. Rivera', 'F. Petrov', 'N. Kim', 'H. Okonkwo', 'C. Weber'];
  const SIG_TITLES = {
    supplied_by: ['VP Procurement', 'Dir. Supply Chain', 'Procurement Manager', 'Supply Chain Lead'],
    registered_on_chain: ['Systems Administrator', 'Blockchain Ops Lead', 'Platform Engineer'],
    certified: ['Lead Auditor', 'Certification Manager', 'Compliance Director', 'Quality Assurance Lead'],
    inspected: ['Senior Inspector', 'QA Inspector', 'Inspection Team Lead', 'Quality Engineer'],
    itar_controlled: ['Export Control Officer', 'Compliance Director', 'ITAR Compliance Lead'],
    calibrated: ['Calibration Engineer', 'Metrology Lead', 'Lab Manager'],
    provenance_claimed: ['Origin Verification Officer', 'Supply Chain Analyst', 'Traceability Lead'],
    material_tested: ['Lab Director', 'Test Engineer', 'Materials Scientist', 'Senior Analyst'],
    assembled_from: ['Production Manager', 'Assembly Lead', 'Manufacturing Engineer'],
    quality_approved: ['Quality Director', 'QA Manager', 'Chief Quality Officer'],
    risk_assessed: ['Risk Analyst', 'Supply Risk Manager', 'Risk Assessment Lead'],
    evaluated_against_requirements: ['Automated', 'AI System'],
  };
  const sigCache = {};
  function mkSignatory(actor, predicate) {
    if (predicate === 'evaluated_against_requirements') return { name: 'Automated', title: 'AI System' };
    const key = actor.id;
    if (!sigCache[key]) {
      const h = key.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
      const pool = [];
      for (let i = 0; i < 4; i++) pool.push(SIG_NAMES[(Math.abs(h * (i + 1)) % SIG_NAMES.length)]);
      sigCache[key] = pool;
    }
    const titles = SIG_TITLES[predicate] || ['Director', 'Manager', 'Lead'];
    const pool = sigCache[key];
    const name = pool[Math.abs(predicate.charCodeAt(0)) % pool.length];
    const title = titles[Math.abs(predicate.charCodeAt(1) || 0) % titles.length];
    return { name, title };
  }

  // ── Evidence storage helpers ────────────────────────────────────────
  const STORAGE_PROVIDERS = ['Radiant Vault', 'ChainStore', 'AeroVault', 'SecureDocs', 'ProvenanceFS'];
  const ACCESS_LEVELS = ['restricted', 'confidential', 'internal', 'public'];
  const EVIDENCE_TYPES_MAP = {
    supplier_agreement: 'provenance_document',
    block_: 'shipping_manifest',
    inspection_report: 'inspection_certificate',
    calibration_certificate: 'calibration_record',
    origin_certificate: 'provenance_document',
    test_report: 'test_data',
    work_order: 'qualification_record',
    quality_release: 'inspection_certificate',
    evaluation_report: 'evaluation_report',
    itar_classification: 'provenance_document',
  };
  function mkStorageRef() { return `vault://${pick(STORAGE_PROVIDERS).toLowerCase().replace(/\s/g,'-')}/${mkHash().slice(2)}-${mkHash().slice(2)}`; }
  function mkAccessLevel(predicate) {
    if (predicate === 'itar_controlled') return 'restricted';
    if (predicate === 'risk_assessed') return 'confidential';
    return pick(ACCESS_LEVELS);
  }

  // ── Attestation builder ────────────────────────────────────────────
  function mkAtt(actor, predicate, subject, evidenceType, opts = {}) {
    return {
      actor,
      predicate,
      subject,
      evidence: { hash: opts.evidenceHash || mkHash(), type: evidenceType, storageRef: mkStorageRef(), accessLevel: mkAccessLevel(predicate) },
      timestamp: opts.timestamp || mkIsoDate(2024, 2025),
      validUntil: opts.validUntil !== undefined ? opts.validUntil : null,
      signature: mkHash(),
      status: opts.status || "verified",
      signatory: mkSignatory(actor, predicate),
    };
  }

  // ── SDA builder ─────────────────────────────────────────────────────
  const SDA_RECEIVER = 'Stellar Dynamics Aerospace';
  const SDA_EVAL_PREFIX = 'eval-aero';
  const SDA_ALL_FIELDS = ['shipment_details','part_identification','material_specs','processing_specs','test_results','certifications','pricing','supplier_identity'];
  const SDA_OPT_FIELDS = ['shipment_details','material_specs','processing_specs','test_results','pricing','supplier_identity'];
  function mkSda(discloser, nodeId) {
    const sr = mulberry32(parseInt(nodeId.slice(1)) * 7919 + 13);
    const typeRoll = sr();
    const sdaType = typeRoll < 0.65 ? 'full' : typeRoll < 0.90 ? 'selective' : 'derivative';
    const baseMs = new Date('2025-08-17').getTime();
    const created = new Date(baseMs + Math.floor(sr() * 184) * 86400000).toISOString().slice(0, 10);
    const createdMs = new Date(created).getTime();
    const statusRoll = sr();
    let status, expires;
    if (statusRoll < 0.05) {
      status = 'expired';
      expires = new Date(new Date('2024-08-01').getTime() + Math.floor(sr() * 365) * 86400000).toISOString().slice(0, 10);
    } else if (statusRoll < 0.10) {
      status = 'pending'; expires = null;
    } else {
      status = 'active';
      expires = sr() < 0.60 ? null : new Date(createdMs + 365 * 86400000).toISOString().slice(0, 10);
    }
    const sda = { id: `sda-${nodeId}`, type: sdaType, discloser, receiver: SDA_RECEIVER, created, expires, status, disclosedFields: null, redactedFields: null, sourceEvalId: null, evalResult: null };
    if (sdaType === 'selective') {
      const sh = [...SDA_OPT_FIELDS];
      for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
      const red = sh.slice(0, 2 + Math.floor(sr() * 3));
      sda.disclosedFields = SDA_ALL_FIELDS.filter(f => !red.includes(f));
      sda.redactedFields = red;
    } else if (sdaType === 'derivative') {
      sda.sourceEvalId = `${SDA_EVAL_PREFIX}-${100 + Math.floor(sr() * 900)}`;
      sda.evalResult = sr() < 0.90 ? 'pass' : 'conditional';
    }
    return sda;
  }

  // ── Node builder ───────────────────────────────────────────────────
  function mkNode(type, name, opts = {}) {
    const loc = pick(COUNTRIES);
    const id = mkId();
    const supplierName = opts.supplier || pick(SUPPLIERS[type] || SUPPLIERS.component);
    const supplierActor = mkSupplierActor(supplierName);
    const block = mkBlock();
    const token = mkHash();
    const isNew = chance(0.05);

    const node = {
      id,
      name,
      type,
      location: loc.loc,
      lat: loc.lat,
      lng: loc.lng,
      attestations: [],
    };

    // ── 1. supplied_by (every node) ──
    node.attestations.push(mkAtt(
      supplierActor, "supplied_by", id, "supplier_agreement",
      { timestamp: mkIsoDate(2023, 2025) }
    ));

    // ── 2. registered_on_chain (every node) ──
    node.attestations.push(mkAtt(
      RADIANT_SYSTEM, "registered_on_chain", id, `block_${block}`,
      { evidenceHash: token, timestamp: isNew ? mkRecentDate() : mkIsoDate(2024, 2025) }
    ));

    // ── 3. Certifications (every node gets 1-3) ──
    const numCerts = range(1, 3);
    for (let i = 0; i < numCerts; i++) {
      let { ts, validUntil, status } = mkCertDates();
      // Edge case: revoked cert
      if (revokedCount < 1 && status === "verified" && chance(0.003)) {
        status = "revoked";
        revokedCount++;
      }
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "certified", id, pick(CERT_NAMES),
        { timestamp: ts, validUntil, status }
      ));
    }

    // ── 4. Inspection (~20%) ──
    if (chance(0.20)) {
      const pass = chance(0.85);
      node.attestations.push(mkAtt(
        pick(INSPECTORS), "inspected", id, "inspection_report",
        { timestamp: mkIsoDate(2025, 2026), status: pass ? "verified" : "contested" }
      ));
    }

    // ── 5. ITAR — realistic distribution ──
    // Controlled countries (DDTC 22 CFR §126.1 proscribed destinations) + US handlers
    const locLower = (loc.loc || '').toLowerCase();
    const isControlledCountry = /china|russia|iran|north korea|syria|cuba|venezuela|myanmar|belarus/.test(locLower);
    const isUS = locLower.includes('usa');
    const itarEligible = opts.itar || isControlledCountry || (isUS && chance(0.12));
    if (itarEligible) {
      node.attestations.push(mkAtt(
        { name: "DDTC", id: "org-ddtc-9e1d" }, "itar_controlled", id, "itar_classification",
        { timestamp: mkIsoDate(2023, 2025) }
      ));
    }

    // ── 6. Type-specific attestations ──

    // Process: calibration
    if (type === "process" && chance(0.50)) {
      const isExpired = expiredCalCount < 4 && chance(0.35);
      if (isExpired) expiredCalCount++;
      node.attestations.push(mkAtt(
        pick(CAL_SERVICES), "calibrated", id, "calibration_certificate",
        { timestamp: isExpired ? mkIsoDate(2022, 2023) : mkIsoDate(2024, 2025),
          validUntil: isExpired ? mkDateOnly(2024, 2025) : mkDateOnly(2027, 2028),
          status: isExpired ? "expired" : "verified" }
      ));
    }

    // Raw/material: provenance claim
    if ((type === "rawsource" || type === "material") && chance(0.35)) {
      let provStatus = "verified";
      if (contestedCount < 1 && chance(0.015)) {
        provStatus = "contested";
        contestedCount++;
      }
      node.attestations.push(mkAtt(
        supplierActor, "provenance_claimed", id, "origin_certificate",
        { timestamp: mkIsoDate(2024, 2025), status: provStatus }
      ));
    }

    // Material/component: testing
    if ((type === "material" || type === "component") && chance(0.30)) {
      node.attestations.push(mkAtt(
        pick(TEST_LABS), "material_tested", id, "test_report",
        { timestamp: mkIsoDate(2025, 2026) }
      ));
    }

    // Assembly/subassembly: assembled_from
    if ((type === "assembly" || type === "subassembly") && chance(0.45)) {
      node.attestations.push(mkAtt(
        supplierActor, "assembled_from", id, "work_order",
        { timestamp: mkIsoDate(2025, 2026) }
      ));
    }

    // Quality approval (~25%)
    if (chance(0.25)) {
      node.attestations.push(mkAtt(
        pick(INSPECTORS), "quality_approved", id, "quality_release",
        { timestamp: mkIsoDate(2025, 2026) }
      ));
    }

    // Risk assessment / notes (~7%)
    if (chance(0.07)) {
      node.attestations.push(mkAtt(
        pick(RISK_ANALYSTS), "risk_assessed", id, pick(NOTES),
        { timestamp: mkIsoDate(2025, 2026) }
      ));
    }

    // ── Evaluation (Radiant AI) — ~98% of nodes ──
    if (chance(0.98)) {
      const ma = range(0, 5);
      let em = 2 - ma, ey = 2026;
      if (em <= 0) { em += 12; ey--; }
      const evalTs = `${ey}-${pad2(em)}-${pad2(range(1, 28))}T${pad2(range(8, 17))}:${pad2(range(0, 59))}:00Z`;
      const evalValid = `${ey + 1}-${pad2(em)}-${pad2(range(1, 28))}`;
      const evalStatus = chance(0.97) ? "verified" : "contested";
      node.attestations.push(mkAtt(
        EVAL_ACTOR, "evaluated_against_requirements", id, "evaluation_report",
        { timestamp: evalTs, validUntil: evalValid, status: evalStatus }
      ));
      if (chance(0.05)) {
        const numRe = range(1, 2);
        for (let ri = 0; ri < numRe; ri++) {
          const rm2 = range(0, 3);
          let rm = 2 - rm2, ry = 2026;
          if (rm <= 0) { rm += 12; ry--; }
          const reTs = `${ry}-${pad2(rm)}-${pad2(range(1, 28))}T${pad2(range(8, 17))}:${pad2(range(0, 59))}:00Z`;
          const reValid = `${ry + 1}-${pad2(rm)}-${pad2(range(1, 28))}`;
          node.attestations.push(mkAtt(
            EVAL_ACTOR, "evaluated_against_requirements", id, "evaluation_report",
            { timestamp: reTs, validUntil: reValid, status: "verified" }
          ));
        }
      }
    }

    if (!['customer','program','system'].includes(type)) node.sda = mkSda(supplierName, id);
    return node;
  }

  // ── Build raw sources with convergence ─────────────────────────────
  function mkRawSources(count) {
    const children = [];
    for (let i = 0; i < count; i++) {
      const node = mkNode("rawsource", pick(RAW_NAMES));
      if (chance(0.40)) {
        const key = pick(CONVERGENCE_POOL);
        node.convergenceKey = key;
        if (convergenceUsed[key]) node.isConv = true;
        convergenceUsed[key] = true;
      }
      children.push(node);
    }
    return children;
  }

  // ── Build leaf tier ────────────────────────────────────────────────
  function mkLeafBranch(depth, maxDepth) {
    if (depth >= maxDepth) {
      const node = mkNode("rawsource", pick(RAW_NAMES));
      if (chance(0.35)) {
        const key = pick(CONVERGENCE_POOL);
        node.convergenceKey = key;
        if (convergenceUsed[key]) node.isConv = true;
        convergenceUsed[key] = true;
      }
      if (chance(0.04)) {
        node.placeholder = true;
        node.childCount = range(3, 12);
        node.children = [];
      }
      return node;
    }

    const typeRoll = rand();
    let type, namePool;
    if (typeRoll < 0.30) { type = "component"; namePool = COMPONENT_NAMES; }
    else if (typeRoll < 0.52) { type = "process"; namePool = PROCESS_NAMES; }
    else if (typeRoll < 0.72) { type = "material"; namePool = MATERIAL_NAMES; }
    else if (typeRoll < 0.85) { type = "chemical"; namePool = CHEMICAL_NAMES; }
    else { type = "rawsource"; namePool = RAW_NAMES; }

    const node = mkNode(type, pick(namePool));

    if (type === "rawsource") {
      if (chance(0.35)) {
        const key = pick(CONVERGENCE_POOL);
        node.convergenceKey = key;
        if (convergenceUsed[key]) node.isConv = true;
        convergenceUsed[key] = true;
      }
      if (depth < maxDepth - 1 && chance(0.3)) {
        node.children = mkRawSources(range(1, 2));
      }
      return node;
    }

    const numChildren = range(1, 3);
    node.children = [];
    for (let i = 0; i < numChildren; i++) {
      node.children.push(mkLeafBranch(depth + 1, maxDepth));
    }
    return node;
  }

  // ── Build subassemblies ────────────────────────────────────────────
  function mkSubassembly(depth) {
    const name = pick(SUBASSEMBLY_PREFIXES);
    const node = mkNode("subassembly", name);
    const maxDepth = range(depth + 2, depth + 4);
    const numChildren = range(2, 4);
    node.children = [];
    for (let i = 0; i < numChildren; i++) {
      node.children.push(mkLeafBranch(depth + 1, maxDepth));
    }
    return node;
  }

  // ── Build assemblies ───────────────────────────────────────────────
  function mkAssembly(name, depth) {
    const node = mkNode("assembly", name);
    const numSubs = range(3, 6);
    node.children = [];
    if (chance(0.08)) {
      node.placeholder = true;
      node.childCount = range(8, 25);
      node.children = [];
      return node;
    }
    for (let i = 0; i < numSubs; i++) {
      node.children.push(mkSubassembly(depth + 1));
    }
    return node;
  }

  // ── Build systems ──────────────────────────────────────────────────
  function mkSystem(sysInfo) {
    const node = mkNode("system", sysInfo.name, { supplier: `Stellar (${sysInfo.key.charAt(0).toUpperCase() + sysInfo.key.slice(1)} Div.)` });
    const assemblyNames = ASSEMBLY_NAMES[sysInfo.key] || ASSEMBLY_NAMES.engine;
    const numAssemblies = range(4, Math.min(8, assemblyNames.length));
    node.children = [];
    const shuffled = [...assemblyNames].sort(() => rand() - 0.5);
    for (let i = 0; i < numAssemblies; i++) {
      node.children.push(mkAssembly(shuffled[i], 3));
    }
    return node;
  }

  // ── Build programs ─────────────────────────────────────────────────
  // Program assignment: maps each program key to the system keys it owns
  const PROGRAM_SYSTEMS = {
    artemis: ["engine", "thermal"],
    gps: ["avionics", "payload"],
    orion: ["structures", "power"],
  };

  function mkProgram(progInfo) {
    const node = mkNode("program", progInfo.name, { supplier: "Stellar Dynamics Inc." });
    const systemKeys = PROGRAM_SYSTEMS[progInfo.key] || [];
    node.children = [];
    for (const sKey of systemKeys) {
      const sysInfo = SYSTEM_NAMES.find(s => s.key === sKey);
      if (sysInfo) node.children.push(mkSystem(sysInfo));
    }
    return node;
  }

  // ── Root ───────────────────────────────────────────────────────────
  const stellarActor = mkSupplierActor("Stellar Dynamics Inc.");
  const root = {
    id: "stellar",
    name: "Stellar Dynamics Aerospace",
    type: "customer",
    location: "Houston, TX, USA",
    lat: 29.76,
    lng: -95.37,
    attestations: [
      mkAtt(stellarActor, "supplied_by", "stellar", "corporate_charter",
        { timestamp: "2020-01-15T00:00:00Z" }),
      mkAtt(RADIANT_SYSTEM, "registered_on_chain", "stellar", "block_1",
        { evidenceHash: mkHash(), timestamp: "2024-01-01T08:00:00Z" }),
      mkAtt({ name: "BSI Group", id: "org-bsi-7a3f" }, "certified", "stellar", "AS9100D",
        { timestamp: "2024-03-15T00:00:00Z", validUntil: "2027-03-15", status: "verified" }),
      mkAtt({ name: "DDTC", id: "org-ddtc-9e1d" }, "certified", "stellar", "ITAR Registration",
        { timestamp: "2024-08-01T00:00:00Z", validUntil: "2027-08-01", status: "verified" }),
      mkAtt({ name: "PRI", id: "org-pri-5f8a" }, "certified", "stellar", "NADCAP",
        { timestamp: "2023-06-15T00:00:00Z", validUntil: "2026-06-15", status: "verified" }),
    ],
    children: [],
  };

  // Build programs (each program contains its assigned systems)
  for (const progInfo of PROGRAM_NAMES) {
    root.children.push(mkProgram(progInfo));
  }

  // ── Guarantee edge cases via post-processing ──────────────────────
  const allNodes = [];
  function collectAll(n) { allNodes.push(n); if (n.children) n.children.forEach(collectAll); }
  collectAll(root);

  // Expired calibrations
  if (expiredCalCount < 4) {
    const processNodes = allNodes.filter(n => n.type === "process" && !n.attestations.some(a => a.predicate === "calibrated" && a.status === "expired"));
    for (const n of processNodes) {
      if (expiredCalCount >= 4) break;
      n.attestations.push(mkAtt(
        pick(CAL_SERVICES), "calibrated", n.id, "calibration_certificate",
        { timestamp: mkIsoDate(2022, 2023), validUntil: mkDateOnly(2024, 2025), status: "expired" }
      ));
      expiredCalCount++;
    }
  }

  // Contested provenance
  if (contestedCount < 1) {
    const rawNodes = allNodes.filter(n => n.type === "rawsource");
    if (rawNodes.length > 0) {
      const n = rawNodes[Math.floor(rawNodes.length / 3)];
      const supAtt = n.attestations.find(a => a.predicate === "supplied_by");
      n.attestations.push(mkAtt(
        supAtt ? supAtt.actor : pick(CERT_BODIES), "provenance_claimed", n.id, "origin_certificate",
        { timestamp: mkIsoDate(2024, 2025), status: "contested" }
      ));
    }
  }

  // Revoked certification
  if (revokedCount < 1) {
    const target = allNodes.find(n => n.type !== "customer" && n.attestations.some(a => a.predicate === "certified" && a.status === "verified"));
    if (target) {
      target.attestations.push(mkAtt(
        pick(CERT_BODIES), "certified", target.id, "NADCAP Special Process",
        { timestamp: mkIsoDate(2023, 2024), validUntil: "2026-06-15", status: "revoked" }
      ));
    }
  }

  // ── Supplier identity override: n1195 = Curtiss-Wright Defense Solutions ──
  const cwAeroNode = allNodes.find(n => n.id === 'n1195');
  if (cwAeroNode) {
    const supAtt = cwAeroNode.attestations.find(a => a.predicate === 'supplied_by');
    if (supAtt) supAtt.actor = { name: 'Curtiss-Wright Defense Solutions', id: 'org-curtiss-wright-de' };
  }

  // ── SDA variety override: guarantee diversity across Curtiss-Wright aerospace assets ──
  if (cwAeroNode) {
    const SDA_ALL = ['shipment_details','part_identification','material_specs','processing_specs','test_results','certifications','pricing','supplier_identity'];
    // n1195 (MOSFET Module): full, active
    if (cwAeroNode.sda) { cwAeroNode.sda.type = 'full'; cwAeroNode.sda.status = 'active'; }
    // First direct child: selective (override to show variety)
    const aeroChildren = cwAeroNode.children || [];
    if (aeroChildren[0]?.sda) {
      aeroChildren[0].sda.type = 'selective';
      aeroChildren[0].sda.status = 'active';
      aeroChildren[0].sda.redactedFields = ['processing_specs', 'pricing'];
      aeroChildren[0].sda.disclosedFields = SDA_ALL.filter(f => !['processing_specs','pricing'].includes(f));
    }
    // Walk all descendants for Ruthenium Grain → derivative
    const walkAero = n => {
      if (n.name === 'Ruthenium Grain' && n.sda) {
        n.sda.type = 'derivative'; n.sda.status = 'active';
        n.sda.sourceEvalId = 'eval-aero-rug-001'; n.sda.evalResult = 'pass';
      }
      if (n.children) n.children.forEach(walkAero);
    };
    aeroChildren.forEach(walkAero);

    // Seed POE on n1195 (MOSFET Module)
    cwAeroNode.evaluations = [{
      id: 'eval-mosfet-001', checklist: 'AS9100 Rev D', checklistId: 'as9100',
      requirementCount: 47, overallResult: 'pass', passCount: 45, failCount: 2,
      date: '2026-02-14', evaluator: 'ai_auto', creditCost: 144,
    }];
  }

  return root;
}

// Module-level cache: generate once, reuse forever
let _cached = null;
export function getDataset() {
  if (!_cached) _cached = generateDataset();
  return _cached;
}
