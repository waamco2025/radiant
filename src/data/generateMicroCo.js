// Seeded PRNG for deterministic generation
function mulberry32(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function generateDataset(seed = 301) {
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
  const LOCATIONS = [
    { loc: "Hsinchu, Taiwan", lat: 24.80, lng: 120.97 },
    { loc: "Tainan, Taiwan", lat: 22.99, lng: 120.21 },
    { loc: "Seoul, South Korea", lat: 37.57, lng: 126.98 },
    { loc: "Pyeongtaek, South Korea", lat: 36.99, lng: 127.11 },
    { loc: "Chandler, AZ, USA", lat: 33.30, lng: -111.84 },
    { loc: "Hillsboro, OR, USA", lat: 45.52, lng: -122.99 },
    { loc: "Austin, TX, USA", lat: 30.27, lng: -97.74 },
    { loc: "San Jose, CA, USA", lat: 37.34, lng: -121.89 },
    { loc: "Boise, ID, USA", lat: 43.62, lng: -116.21 },
    { loc: "Dresden, Germany", lat: 51.05, lng: 13.74 },
    { loc: "Grenoble, France", lat: 45.19, lng: 5.72 },
    { loc: "Eindhoven, Netherlands", lat: 51.44, lng: 5.47 },
    { loc: "Leuven, Belgium", lat: 50.88, lng: 4.70 },
    { loc: "Tokyo, Japan", lat: 35.68, lng: 139.69 },
    { loc: "Yokkaichi, Japan", lat: 34.96, lng: 136.62 },
    { loc: "Singapore", lat: 1.35, lng: 103.82 },
    { loc: "Penang, Malaysia", lat: 5.41, lng: 100.34 },
    { loc: "Shanghai, China", lat: 31.23, lng: 121.47 },
    { loc: "Dalian, China", lat: 38.91, lng: 121.60 },
    { loc: "Bengaluru, India", lat: 12.97, lng: 77.59 },
    { loc: "Haifa, Israel", lat: 32.79, lng: 34.99 },
    { loc: "Spruce Pine, NC, USA", lat: 35.91, lng: -82.07 },
    { loc: "Freeport, TX, USA", lat: 28.95, lng: -95.36 },
    { loc: "Niigata, Japan", lat: 37.90, lng: 139.02 },
  ];

  const SUPPLIERS = {
    program: ["MicroCo Microelectronics", "MicroCo Microelectronics", "MicroCo Microelectronics"],
    system: ["MicroCo Titan Division", "MicroCo RF Division", "MicroCo AI Division", "MicroCo Power Division", "MicroCo Imaging Division"],
    assembly: ["TSMC", "Samsung Foundry", "Intel Foundry", "GlobalFoundries", "UMC", "ASE Technology", "Amkor Technology", "JCET Group", "Siliconware Precision"],
    subassembly: ["ASML", "Applied Materials", "Lam Research", "Tokyo Electron", "KLA Corporation", "Screen Holdings", "Hitachi High-Tech", "Disco Corp", "Kulicke & Soffa", "Besi"],
    component: ["Shin-Etsu Handotai", "SUMCO Corp", "Siltronic AG", "SK Siltron", "Entegris Inc", "Cabot Microelectronics", "DuPont Electronics", "JSR Corporation", "TOK (Tokyo Ohka)", "Brewer Science"],
    process: ["ASML Litho Services", "Applied Materials Process", "Lam Research Process", "TEL Process Services", "KLA Metrology", "Onto Innovation"],
    material: ["Shin-Etsu Chemical", "SUMCO Corp", "Siltronic AG", "Heraeus Electronics", "Tanaka Precious Metals", "Plansee Group", "H.C. Starck", "Tosoh Corp", "Merck KGaA"],
    chemical: ["BASF Electronic Chemicals", "Air Liquide Electronics", "Entegris Chemicals", "Fujifilm Electronic Materials", "Stella Chemifa", "Kanto Chemical", "Moses Lake Industries"],
    rawsource: ["Wacker Chemie", "Tokuyama Corp", "REC Silicon", "Freeport-McMoRan", "Global Advanced Metals", "China Northern Rare Earth", "MP Materials", "Air Products", "Linde plc", "Solvay SA"],
  };

  const PRODUCT_TIER_NAMES = [
    { name: "MC-7000 Microcontroller", key: "mc7000" },
    { name: "RF-2200 Transceiver Module", key: "rf2200" },
    { name: "PMU-500 Power Management IC", key: "pmu500" },
  ];

  // Maps each top-level product to its constituent product lines
  const PRODUCT_TIER_LINES = {
    mc7000: ["titan", "nova"],
    rf2200: ["quantum", "photon"],
    pmu500: ["helix"],
  };

  const PRODUCT_NAMES = [
    { name: "Titan-X 5nm SoC", key: "titan" },
    { name: "Quantum-III RF Transceiver", key: "quantum" },
    { name: "Nova-8 AI Accelerator", key: "nova" },
    { name: "Helix-V Power Management IC", key: "helix" },
    { name: "Photon-II Image Sensor", key: "photon" },
  ];

  const DIE_PACKAGE_NAMES = {
    titan: ["Logic Die", "SRAM Cache Die", "I/O Die", "Interposer", "Substrate Package"],
    quantum: ["RF Front-End Die", "Baseband Die", "PA Module", "Filter Package"],
    nova: ["Compute Die", "HBM Stack", "CoWoS Interposer", "Package Substrate", "Heat Spreader Assembly"],
    helix: ["Buck Converter Die", "LDO Die", "PMIC Die", "QFN Package"],
    photon: ["Pixel Array Die", "ISP Die", "Color Filter Array", "Micro-Lens Array", "CSP Package"],
  };

  const PROCESS_STEP_NAMES = [
    "EUV Lithography", "DUV Immersion Litho", "Plasma Etch", "Reactive Ion Etch",
    "CVD Oxide Deposition", "ALD High-k Deposition", "PVD Metal Sputtering",
    "Electroplating Cu Fill", "CMP Planarization", "Ion Implantation",
    "Rapid Thermal Anneal", "Wet Clean", "Spin Coat Resist", "Develop & Strip",
    "Wafer Probe Test", "Die Sort", "Wire Bond", "Flip Chip Bump",
    "Underfill Dispense", "Mold Encapsulation", "Solder Ball Attach",
    "Final Test & Burn-In", "Laser Mark", "Tape & Reel",
  ];

  const INPUT_MATERIAL_NAMES = [
    "300mm Si Wafer", "Photoresist AR-2014", "EUV Pellicle", "CMP Slurry",
    "Cu Target (5N)", "TaN Barrier Target", "W Plug Target", "Co Liner Target",
    "SiO2 Precursor (TEOS)", "HfO2 Precursor", "TiN CVD Source",
    "Al Bond Wire", "Au Bond Wire", "Cu Pillar Bump", "Solder Paste",
    "Underfill Epoxy", "Mold Compound", "Thermal Interface Material",
    "BT Substrate Core", "ABF Build-up Film",
  ];

  const CHEMICAL_NAMES_POOL = [
    "Ultrapure Water (UPW)", "HF Etchant (49%)", "H2O2 (30%)", "NH4OH Solution",
    "H2SO4 (Piranha)", "IPA (Electronic Grade)", "PGMEA Developer", "TMAH Developer",
    "SiH4 (Silane Gas)", "WF6 (Tungsten Hex)", "TiCl4 Gas", "NH3 (Ammonia)",
    "Ar Sputter Gas", "N2 (5N Purity)", "NF3 Chamber Clean",
  ];

  const RAW_NAMES = [
    "EG Polysilicon", "Quartz Crucible", "Silicon Carbide Ingot", "Gallium Metal (6N)",
    "Indium Ingot (5N)", "Copper Cathode (5N)", "Tantalum Powder",
    "Tungsten Ore (Scheelite)", "Cobalt Metal (4N)", "Hafnium Crystal Bar",
    "Titanium Sponge", "Rare Earth Concentrate", "Neon Gas (Source)",
    "Krypton Gas (Source)", "Xenon Gas (Source)", "Fluorite Ore (CaF2)",
    "Palladium Sponge", "Gold Grain (4N)", "Bismuth Ingot", "Antimony Metal",
  ];

  const CERT_NAMES = [
    "ISO 9001:2015", "IATF 16949", "ISO 14001", "ISO 45001", "SEMI S2/S8",
    "Sony Green Partner", "REACH Compliance", "RoHS Compliance", "AEC-Q100",
    "JEDEC Qualified",
  ];

  const NOTES = [
    "SOLE wafer supplier — no alternate fab qualified.",
    "~80% global EUV pellicle supply from single source.",
    "Geopolitical risk — Taiwan Strait exposure.",
    "Rare gas supply (Ne/Kr) — Ukraine conflict impact.",
    "Lead time 26+ weeks — capacity allocation required.",
    "CHIPS Act facility — expansion timeline TBD.",
    "Chemical purity specification tightened — requalification needed.",
    "Fab transfer risk — yield ramp uncertainty.",
    "Export control — Entity List restrictions apply.",
  ];

  // ── Actor pools ─────────────────────────────────────────────────────
  const CERT_BODIES = [
    { name: "SEMI", id: "org-semi-1a2b" },
    { name: "JEDEC", id: "org-jedec-3c4d" },
    { name: "IPC", id: "org-ipc-5e6f" },
    { name: "TÜV SÜD", id: "org-tuv-1e9c" },
    { name: "SGS SA", id: "org-sgs-6b3d" },
    { name: "Bureau Veritas", id: "org-bv-4a6f" },
    { name: "UL Solutions", id: "org-ul-7g8h" },
    { name: "Intertek", id: "org-itk-7f4a" },
  ];

  const TEST_LABS = [
    { name: "KLA Metrology Lab", id: "org-kla-lab-a1b2" },
    { name: "Onto Innovation Test", id: "org-onto-c3d4" },
    { name: "PDF Solutions", id: "org-pdf-e5f6" },
    { name: "Amkor Test Services", id: "org-amkor-test-g7h8" },
    { name: "ASE Test Division", id: "org-ase-test-i9j0" },
  ];

  const INSPECTORS = [
    { name: "Q. Zhang", id: "usr-qzhang-a1b2" },
    { name: "T. Nakamura", id: "usr-tnakamura-c3d4" },
    { name: "J. Park", id: "usr-jpark-e5f6" },
    { name: "S. Kumar", id: "usr-skumar-g7h8" },
    { name: "M. Chen", id: "usr-mchen-i9j0" },
    { name: "R. Hoffmann", id: "usr-rhoffmann-k1l2" },
  ];

  const CAL_SERVICES = [
    { name: "ASML Cal Services", id: "org-asml-cal-a1b2" },
    { name: "Applied Materials Cal", id: "org-amat-cal-c3d4" },
    { name: "Keysight Technologies", id: "org-keysight-e5f6" },
    { name: "Particle Measuring Systems", id: "org-pms-g7h8" },
  ];

  const RISK_ANALYSTS = [
    { name: "Supply Chain Risk Team", id: "org-scrt-a1b2" },
    { name: "Fab Operations Intel", id: "org-foi-c3d4" },
  ];

  const RADIANT_SYSTEM = { name: "Radiant Provenance Engine", id: "sys-radiant-001" };
  const EVAL_ACTOR = { name: "Radiant AI Evaluator", id: "sys-radiant-eval-001" };
  const BIS_ACTOR = { name: "BIS", id: "org-bis-doc" };
  const ITAR_PROCESS_NAMES = ["EUV Lithography", "Ion Implantation", "ALD High-k Deposition", "PVD Metal Sputtering"];
  const ITAR_RAW_NAMES = ["Gallium Metal", "Indium Ingot", "Hafnium Crystal Bar", "Rare Earth Concentrate"];

  // ── Convergence keys for shared raw materials / chemicals ──────────
  const CONVERGENCE_POOL = [
    "eg-polysi", "quartz-crucible", "sic-ingot", "cu-cathode-5n", "ta-powder",
    "w-scheelite", "co-metal-4n", "hf-bar", "re-concentrate", "ne-source",
    "kr-source", "upw-system", "hf-etchant", "h2o2-solution", "sih4-silane",
    "wf6-source", "ar-gas", "n2-gas", "cmp-slurry", "teos-source",
    "photoresist", "caf2-ore", "ga-metal", "in-ingot",
  ];
  const convergenceUsed = {};

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

  // ── Edge case counters ─────────────────────────────────────────────
  let expiredCalCount = 0;
  let contestedChemCount = 0;
  let revokedProcessCount = 0;

  // ── Evidence storage helpers ────────────────────────────────────────
  const STORAGE_PROVIDERS = ['Radiant Vault', 'ChainStore', 'MicroVault', 'SecureDocs', 'ProvenanceFS'];
  const ACCESS_LEVELS = ['restricted', 'confidential', 'internal', 'public'];
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
    };
  }

  // ── SDA builder ─────────────────────────────────────────────────────
  const SDA_RECEIVER = 'MicroCo Microelectronics';
  const SDA_EVAL_PREFIX = 'eval-mc';
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
    const loc = pick(LOCATIONS);
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

    // ── 3. Certifications (every non-root node gets 1-3) ──
    if (type !== "customer") {
      const numCerts = range(1, 3);
      for (let i = 0; i < numCerts; i++) {
        let { ts, validUntil, status } = mkCertDates();
        // Edge case: revoked cert on subassembly (process step)
        if (revokedProcessCount < 1 && type === "subassembly" && status === "verified" && chance(0.005)) {
          status = "revoked";
          revokedProcessCount++;
        }
        node.attestations.push(mkAtt(
          pick(CERT_BODIES), "certified", id, pick(CERT_NAMES),
          { timestamp: ts, validUntil, status }
        ));
      }
    }

    // ── 4. Transformation predicates (subassembly = process steps) ──
    if (type === "subassembly") {
      // etched_with — ~40%
      if (chance(0.40)) {
        node.attestations.push(mkAtt(
          supplierActor, "etched_with", id, "etch_recipe_qualification",
          { timestamp: mkIsoDate(2024, 2025) }
        ));
      }
      // deposited_on — ~35%
      if (chance(0.35)) {
        node.attestations.push(mkAtt(
          supplierActor, "deposited_on", id, "deposition_qualification",
          { timestamp: mkIsoDate(2024, 2025) }
        ));
      }
      // doped_with — ~20%
      if (chance(0.20)) {
        node.attestations.push(mkAtt(
          supplierActor, "doped_with", id, "implant_recipe_qual",
          { timestamp: mkIsoDate(2024, 2025) }
        ));
      }
      // cleaned_with — ~25%
      if (chance(0.25)) {
        node.attestations.push(mkAtt(
          supplierActor, "cleaned_with", id, "clean_recipe_qual",
          { timestamp: mkIsoDate(2024, 2025) }
        ));
      }
    }

    // ── 5. bonded_to — ~30% of assembly (die/package) nodes ──
    if (type === "assembly" && chance(0.30)) {
      node.attestations.push(mkAtt(
        supplierActor, "bonded_to", id, "bond_process_qual",
        { timestamp: mkIsoDate(2024, 2025) }
      ));
    }

    // ── 6. Calibration predicates (subassembly & process nodes) ──
    // particle_count_verified — ~40% of subassembly/process
    if ((type === "subassembly" || type === "process") && chance(0.40)) {
      const isExpired = expiredCalCount < 4 && chance(0.25);
      if (isExpired) expiredCalCount++;
      node.attestations.push(mkAtt(
        pick(CAL_SERVICES), "particle_count_verified", id, "particle_count_report",
        { timestamp: isExpired ? mkIsoDate(2022, 2023) : mkIsoDate(2024, 2025),
          validUntil: isExpired ? mkDateOnly(2024, 2025) : mkDateOnly(2027, 2028),
          status: isExpired ? "expired" : "verified" }
      ));
    }

    // temperature_calibrated — ~35% of process nodes
    if (type === "process" && chance(0.35)) {
      const isExpired = expiredCalCount < 4 && chance(0.30);
      if (isExpired) expiredCalCount++;
      node.attestations.push(mkAtt(
        pick(CAL_SERVICES), "temperature_calibrated", id, "temperature_cal_cert",
        { timestamp: isExpired ? mkIsoDate(2022, 2023) : mkIsoDate(2024, 2025),
          validUntil: isExpired ? mkDateOnly(2024, 2025) : mkDateOnly(2027, 2028),
          status: isExpired ? "expired" : "verified" }
      ));
    }

    // humidity_calibrated — ~25% of process nodes
    if (type === "process" && chance(0.25)) {
      node.attestations.push(mkAtt(
        pick(CAL_SERVICES), "humidity_calibrated", id, "humidity_cal_cert",
        { timestamp: mkIsoDate(2024, 2025),
          validUntil: mkDateOnly(2027, 2028),
          status: "verified" }
      ));
    }

    // ── 7. Quality predicates (wafer testing on assembly nodes) ──
    if (type === "assembly") {
      // wafer_probe_passed — ~30%
      if (chance(0.30)) {
        node.attestations.push(mkAtt(
          pick(TEST_LABS), "wafer_probe_passed", id, "wafer_probe_report",
          { timestamp: mkIsoDate(2025, 2026) }
        ));
      }
      // die_sort_passed — ~25%
      if (chance(0.25)) {
        node.attestations.push(mkAtt(
          pick(TEST_LABS), "die_sort_passed", id, "die_sort_report",
          { timestamp: mkIsoDate(2025, 2026) }
        ));
      }
      // burn_in_completed — ~20%
      if (chance(0.20)) {
        node.attestations.push(mkAtt(
          pick(TEST_LABS), "burn_in_completed", id, "burn_in_report",
          { timestamp: mkIsoDate(2025, 2026) }
        ));
      }
    }

    // ── 8. Inspection (~20% of all) ──
    if (chance(0.20)) {
      node.attestations.push(mkAtt(
        pick(INSPECTORS), "inspected", id, "inspection_report",
        { timestamp: mkIsoDate(2025, 2026) }
      ));
    }

    // ── 9. Quality approval (~25% of all) ──
    if (chance(0.25)) {
      node.attestations.push(mkAtt(
        pick(INSPECTORS), "quality_approved", id, "quality_release",
        { timestamp: mkIsoDate(2025, 2026) }
      ));
    }

    // ── 10. Risk assessment (~7% of all) ──
    if (chance(0.07)) {
      node.attestations.push(mkAtt(
        pick(RISK_ANALYSTS), "risk_assessed", id, pick(NOTES),
        { timestamp: mkIsoDate(2025, 2026) }
      ));
    }

    // ── 11. ITAR / Export Control (BIS) — ~10-12% overall ──
    if ((type === 'subassembly' && ITAR_PROCESS_NAMES.some(p => name.includes(p))) ||
        (type === 'rawsource' && ITAR_RAW_NAMES.some(r => name.startsWith(r)))) {
      if (chance(0.90)) {
        node.attestations.push(mkAtt(
          BIS_ACTOR, 'itar_controlled', id, 'ear_classification',
          { timestamp: mkIsoDate(2024, 2025) }
        ));
      }
    } else if (chance(0.08)) {
      node.attestations.push(mkAtt(
        BIS_ACTOR, 'itar_controlled', id, 'ear_classification',
        { timestamp: mkIsoDate(2024, 2025) }
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

  // ── Build raw sources with HIGH convergence (~55%) ─────────────────
  function mkRawSource() {
    const node = mkNode("rawsource", pick(RAW_NAMES));
    if (chance(0.55)) {
      const key = pick(CONVERGENCE_POOL);
      node.convergenceKey = key;
      if (convergenceUsed[key]) node.isConv = true;
      convergenceUsed[key] = true;
    }
    if (chance(0.04)) {
      node.placeholder = true;
      node.childCount = range(3, 10);
      node.children = [];
    }
    return node;
  }

  // ── Build chemicals with convergence ───────────────────────────────
  function mkChemical() {
    const node = mkNode("chemical", pick(CHEMICAL_NAMES_POOL));
    if (chance(0.55)) {
      const key = pick(CONVERGENCE_POOL);
      node.convergenceKey = key;
      if (convergenceUsed[key]) node.isConv = true;
      convergenceUsed[key] = true;
    }
    // Chemicals get 1-2 raw source children
    const numRaw = range(1, 2);
    node.children = [];
    for (let i = 0; i < numRaw; i++) {
      node.children.push(mkRawSource());
    }
    return node;
  }

  // ── Build input materials ──────────────────────────────────────────
  function mkInputMaterial() {
    const node = mkNode("component", pick(INPUT_MATERIAL_NAMES));
    // Sometimes also as "material" type for variety
    if (chance(0.35)) node.type = "material";
    // Input materials get 1-2 chemical precursor children
    const numChem = range(1, 2);
    node.children = [];
    for (let i = 0; i < numChem; i++) {
      node.children.push(mkChemical());
    }
    return node;
  }

  // ── Build process steps (subassembly) ──────────────────────────────
  // These are the highly interconnected nodes — many share the same input materials
  function mkProcessStep() {
    const name = pick(PROCESS_STEP_NAMES);
    const node = mkNode("subassembly", name);
    // Each process step gets 2-3 input materials
    const numInputs = range(2, 3);
    node.children = [];
    for (let i = 0; i < numInputs; i++) {
      node.children.push(mkInputMaterial());
    }
    return node;
  }

  // ── Build die/package (assembly) ───────────────────────────────────
  function mkDiePackage(name) {
    const node = mkNode("assembly", name);
    // Placeholder chance for some dies
    if (chance(0.06)) {
      node.placeholder = true;
      node.childCount = range(6, 20);
      node.children = [];
      return node;
    }
    // Each die/package gets 3-6 process steps
    const numSteps = range(3, 5);
    node.children = [];
    const shuffled = [...PROCESS_STEP_NAMES].sort(() => rand() - 0.5);
    for (let i = 0; i < numSteps; i++) {
      node.children.push(mkProcessStep());
    }
    return node;
  }

  // ── Build product line (system) ────────────────────────────────────
  function mkProductLine(prodInfo) {
    const divisionName = SUPPLIERS.system[PRODUCT_NAMES.indexOf(prodInfo)] || pick(SUPPLIERS.system);
    const node = mkNode("system", prodInfo.name, { supplier: divisionName });
    const dieNames = DIE_PACKAGE_NAMES[prodInfo.key] || DIE_PACKAGE_NAMES.titan;
    const numDies = range(3, Math.min(5, dieNames.length));
    node.children = [];
    const shuffled = [...dieNames].sort(() => rand() - 0.5);
    for (let i = 0; i < numDies; i++) {
      node.children.push(mkDiePackage(shuffled[i]));
    }
    return node;
  }

  // ── Build products (top-level program tier) ────────────────────────
  function mkProduct(productInfo) {
    const node = mkNode("program", productInfo.name, { supplier: "MicroCo Microelectronics" });
    const lineKeys = PRODUCT_TIER_LINES[productInfo.key] || [];
    node.children = [];
    for (const lKey of lineKeys) {
      const lineInfo = PRODUCT_NAMES.find(p => p.key === lKey);
      if (lineInfo) node.children.push(mkProductLine(lineInfo));
    }
    return node;
  }

  // ── Root ───────────────────────────────────────────────────────────
  const microcoActor = mkSupplierActor("MicroCo Microelectronics");
  const root = {
    id: "microco",
    name: "MicroCo Microelectronics",
    type: "customer",
    location: "San Jose, CA, USA",
    lat: 37.34,
    lng: -121.89,
    attestations: [
      mkAtt(microcoActor, "supplied_by", "microco", "corporate_charter",
        { timestamp: "2019-06-01T00:00:00Z" }),
      mkAtt(RADIANT_SYSTEM, "registered_on_chain", "microco", "block_1",
        { evidenceHash: mkHash(), timestamp: "2024-01-01T08:00:00Z" }),
      mkAtt({ name: "SEMI", id: "org-semi-1a2b" }, "certified", "microco", "ISO 9001:2015",
        { timestamp: "2024-02-20T00:00:00Z", validUntil: "2027-02-20", status: "verified" }),
      mkAtt({ name: "JEDEC", id: "org-jedec-3c4d" }, "certified", "microco", "JEDEC Qualified",
        { timestamp: "2024-05-10T00:00:00Z", validUntil: "2027-05-10", status: "verified" }),
      mkAtt({ name: "TÜV SÜD", id: "org-tuv-1e9c" }, "certified", "microco", "IATF 16949",
        { timestamp: "2023-11-15T00:00:00Z", validUntil: "2026-11-15", status: "verified" }),
    ],
    children: [],
  };

  // Build products (each product contains its assigned product lines)
  for (const productInfo of PRODUCT_TIER_NAMES) {
    root.children.push(mkProduct(productInfo));
  }

  // ── Guarantee edge cases via post-processing ──────────────────────
  const allNodes = [];
  function collectAll(n) { allNodes.push(n); if (n.children) n.children.forEach(collectAll); }
  collectAll(root);

  // 3-4 expired cleanroom calibrations
  if (expiredCalCount < 3) {
    const calTargets = allNodes.filter(n =>
      (n.type === "subassembly" || n.type === "process") &&
      !n.attestations.some(a =>
        (a.predicate === "particle_count_verified" || a.predicate === "temperature_calibrated") &&
        a.status === "expired"
      )
    );
    for (const n of calTargets) {
      if (expiredCalCount >= 4) break;
      const pred = chance(0.5) ? "particle_count_verified" : "temperature_calibrated";
      const evType = pred === "particle_count_verified" ? "particle_count_report" : "temperature_cal_cert";
      n.attestations.push(mkAtt(
        pick(CAL_SERVICES), pred, n.id, evType,
        { timestamp: mkIsoDate(2022, 2023), validUntil: mkDateOnly(2024, 2025), status: "expired" }
      ));
      expiredCalCount++;
    }
  }

  // 1 contested chemical purity claim
  if (contestedChemCount < 1) {
    const chemNodes = allNodes.filter(n => n.type === "chemical");
    if (chemNodes.length > 0) {
      const n = chemNodes[Math.floor(chemNodes.length / 3)];
      n.attestations.push(mkAtt(
        pick(CERT_BODIES), "certified", n.id, "SEMI S2/S8",
        { timestamp: mkIsoDate(2024, 2025), validUntil: mkDateOnly(2026, 2027), status: "contested" }
      ));
      contestedChemCount++;
    }
  }

  // 1 process step with revoked qualification
  if (revokedProcessCount < 1) {
    const subNodes = allNodes.filter(n =>
      n.type === "subassembly" &&
      n.attestations.some(a => a.predicate === "certified" && a.status === "verified")
    );
    if (subNodes.length > 0) {
      const n = subNodes[Math.floor(subNodes.length / 4)];
      n.attestations.push(mkAtt(
        pick(CERT_BODIES), "certified", n.id, "SEMI S2/S8",
        { timestamp: mkIsoDate(2023, 2024), validUntil: "2026-04-15", status: "revoked" }
      ));
      revokedProcessCount++;
    }
  }

  return root;
}

// Module-level cache: generate once, reuse forever
let _cached = null;
export function getDataset() {
  if (!_cached) _cached = generateDataset();
  return _cached;
}
