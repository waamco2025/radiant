// Seeded PRNG for deterministic generation
function mulberry32(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function generateDataset(seed = 201) {
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
    { loc: "Cape Canaveral, FL, USA", lat: 28.39, lng: -80.60 },
    { loc: "Vandenberg, CA, USA", lat: 34.73, lng: -120.57 },
    { loc: "Greenbelt, MD, USA", lat: 38.99, lng: -76.88 },
    { loc: "Pasadena, CA, USA", lat: 34.15, lng: -118.14 },
    { loc: "Huntsville, AL, USA", lat: 34.73, lng: -86.59 },
    { loc: "Colorado Springs, CO, USA", lat: 38.83, lng: -104.82 },
    { loc: "El Segundo, CA, USA", lat: 33.92, lng: -118.42 },
    { loc: "Chantilly, VA, USA", lat: 38.89, lng: -77.43 },
    { loc: "Redondo Beach, CA, USA", lat: 33.85, lng: -118.39 },
    { loc: "San Jose, CA, USA", lat: 37.34, lng: -121.89 },
    { loc: "Albuquerque, NM, USA", lat: 35.08, lng: -106.65 },
    { loc: "Tucson, AZ, USA", lat: 32.22, lng: -110.97 },
    { loc: "Kourou, French Guiana", lat: 5.24, lng: -52.77 },
    { loc: "Noordwijk, Netherlands", lat: 52.24, lng: 4.42 },
    { loc: "Tsukuba, Japan", lat: 36.05, lng: 140.12 },
    { loc: "Bangalore, India", lat: 12.97, lng: 77.59 },
    { loc: "Surrey, UK", lat: 51.24, lng: -0.77 },
    { loc: "Toulouse, France", lat: 43.60, lng: 1.44 },
    { loc: "Darmstadt, Germany", lat: 49.87, lng: 8.65 },
    { loc: "Beijing, China", lat: 39.91, lng: 116.40 },
    { loc: "Baotou, China", lat: 40.66, lng: 109.84 },
    { loc: "Bayan Obo, China", lat: 41.77, lng: 109.97 },
    { loc: "Bushveld, South Africa", lat: -25.50, lng: 28.50 },
    { loc: "Sudbury, Canada", lat: 46.49, lng: -81.00 },
    { loc: "Perth, Australia", lat: -31.95, lng: 115.86 },
    { loc: "Katanga, DRC", lat: -10.98, lng: 25.99 },
    { loc: "Spruce Pine, NC, USA", lat: 35.91, lng: -82.07 },
    { loc: "Morenci, AZ, USA", lat: 33.08, lng: -109.35 },
  ];

  const SUPPLIERS = {
    program: ["GovCo Federal Satellite Agency", "GovCo Federal Satellite Agency", "GovCo Federal Satellite Agency"],
    system: ["GovCo Satellite Division", "GovCo Comms Division", "GovCo EO Division", "GovCo Nav Division", "GovCo Defense Division"],
    assembly: ["Lockheed Martin Space", "Northrop Grumman Space", "Ball Aerospace", "L3Harris Space", "Raytheon Space", "General Dynamics Space", "BAE Systems Space", "Airbus Defence & Space", "Thales Alenia Space", "OHB System"],
    subassembly: ["Teledyne Technologies", "DRS Technologies", "Honeywell Space", "Moog Space", "Aerojet Rocketdyne Space", "Collins Aerospace Space", "Curtiss-Wright Defense", "Mercury Systems", "Elbit Systems", "Rafael Advanced"],
    component: ["Raytheon Vision Systems", "Teledyne Imaging", "II-VI Incorporated", "Coherent Corp", "Qorvo Inc", "Analog Devices", "Microsemi (Microchip)", "BAE Systems Sensors", "SWISSto12", "Cobham Space"],
    process: ["SWISSto12 Fab", "IQE plc", "WIN Semiconductors", "Tower Semiconductor", "Teledyne DALSA", "FLIR Systems"],
    material: ["II-VI Materials", "AXT Inc", "Sumitomo Electric", "Kyocera Corp", "Materion Corp", "Brush Beryllium", "ATI Specialty Alloys"],
    chemical: ["Dow Electronic Materials", "BASF Electronic Chemicals", "Air Liquide Electronics", "Entegris Inc", "Fujifilm Electronic Materials"],
    rawsource: ["Umicore SA", "Freeport-McMoRan", "Lynas Rare Earths", "MP Materials", "AMG Advanced Metallurgical", "CBMM", "Global Advanced Metals", "Tantalum Mining Corp", "Spruce Pine Mining", "China Northern Rare Earth"],
  };

  const MISSION_NAMES = [
    { name: "STARLINK-7 Constellation Deployment", key: "starlink7" },
    { name: "GEOINT Sensor Refresh", key: "geoint" },
    { name: "Resilient Comms Initiative", key: "resilient" },
  ];

  // Maps each mission to the satellite programs it encompasses
  const MISSION_PROGRAMS = {
    starlink7: ["sentinel", "vanguard"],
    geoint: ["polaris", "aegis"],
    resilient: ["meridian"],
  };

  const PROGRAM_NAMES = [
    { name: "Sentinel-6 Reconnaissance", key: "sentinel" },
    { name: "Meridian-II Comms Relay", key: "meridian" },
    { name: "Polaris Earth Observation", key: "polaris" },
    { name: "Vanguard Navigation Constellation", key: "vanguard" },
    { name: "Aegis Early Warning", key: "aegis" },
  ];

  const SUBSYSTEM_NAMES = {
    sentinel: ["Imaging Payload", "Bus Structure", "Power Subsystem", "Propulsion Module", "Thermal Control", "Command & Data Handling"],
    meridian: ["RF Payload", "Antenna Farm", "Power Subsystem", "Attitude Control", "Thermal Management", "Telemetry Unit"],
    polaris: ["Multispectral Imager", "SAR Antenna", "Data Processing Unit", "Power Subsystem", "Orbit Control", "Ground Link"],
    vanguard: ["Atomic Clock Array", "Signal Generator", "Navigation Processor", "Solar Array Wing", "Station Keeping", "Cross-Link Antenna"],
    aegis: ["IR Sensor Array", "Signal Processor", "Boost Phase Tracker", "Power Subsystem", "Cryo Cooler", "Data Downlink"],
  };

  const ASSEMBLY_NAMES = ["Focal Plane Assembly", "Detector Module", "Telescope Barrel", "Scan Mirror Mechanism", "Cryogenic Dewar", "Electronic Box", "Harness Assembly", "Radiator Panel", "Deployment Mechanism", "Reaction Wheel", "Star Tracker", "GPS Receiver", "Battery Module", "Solar Cell String", "Thruster Cluster", "Propellant Tank", "Gimbal Assembly", "Wave Guide", "Diplexer Unit", "Feed Horn Array"];
  const COMPONENT_NAMES = ["HgCdTe Detector", "InSb Focal Plane", "Sapphire Window", "Germanium Lens", "Silicon Carbide Mirror", "Beryllium Bracket", "Kovar Feedthrough", "Titanium Fitting", "Kapton Flex Cable", "MLI Blanket Layer", "Heater Cartridge", "Thermistor Probe", "LVDT Sensor", "Stepper Motor", "Bearing Assembly", "Harmonic Drive", "FPGA Module", "ASIC Processor", "MMIC Amplifier", "Waveguide Filter", "Isolator Module", "Power MOSFET", "Tantalum Capacitor", "Crystal Oscillator", "Radiation-Hard SRAM"];
  const PROCESS_NAMES = ["MBE Epitaxial Growth", "MOCVD Deposition", "Ion Implantation", "E-Beam Lithography", "Wire Bonding", "Die Attach", "Hermetic Seal", "Conformal Coat", "Thermal Vacuum Bake", "Outgassing Test", "Vibration Qual", "EMI/EMC Test", "Radiation Hardness Test"];
  const MATERIAL_NAMES = ["HgCdTe Wafer", "InSb Crystal", "GaAs Substrate", "SiC Boule", "Beryllium Block", "Titanium 6Al-4V Billet", "Kovar Alloy Rod", "Invar 36 Bar", "Inconel 718 Forging", "Kapton Film Roll", "Kevlar Fabric", "CFRP Panel", "MLI Film Stack", "Thermal Paint", "Adhesive Film"];
  const CHEMICAL_NAMES = ["MBE Source Material", "MOCVD Precursor Gas", "Photoresist Solution", "Etchant Chemical", "Flux Compound", "Cleaning Solvent", "Outgassing Compound", "Thermal Interface Material", "Conformal Coating Resin", "Potting Compound"];
  const RAW_NAMES = ["Cadmium Telluride", "Mercury Metal", "Indium Antimonide", "Gallium Metal", "Arsenic Crystal", "Silicon Carbide Powder", "Beryllium Ore", "Titanium Sponge", "Rare Earth Oxide", "Cobalt Cathode", "Tantalum Ore (Coltan)", "Niobium Ferro", "Germanium Crystal", "Platinum Group Metal", "High-Purity Quartz", "Lithium Carbonate", "Graphite Flake", "Tungsten Powder", "Molybdenum Rod", "Hafnium Crystal"];
  const CERT_NAMES = ["AS9100D", "ISO 9001:2015", "ITAR Registration", "MIL-STD-883", "MIL-PRF-38534", "NASA-STD-8739", "GSFC-STD-7000", "ESA ECSS-Q-ST-60", "JEDEC Qualification", "QML/QPL Listed"];
  const NOTES = [
    "SOLE global source — no alternate qualified.",
    "Chinese-origin component — SCRM review required.",
    "~75% global supply concentrated in single facility.",
    "Conflict mineral risk — enhanced due diligence.",
    "ITAR Category XV — special handling required.",
    "Foreign ownership risk — CFIUS review pending.",
    "Obsolescence risk — last-time-buy recommended.",
    "Counterfeit risk — additional testing mandated.",
    "Supply chain disruption — dual-source qualification.",
  ];

  // ── Actor pools ─────────────────────────────────────────────────────
  const CERT_BODIES = [
    { name: "DCMA", id: "org-dcma-1a2b" },
    { name: "NASA GSFC QA", id: "org-nasaqa-3c4d" },
    { name: "DMEA", id: "org-dmea-5e6f" },
    { name: "DLA", id: "org-dla-7g8h" },
    { name: "ESA Quality", id: "org-esaq-9i0j" },
    { name: "BSI Group", id: "org-bsi-7a3f" },
    { name: "SAE International", id: "org-sae-2b4c" },
    { name: "DDTC", id: "org-ddtc-9e1d" },
  ];

  const TEST_LABS = [
    { name: "NASA JPL Test Lab", id: "org-jpl-a1b2" },
    { name: "Aerospace Corp Test", id: "org-aero-c3d4" },
    { name: "NTS Space Division", id: "org-ntss-e5f6" },
    { name: "Element Space Testing", id: "org-elems-g7h8" },
    { name: "Radiation Effects Facility", id: "org-ref-i9j0" },
  ];

  const INSPECTORS = [
    { name: "DCMA Inspector Chen", id: "usr-dcma-chen-a1" },
    { name: "NASA QA Williams", id: "usr-nasa-will-b2" },
    { name: "GSFC Inspector Patel", id: "usr-gsfc-pat-c3" },
    { name: "DLA Auditor Kim", id: "usr-dla-kim-d4" },
    { name: "DMEA Analyst Rodriguez", id: "usr-dmea-rod-e5" },
    { name: "ESA QA Müller", id: "usr-esa-mul-f6" },
  ];

  const CAL_SERVICES = [
    { name: "Keysight Technologies", id: "org-keysight-a1b2" },
    { name: "Tektronix Cal Lab", id: "org-tek-c3d4" },
    { name: "National Instruments", id: "org-ni-e5f6" },
    { name: "Fluke Calibration", id: "org-fluke-g7h8" },
  ];

  const RISK_ANALYSTS = [
    { name: "SCRM Office", id: "org-scrm-a1b2" },
    { name: "CI Threat Analysis", id: "org-cita-c3d4" },
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
    "hgcdte-wafer", "insb-crystal", "gaas-sub", "sic-boule", "be-block",
    "ti-billet", "kovar-rod", "re-oxide", "ta-coltan", "co-cathode",
    "ge-crystal", "li-carb", "hpq-sand", "pt-metal", "nb-ferro",
    "w-powder", "mo-rod", "graphite", "hf-crystal", "cd-telluride",
  ];
  const convergenceUsed = {};

  // ── Edge case counters ─────────────────────────────────────────────
  let expiredCalCount = 0;
  let contestedProvenanceCount = 0;
  let revokedFlightQualCount = 0;
  let expiredRadTestCount = 0;

  // ── Evidence storage helpers ────────────────────────────────────────
  const STORAGE_PROVIDERS = ['Radiant Vault', 'ChainStore', 'GovVault', 'SecureDocs', 'ProvenanceFS'];
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
  const SDA_RECEIVER = 'GovCo Federal Satellite Agency';
  const SDA_EVAL_PREFIX = 'eval-gov';
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

    // ── 3. Certifications (every node gets 1-3) ──
    const numCerts = range(1, 3);
    for (let i = 0; i < numCerts; i++) {
      let { ts, validUntil, status } = mkCertDates();
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "certified", id, pick(CERT_NAMES),
        { timestamp: ts, validUntil, status }
      ));
    }

    // ── 4. sourced_from (~40% of material + rawsource) ──
    if ((type === "material" || type === "rawsource") && chance(0.40)) {
      node.attestations.push(mkAtt(
        supplierActor, "sourced_from", id, "sourcing_certificate",
        { timestamp: mkIsoDate(2024, 2025) }
      ));
    }

    // ── 5. country_of_origin (~50% of rawsource) ──
    if (type === "rawsource" && chance(0.50)) {
      const country = loc.loc.split(", ").pop();
      node.attestations.push(mkAtt(
        supplierActor, "country_of_origin", id, country,
        { timestamp: mkIsoDate(2024, 2025) }
      ));
    }

    // ── 6. conflict_mineral_free (~25% of rawsource metals) ──
    if (type === "rawsource" && chance(0.25)) {
      let cmStatus = "verified";
      if (contestedProvenanceCount < 1 && chance(0.08)) {
        cmStatus = "contested";
        contestedProvenanceCount++;
      }
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "conflict_mineral_free", id, "conflict_mineral_declaration",
        { timestamp: mkIsoDate(2024, 2025), status: cmStatus }
      ));
    }

    // ── 7. mined_at (~30% of rawsource) ──
    if (type === "rawsource" && chance(0.30)) {
      node.attestations.push(mkAtt(
        supplierActor, "mined_at", id, "mining_certificate",
        { timestamp: mkIsoDate(2023, 2025) }
      ));
    }

    // ── 8. refined_by (~20% of material) ──
    if (type === "material" && chance(0.20)) {
      node.attestations.push(mkAtt(
        supplierActor, "refined_by", id, "refining_certificate",
        { timestamp: mkIsoDate(2024, 2025) }
      ));
    }

    // ── 9. radiation_tested (~35% of component) ──
    if (type === "component" && chance(0.35)) {
      let radStatus = "verified";
      if (expiredRadTestCount < 1 && chance(0.06)) {
        radStatus = "expired";
        expiredRadTestCount++;
      }
      node.attestations.push(mkAtt(
        pick(TEST_LABS), "radiation_tested", id, "radiation_test_report",
        { timestamp: radStatus === "expired" ? mkIsoDate(2022, 2023) : mkIsoDate(2024, 2025),
          validUntil: radStatus === "expired" ? mkDateOnly(2024, 2025) : mkDateOnly(2027, 2029),
          status: radStatus }
      ));
    }

    // ── 10. thermal_vacuum_tested (~30% of component + subassembly) ──
    if ((type === "component" || type === "subassembly") && chance(0.30)) {
      node.attestations.push(mkAtt(
        pick(TEST_LABS), "thermal_vacuum_tested", id, "tvac_report",
        { timestamp: mkIsoDate(2024, 2026) }
      ));
    }

    // ── 11. vibration_tested (~25% of subassembly + assembly) ──
    if ((type === "subassembly" || type === "assembly") && chance(0.25)) {
      node.attestations.push(mkAtt(
        pick(TEST_LABS), "vibration_tested", id, "vibe_test_report",
        { timestamp: mkIsoDate(2024, 2026) }
      ));
    }

    // ── 12. flight_qualified (~20% of component) ──
    if (type === "component" && chance(0.20)) {
      let fqStatus = "verified";
      if (revokedFlightQualCount < 1 && chance(0.06)) {
        fqStatus = "revoked";
        revokedFlightQualCount++;
      }
      const { ts, validUntil } = mkCertDates();
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "flight_qualified", id, "flight_qual_report",
        { timestamp: ts, validUntil, status: fqStatus }
      ));
    }

    // ── 13. inspected (~20% of all) ──
    if (chance(0.20)) {
      const pass = chance(0.85);
      node.attestations.push(mkAtt(
        pick(INSPECTORS), "inspected", id, "inspection_report",
        { timestamp: mkIsoDate(2025, 2026), status: pass ? "verified" : "contested" }
      ));
    }

    // ── 14. calibrated (~50% of process) ──
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

    // ── 15. itar_controlled (~15% of all) ──
    if (opts.itar || chance(0.15)) {
      node.attestations.push(mkAtt(
        { name: "DDTC", id: "org-ddtc-9e1d" }, "itar_controlled", id, "itar_classification",
        { timestamp: mkIsoDate(2023, 2025) }
      ));
    }

    // ── 16. quality_approved (~25% of all) ──
    if (chance(0.25)) {
      node.attestations.push(mkAtt(
        pick(INSPECTORS), "quality_approved", id, "quality_release",
        { timestamp: mkIsoDate(2025, 2026) }
      ));
    }

    // ── 17. risk_assessed (~10% of all) ──
    if (chance(0.10)) {
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

  // ── Build subassemblies (assemblies in satellite terms) ────────────
  function mkSubassembly(depth) {
    const name = pick(ASSEMBLY_NAMES);
    const node = mkNode("subassembly", name);
    const maxDepth = range(depth + 2, depth + 5);
    const numChildren = range(2, 3);
    node.children = [];
    for (let i = 0; i < numChildren; i++) {
      node.children.push(mkLeafBranch(depth + 1, maxDepth));
    }
    return node;
  }

  // ── Build assemblies (subsystems in satellite terms) ───────────────
  function mkAssembly(name, depth) {
    const node = mkNode("assembly", name);
    const numSubs = range(2, 3);
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

  // ── Build systems (programs in satellite terms) ────────────────────
  function mkSystem(progInfo) {
    const divIndex = PROGRAM_NAMES.indexOf(progInfo);
    const supplierName = SUPPLIERS.system[divIndex !== -1 ? divIndex % SUPPLIERS.system.length : 0];
    const node = mkNode("system", progInfo.name, { supplier: supplierName });
    const subsystemNames = SUBSYSTEM_NAMES[progInfo.key] || SUBSYSTEM_NAMES.sentinel;
    const numSubsystems = range(4, Math.min(6, subsystemNames.length));
    node.children = [];
    const shuffled = [...subsystemNames].sort(() => rand() - 0.5);
    for (let i = 0; i < numSubsystems; i++) {
      node.children.push(mkAssembly(shuffled[i], 3));
    }
    return node;
  }

  // ── Build missions ─────────────────────────────────────────────────
  function mkMission(missionInfo) {
    const node = mkNode("program", missionInfo.name, { supplier: "GovCo Federal Satellite Agency" });
    const programKeys = MISSION_PROGRAMS[missionInfo.key] || [];
    node.children = [];
    for (const pKey of programKeys) {
      const progInfo = PROGRAM_NAMES.find(p => p.key === pKey);
      if (progInfo) node.children.push(mkSystem(progInfo));
    }
    return node;
  }

  // ── Root ───────────────────────────────────────────────────────────
  const govcoActor = mkSupplierActor("GovCo Federal Satellite Agency");
  const root = {
    id: "govco",
    name: "GovCo Federal Satellite Agency",
    type: "customer",
    location: "Cape Canaveral, FL, USA",
    lat: 28.39,
    lng: -80.60,
    attestations: [
      mkAtt(govcoActor, "supplied_by", "govco", "corporate_charter",
        { timestamp: "2020-01-15T00:00:00Z" }),
      mkAtt(RADIANT_SYSTEM, "registered_on_chain", "govco", "block_1",
        { evidenceHash: mkHash(), timestamp: "2024-01-01T08:00:00Z" }),
      mkAtt({ name: "BSI Group", id: "org-bsi-7a3f" }, "certified", "govco", "AS9100D",
        { timestamp: "2024-03-15T00:00:00Z", validUntil: "2027-03-15", status: "verified" }),
      mkAtt({ name: "DDTC", id: "org-ddtc-9e1d" }, "certified", "govco", "ITAR Registration",
        { timestamp: "2024-08-01T00:00:00Z", validUntil: "2027-08-01", status: "verified" }),
      mkAtt({ name: "NASA GSFC QA", id: "org-nasaqa-3c4d" }, "certified", "govco", "NASA-STD-8739",
        { timestamp: "2023-06-15T00:00:00Z", validUntil: "2026-06-15", status: "verified" }),
    ],
    children: [],
  };

  // Build missions (each mission contains its assigned satellite programs)
  for (const missionInfo of MISSION_NAMES) {
    root.children.push(mkMission(missionInfo));
  }

  // ── Guarantee edge cases via post-processing ──────────────────────
  const allNodes = [];
  function collectAll(n) { allNodes.push(n); if (n.children) n.children.forEach(collectAll); }
  collectAll(root);

  // Expired calibrations (need at least 4)
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

  // Contested provenance on a rawsource (conflict_mineral_free)
  if (contestedProvenanceCount < 1) {
    const rawNodes = allNodes.filter(n => n.type === "rawsource");
    if (rawNodes.length > 0) {
      const n = rawNodes[Math.floor(rawNodes.length / 3)];
      n.attestations.push(mkAtt(
        pick(CERT_BODIES), "conflict_mineral_free", n.id, "conflict_mineral_declaration",
        { timestamp: mkIsoDate(2024, 2025), status: "contested" }
      ));
    }
  }

  // Revoked flight qualification on a component
  if (revokedFlightQualCount < 1) {
    const componentNodes = allNodes.filter(n => n.type === "component" && !n.attestations.some(a => a.predicate === "flight_qualified"));
    if (componentNodes.length > 0) {
      const n = componentNodes[0];
      n.attestations.push(mkAtt(
        pick(CERT_BODIES), "flight_qualified", n.id, "flight_qual_report",
        { timestamp: mkIsoDate(2023, 2024), validUntil: "2026-06-15", status: "revoked" }
      ));
    }
  }

  // Expired radiation test on a component
  if (expiredRadTestCount < 1) {
    const componentNodes = allNodes.filter(n => n.type === "component" && !n.attestations.some(a => a.predicate === "radiation_tested"));
    if (componentNodes.length > 0) {
      const n = componentNodes[Math.floor(componentNodes.length / 2)];
      n.attestations.push(mkAtt(
        pick(TEST_LABS), "radiation_tested", n.id, "radiation_test_report",
        { timestamp: mkIsoDate(2022, 2023), validUntil: mkDateOnly(2024, 2025), status: "expired" }
      ));
    }
  }

  // ── Supplier identity override: n733 = Curtiss-Wright Defense Electronics ──
  const cwGovcoNode = allNodes.find(n => n.id === 'n733');
  if (cwGovcoNode) {
    const supAtt = cwGovcoNode.attestations.find(a => a.predicate === 'supplied_by');
    if (supAtt) supAtt.actor = { name: 'Curtiss-Wright Defense Electronics', id: 'org-curtiss-wright-de' };
  }

  // ── SDA variety override: Curtiss-Wright GovCo assets ──
  if (cwGovcoNode) {
    // n733 (Thruster Cluster): derivative, active — the primary govco disclosure
    if (cwGovcoNode.sda) {
      cwGovcoNode.sda.type = 'derivative'; cwGovcoNode.sda.status = 'active';
      cwGovcoNode.sda.sourceEvalId = 'eval-pgm-001'; cwGovcoNode.sda.evalResult = 'pass';
    }
    // Fix any pending statuses in direct children; override Platinum Group Metal if present
    const walkGov = n => {
      if (n.sda && n.sda.status === 'pending') { n.sda.status = 'active'; }
      if (n.name === 'Platinum Group Metal' && n.sda) {
        n.sda.type = 'derivative'; n.sda.status = 'active';
        n.sda.sourceEvalId = 'eval-pgm-001'; n.sda.evalResult = 'pass';
      }
      if (n.children) n.children.forEach(walkGov);
    };
    (cwGovcoNode.children || []).forEach(walkGov);
  }

  return root;
}

// Module-level cache: generate once, reuse forever
let _cached = null;
export function getDataset() {
  if (!_cached) _cached = generateDataset();
  return _cached;
}
