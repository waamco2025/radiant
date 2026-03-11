// Healthcare Personnel Qualification Dataset Generator
// FastCo Health Systems — Personnel credentialing & compliance tracking

// Seeded PRNG for deterministic generation
function mulberry32(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function generateDataset(seed = 101) {
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

  // Cert date generation (controls compliance distribution)
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

  // Evidence storage helpers
  const STORAGE_PROVIDERS = ['Radiant Vault', 'ChainStore', 'MedVault', 'SecureDocs', 'ProvenanceFS'];
  const ACCESS_LEVELS = ['restricted', 'confidential', 'internal', 'public'];
  function mkStorageRef() { return `vault://${pick(STORAGE_PROVIDERS).toLowerCase().replace(/\s/g,'-')}/${mkHash().slice(2)}-${mkHash().slice(2)}`; }
  function mkAccessLevel(predicate) {
    if (predicate === 'itar_controlled') return 'restricted';
    if (predicate === 'risk_assessed') return 'confidential';
    return pick(ACCESS_LEVELS);
  }

  // Attestation builder
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

  // ── Reference data ──────────────────────────────────────────────────
  const LOCATIONS = [
    { loc: "Boston, MA, USA", lat: 42.36, lng: -71.06 },
    { loc: "Rochester, MN, USA", lat: 44.02, lng: -92.47 },
    { loc: "Baltimore, MD, USA", lat: 39.29, lng: -76.61 },
    { loc: "Cleveland, OH, USA", lat: 41.50, lng: -81.69 },
    { loc: "Nashville, TN, USA", lat: 36.16, lng: -86.78 },
    { loc: "Houston, TX, USA", lat: 29.76, lng: -95.37 },
    { loc: "San Francisco, CA, USA", lat: 37.77, lng: -122.42 },
    { loc: "Philadelphia, PA, USA", lat: 39.95, lng: -75.17 },
    { loc: "Chicago, IL, USA", lat: 41.88, lng: -87.63 },
    { loc: "Seattle, WA, USA", lat: 47.61, lng: -122.33 },
    { loc: "Denver, CO, USA", lat: 39.74, lng: -104.99 },
    { loc: "Atlanta, GA, USA", lat: 33.75, lng: -84.39 },
    { loc: "Miami, FL, USA", lat: 25.76, lng: -80.19 },
    { loc: "Phoenix, AZ, USA", lat: 33.45, lng: -112.07 },
    { loc: "Portland, OR, USA", lat: 45.52, lng: -122.68 },
  ];

  // Suppliers mapped to TT-compatible type keys
  const SUPPLIERS = {
    program: ["FastCo Health Systems", "FastCo Health Systems", "FastCo Health Systems"],
    system: [
      "FastCo Boston General", "FastCo Mayo Campus", "FastCo Johns Hopkins",
      "FastCo Cleveland Clinic", "FastCo Vanderbilt", "FastCo MD Anderson",
      "FastCo UCSF Medical", "FastCo Penn Medicine", "FastCo Rush Medical",
      "FastCo Swedish Medical", "FastCo UCHealth", "FastCo Emory Hospital",
    ],
    assembly: [
      "Emergency Medicine", "Cardiology", "Oncology", "Neurosurgery",
      "Orthopedics", "Pediatrics", "Radiology", "Anesthesiology",
      "Internal Medicine", "Pathology", "Pulmonology", "Gastroenterology",
    ],
    component: [
      "Dr. Sarah Chen", "RN Maria Garcia", "Tech. James Wilson", "Dr. Arun Patel",
      "RN Emily Thompson", "Dr. Michael O'Brien", "PA Lisa Nakamura", "RN David Santos",
      "Dr. Rachel Kim", "Tech. Omar Hassan", "RN Jessica Martinez", "Dr. William Park",
      "Dr. Fatima Al-Rashidi", "RN Kenji Watanabe", "Tech. Lauren Davis", "Dr. Igor Volkov",
      "RN Ana Reyes", "Dr. Priya Sharma", "PA Thomas Brown", "RN Mei-Lin Chang",
      "Dr. Erik Johansson", "Tech. Amara Osei", "RN Patrick O'Malley", "Dr. Yuki Tanaka",
      "RN Sophia Costa", "Dr. Benjamin Goldberg", "Tech. Aaliyah Johnson", "RN Carlos Mendez",
      "Dr. Helen Papadopoulos", "PA Nadia Ibrahim", "RN Tyler Reed", "Dr. Olga Petrov",
      "Tech. Daniel Flores", "RN Grace Adeyemi", "Dr. Robert Mitchell", "RN Hannah Fischer",
      "Dr. Mei-Ling Wu", "Tech. Brandon Kowalski", "RN Isabelle Fontaine", "Dr. Raj Kapoor",
    ],
  };

  const FACILITY_NAMES = [
    "FastCo Boston General", "FastCo Mayo Campus", "FastCo Johns Hopkins",
    "FastCo Cleveland Clinic", "FastCo Vanderbilt", "FastCo MD Anderson",
    "FastCo UCSF Medical", "FastCo Penn Medicine", "FastCo Rush Medical",
    "FastCo Swedish Medical", "FastCo UCHealth", "FastCo Emory Hospital",
  ];

  const DEPT_NAMES = [
    "Emergency Medicine", "Cardiology", "Oncology", "Neurosurgery",
    "Orthopedics", "Pediatrics", "Radiology", "Anesthesiology",
    "Internal Medicine", "Pathology", "Pulmonology", "Gastroenterology",
  ];

  const PERSONNEL_NAMES = [
    "Dr. Sarah Chen", "RN Maria Garcia", "Tech. James Wilson", "Dr. Arun Patel",
    "RN Emily Thompson", "Dr. Michael O'Brien", "PA Lisa Nakamura", "RN David Santos",
    "Dr. Rachel Kim", "Tech. Omar Hassan", "RN Jessica Martinez", "Dr. William Park",
    "Dr. Fatima Al-Rashidi", "RN Kenji Watanabe", "Tech. Lauren Davis", "Dr. Igor Volkov",
    "RN Ana Reyes", "Dr. Priya Sharma", "PA Thomas Brown", "RN Mei-Lin Chang",
    "Dr. Erik Johansson", "Tech. Amara Osei", "RN Patrick O'Malley", "Dr. Yuki Tanaka",
    "RN Sophia Costa", "Dr. Benjamin Goldberg", "Tech. Aaliyah Johnson", "RN Carlos Mendez",
    "Dr. Helen Papadopoulos", "PA Nadia Ibrahim", "RN Tyler Reed", "Dr. Olga Petrov",
    "Tech. Daniel Flores", "RN Grace Adeyemi", "Dr. Robert Mitchell", "RN Hannah Fischer",
    "Dr. Mei-Ling Wu", "Tech. Brandon Kowalski", "RN Isabelle Fontaine", "Dr. Raj Kapoor",
  ];

  // ── Actor pools ─────────────────────────────────────────────────────
  const CERT_BODIES = [
    { name: "ANCC", id: "org-ancc-1a2b" },
    { name: "ABMS", id: "org-abms-3c4d" },
    { name: "NBRC", id: "org-nbrc-5e6f" },
    { name: "Joint Commission", id: "org-jc-7g8h" },
    { name: "State Medical Board", id: "org-smb-9i0j" },
    { name: "AHA", id: "org-aha-1k2l" },
    { name: "AABB", id: "org-aabb-3m4n" },
    { name: "CAP", id: "org-cap-5o6p" },
  ];

  const TRAINING_PROVIDERS = [
    { name: "AHA Training Center", id: "org-ahatc-a1b2" },
    { name: "FastCo CME Program", id: "org-mtcme-c3d4" },
    { name: "ACLS Institute", id: "org-acls-e5f6" },
    { name: "Hospital Safety Board", id: "org-hsb-g7h8" },
    { name: "Clinical Skills Lab", id: "org-csl-i9j0" },
  ];

  const EQUIPMENT_SERVICES = [
    { name: "Siemens Healthineers", id: "org-siemens-a1b2" },
    { name: "GE Healthcare Service", id: "org-gehs-c3d4" },
    { name: "Philips Medical", id: "org-philips-e5f6" },
    { name: "Beckman Coulter", id: "org-beckman-g7h8" },
  ];

  const COMPLIANCE_OFFICERS = [
    { name: "Compliance Dept.", id: "org-compdept-a1b2" },
    { name: "Risk Management", id: "org-riskmgmt-c3d4" },
  ];

  const RADIANT_SYSTEM = { name: "Radiant Provenance Engine", id: "sys-radiant-001" };
  const EVAL_ACTOR = { name: "Radiant AI Evaluator", id: "sys-radiant-eval-001" };

  // Evidence type pools
  const CERT_EVIDENCE_TYPES = [
    "Medical License", "Board Certification", "Specialty Board Cert",
    "DEA Registration", "State Nursing License", "Pharmacy License", "Radiology License",
  ];

  const TRAINING_EVIDENCE_TYPES = [
    "BLS Training", "ACLS Training", "PALS Training", "Infection Control",
    "HIPAA Compliance", "Radiation Safety", "Hazardous Materials", "Cultural Competency",
  ];

  const PROCEDURE_EVIDENCE_TYPES = [
    "Surgical Privileges", "Conscious Sedation", "Central Line Placement",
    "Intubation", "Chest Tube Insertion",
  ];

  const SPECIALTY_BOARD_TYPES = [
    "Cardiology Board", "Oncology Board", "Neurosurgery Board",
    "Orthopedic Board", "Internal Medicine Board",
  ];

  // ── Supplier actor cache (same name → same actor) ──────────────────
  const supplierActors = {};
  const mkSupplierActor = name => {
    if (!supplierActors[name]) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
      supplierActors[name] = { name, id: `org-${slug}-${mkHash().slice(2, 6)}` };
    }
    return supplierActors[name];
  };

  // ── Edge case counters ─────────────────────────────────────────────
  let expiredCprCount = 0;
  let contestedCredentialCount = 0;
  let expiringTrainingCount = 0;

  // ── SDA builder ─────────────────────────────────────────────────────
  const SDA_RECEIVER = 'FastCo Health Systems';
  const SDA_EVAL_PREFIX = 'eval-hc';
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

  // ── Personnel node builder ──────────────────────────────────────────
  function mkPersonnelNode(name, facilityName) {
    const loc = pick(LOCATIONS);
    const id = mkId();
    const supplierActor = mkSupplierActor(facilityName);
    const block = mkBlock();
    const token = mkHash();
    const isNew = chance(0.05);
    const isDoctor = name.startsWith("Dr.");

    const node = {
      id,
      name,
      type: "component",
      location: loc.loc,
      lat: loc.lat,
      lng: loc.lng,
      attestations: [],
      children: [],
    };

    // ── 1. supplied_by (every node — employer facility) ──
    node.attestations.push(mkAtt(
      supplierActor, "supplied_by", id, "employment_agreement",
      { timestamp: mkIsoDate(2023, 2025) }
    ));

    // ── 2. registered_on_chain (every node) ──
    node.attestations.push(mkAtt(
      RADIANT_SYSTEM, "registered_on_chain", id, `block_${block}`,
      { evidenceHash: token, timestamp: isNew ? mkRecentDate() : mkIsoDate(2024, 2025) }
    ));

    // ── 3. holds_certification — 2-4 per person ──
    const numCerts = range(2, 4);
    for (let i = 0; i < numCerts; i++) {
      let { ts, validUntil, status } = mkCertDates();
      // Edge case: contested credential (license under review)
      if (contestedCredentialCount < 1 && status === "verified" && chance(0.008)) {
        status = "contested";
        contestedCredentialCount++;
      }
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "holds_certification", id, pick(CERT_EVIDENCE_TYPES),
        { timestamp: ts, validUntil, status }
      ));
    }

    // ── 4. completed_training — 1-3 per person (~80%) ──
    if (chance(0.80)) {
      const numTraining = range(1, 3);
      for (let i = 0; i < numTraining; i++) {
        let { ts, validUntil, status } = mkCertDates();
        // Edge case: training expiring within 30 days (Feb/Mar 2026)
        if (expiringTrainingCount < 3 && status === "verified" && chance(0.05)) {
          validUntil = `2026-${pad2(range(2, 3))}-${pad2(range(1, 28))}`;
          expiringTrainingCount++;
        }
        node.attestations.push(mkAtt(
          pick(TRAINING_PROVIDERS), "completed_training", id, pick(TRAINING_EVIDENCE_TYPES),
          { timestamp: ts, validUntil, status }
        ));
      }
    }

    // ── 5. cpr_certified — ~70% of personnel ──
    if (chance(0.70)) {
      let { ts, validUntil, status } = mkCertDates();
      // Edge case: expired CPR certifications
      if (expiredCprCount < 5 && chance(0.15)) {
        status = "expired";
        validUntil = mkDateOnly(2024, 2025);
        ts = mkIsoDate(2022, 2023);
        expiredCprCount++;
      }
      node.attestations.push(mkAtt(
        pick([...TRAINING_PROVIDERS.slice(0, 2), CERT_BODIES[5]]), // AHA, AHA Training Center, FastCo CME
        "cpr_certified", id, "CPR/BLS Certification",
        { timestamp: ts, validUntil, status }
      ));
    }

    // ── 6. authorized_for_procedure — ~40% of personnel ──
    if (chance(0.40)) {
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "authorized_for_procedure", id, pick(PROCEDURE_EVIDENCE_TYPES),
        { timestamp: mkIsoDate(2024, 2025), validUntil: mkDateOnly(2027, 2029), status: "verified" }
      ));
    }

    // ── 7. background_checked — ~90% of personnel ──
    if (chance(0.90)) {
      node.attestations.push(mkAtt(
        pick(COMPLIANCE_OFFICERS), "background_checked", id, "Background Check",
        { timestamp: mkIsoDate(2023, 2025), status: "verified" }
      ));
    }

    // ── 8. license_renewed — ~60% of personnel ──
    if (chance(0.60)) {
      const { ts, validUntil, status } = mkCertDates();
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "license_renewed", id, "License Renewal",
        { timestamp: ts, validUntil, status }
      ));
    }

    // ── 9. specialty_board_certified — ~30% of personnel (doctors) ──
    if (isDoctor && chance(0.30)) {
      const { ts, validUntil, status } = mkCertDates();
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "specialty_board_certified", id, pick(SPECIALTY_BOARD_TYPES),
        { timestamp: ts, validUntil, status }
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

    node.sda = mkSda(facilityName, id);
    return node;
  }

  // ── Department node builder ─────────────────────────────────────────
  function mkDepartmentNode(deptName, facilityName, facilityLoc) {
    const id = mkId();
    const supplierActor = mkSupplierActor(facilityName);
    const block = mkBlock();
    const token = mkHash();
    const isNew = chance(0.05);

    const node = {
      id,
      name: deptName,
      type: "assembly",
      location: facilityLoc.loc,
      lat: facilityLoc.lat,
      lng: facilityLoc.lng,
      attestations: [],
      children: [],
    };

    // ── 1. supplied_by ──
    node.attestations.push(mkAtt(
      supplierActor, "supplied_by", id, "department_charter",
      { timestamp: mkIsoDate(2023, 2025) }
    ));

    // ── 2. registered_on_chain ──
    node.attestations.push(mkAtt(
      RADIANT_SYSTEM, "registered_on_chain", id, `block_${block}`,
      { evidenceHash: token, timestamp: isNew ? mkRecentDate() : mkIsoDate(2024, 2025) }
    ));

    // ── Department-level attestations ──

    // inspected — ~30% of departments
    if (chance(0.30)) {
      const pass = chance(0.85);
      node.attestations.push(mkAtt(
        pick(COMPLIANCE_OFFICERS), "inspected", id, "department_inspection",
        { timestamp: mkIsoDate(2025, 2026), status: pass ? "verified" : "contested" }
      ));
    }

    // equipment_certified — ~50% of departments
    if (chance(0.50)) {
      const { ts, validUntil, status } = mkCertDates();
      node.attestations.push(mkAtt(
        pick(EQUIPMENT_SERVICES), "equipment_certified", id, "Equipment Certification",
        { timestamp: ts, validUntil, status }
      ));
    }

    // sterilization_verified — ~40% of departments
    if (chance(0.40)) {
      node.attestations.push(mkAtt(
        pick(COMPLIANCE_OFFICERS), "sterilization_verified", id, "Sterilization Log",
        { timestamp: mkIsoDate(2025, 2026), status: "verified" }
      ));
    }

    // custody_transferred — ~15% of departments (pharmacy, controlled substances)
    if (chance(0.15)) {
      node.attestations.push(mkAtt(
        pick(COMPLIANCE_OFFICERS), "custody_transferred", id, "Chain of Custody Record",
        { timestamp: mkIsoDate(2025, 2026), status: "verified" }
      ));
    }

    // inventory_verified — ~20% of departments
    if (chance(0.20)) {
      node.attestations.push(mkAtt(
        pick(COMPLIANCE_OFFICERS), "inventory_verified", id, "Inventory Audit",
        { timestamp: mkIsoDate(2025, 2026), status: "verified" }
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

    // ── Build personnel children (3-8 per department) ──
    const numPersonnel = range(3, 8);
    const shuffledPersonnel = [...PERSONNEL_NAMES].sort(() => rand() - 0.5);
    for (let p = 0; p < numPersonnel; p++) {
      const personnelName = shuffledPersonnel[p % shuffledPersonnel.length];
      node.children.push(mkPersonnelNode(personnelName, facilityName));
    }

    node.sda = mkSda(facilityName, id);
    return node;
  }

  // ── Facility node builder ───────────────────────────────────────────
  function mkFacilityNode(facilityName) {
    const loc = pick(LOCATIONS);
    const id = mkId();
    const supplierActor = mkSupplierActor(facilityName);
    const block = mkBlock();
    const token = mkHash();
    const isNew = chance(0.05);

    const node = {
      id,
      name: facilityName,
      type: "system",
      location: loc.loc,
      lat: loc.lat,
      lng: loc.lng,
      attestations: [],
      children: [],
    };

    // ── 1. supplied_by ──
    node.attestations.push(mkAtt(
      supplierActor, "supplied_by", id, "facility_agreement",
      { timestamp: mkIsoDate(2023, 2025) }
    ));

    // ── 2. registered_on_chain ──
    node.attestations.push(mkAtt(
      RADIANT_SYSTEM, "registered_on_chain", id, `block_${block}`,
      { evidenceHash: token, timestamp: isNew ? mkRecentDate() : mkIsoDate(2024, 2025) }
    ));

    // ── Facility-level certifications (1-2 from CERT_BODIES) ──
    const numFacilityCerts = range(1, 2);
    for (let i = 0; i < numFacilityCerts; i++) {
      const { ts, validUntil, status } = mkCertDates();
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "certified", id, pick(["Joint Commission Accreditation", "CMS Certification", "State Health Dept License", "AAAHC Accreditation"]),
        { timestamp: ts, validUntil, status }
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

    // ── Build department children (3-6 per facility) ──
    const numDepts = range(3, 6);
    const shuffledDepts = [...DEPT_NAMES].sort(() => rand() - 0.5);
    for (let d = 0; d < numDepts; d++) {
      const deptName = shuffledDepts[d % shuffledDepts.length];
      node.children.push(mkDepartmentNode(deptName, facilityName, loc));
    }

    return node;
  }

  // ── Program definitions ──────────────────────────────────────────────
  const PROGRAM_NAMES = [
    { name: "CardioSync Device Certification", key: "cardiosync" },
    { name: "Joint Commission Accreditation 2026", key: "jcaho" },
    { name: "Surgical Robotics Platform", key: "robotics" },
  ];

  function mkProgramNode(progInfo, facilities) {
    const loc = pick(LOCATIONS);
    const id = mkId();
    const supplierActor = mkSupplierActor("FastCo Health Systems");
    const block = mkBlock();
    const token = mkHash();
    const isNew = chance(0.05);

    const node = {
      id,
      name: progInfo.name,
      type: "program",
      location: loc.loc,
      lat: loc.lat,
      lng: loc.lng,
      attestations: [],
      children: facilities,
    };

    // supplied_by
    node.attestations.push(mkAtt(
      supplierActor, "supplied_by", id, "supplier_agreement",
      { timestamp: mkIsoDate(2023, 2025) }
    ));

    // registered_on_chain
    node.attestations.push(mkAtt(
      RADIANT_SYSTEM, "registered_on_chain", id, `block_${block}`,
      { evidenceHash: token, timestamp: isNew ? mkRecentDate() : mkIsoDate(2024, 2025) }
    ));

    // 1-2 certifications
    const numCerts = range(1, 2);
    for (let i = 0; i < numCerts; i++) {
      const { ts, validUntil, status } = mkCertDates();
      node.attestations.push(mkAtt(
        pick(CERT_BODIES), "certified", id, pick(["Joint Commission Accreditation", "CMS Certification", "AAAHC Accreditation", "CAP Accreditation"]),
        { timestamp: ts, validUntil, status }
      ));
    }

    // evaluation
    if (chance(0.98)) {
      const evalStatus = chance(0.97) ? "verified" : "contested";
      const evalTs = mkIsoDate(2025, 2026);
      const evalValid = mkDateOnly(2027, 2029);
      node.attestations.push(mkAtt(
        EVAL_ACTOR, "evaluated_against_requirements", id, "evaluation_report",
        { timestamp: evalTs, validUntil: evalValid, status: evalStatus }
      ));
    }

    return node;
  }

  // ── Root ───────────────────────────────────────────────────────────
  const medtraceActor = mkSupplierActor("FastCo Health Systems");
  const root = {
    id: "medtrace",
    name: "FastCo Health Systems",
    type: "customer",
    location: "Boston, MA, USA",
    lat: 42.36,
    lng: -71.06,
    attestations: [
      mkAtt(medtraceActor, "supplied_by", "medtrace", "corporate_charter",
        { timestamp: "2020-03-01T00:00:00Z" }),
      mkAtt(RADIANT_SYSTEM, "registered_on_chain", "medtrace", "block_1",
        { evidenceHash: mkHash(), timestamp: "2024-01-15T08:00:00Z" }),
      mkAtt({ name: "Joint Commission", id: "org-jc-7g8h" }, "certified", "medtrace", "Joint Commission Accreditation",
        { timestamp: "2024-05-10T00:00:00Z", validUntil: "2027-05-10", status: "verified" }),
      mkAtt({ name: "ABMS", id: "org-abms-3c4d" }, "certified", "medtrace", "CMS Certification",
        { timestamp: "2024-02-20T00:00:00Z", validUntil: "2027-02-20", status: "verified" }),
      mkAtt({ name: "CAP", id: "org-cap-5o6p" }, "certified", "medtrace", "CAP Accreditation",
        { timestamp: "2023-09-15T00:00:00Z", validUntil: "2026-09-15", status: "verified" }),
    ],
    children: [],
  };

  // ── Build facilities then distribute across programs ─────────────────
  const numFacilities = range(10, 12);
  const shuffledFacilities = [...FACILITY_NAMES].sort(() => rand() - 0.5);
  const allFacilities = [];
  for (let i = 0; i < numFacilities; i++) {
    allFacilities.push(mkFacilityNode(shuffledFacilities[i]));
  }

  // Distribute facilities across 3 programs (roughly equal split)
  const perProgram = Math.floor(allFacilities.length / PROGRAM_NAMES.length);
  for (let p = 0; p < PROGRAM_NAMES.length; p++) {
    const start = p * perProgram;
    const end = p === PROGRAM_NAMES.length - 1 ? allFacilities.length : start + perProgram;
    root.children.push(mkProgramNode(PROGRAM_NAMES[p], allFacilities.slice(start, end)));
  }

  // ── Guarantee edge cases via post-processing ──────────────────────
  const allNodes = [];
  function collectAll(n) { allNodes.push(n); if (n.children) n.children.forEach(collectAll); }
  collectAll(root);

  const personnelNodes = allNodes.filter(n => n.type === "component");
  const deptNodes = allNodes.filter(n => n.type === "assembly");

  // 3-5 expired CPR certifications
  if (expiredCprCount < 3) {
    const candidates = personnelNodes.filter(n =>
      !n.attestations.some(a => a.predicate === "cpr_certified" && a.status === "expired")
    );
    for (const n of candidates) {
      if (expiredCprCount >= 5) break;
      // Remove any existing cpr_certified attestation, replace with expired
      const existingIdx = n.attestations.findIndex(a => a.predicate === "cpr_certified");
      if (existingIdx >= 0) {
        n.attestations[existingIdx].status = "expired";
        n.attestations[existingIdx].validUntil = mkDateOnly(2024, 2025);
        n.attestations[existingIdx].timestamp = mkIsoDate(2022, 2023);
        expiredCprCount++;
      } else {
        n.attestations.push(mkAtt(
          pick([TRAINING_PROVIDERS[0], CERT_BODIES[5]]),
          "cpr_certified", n.id, "CPR/BLS Certification",
          { timestamp: mkIsoDate(2022, 2023), validUntil: mkDateOnly(2024, 2025), status: "expired" }
        ));
        expiredCprCount++;
      }
    }
  }

  // 1 contested credential (license under review)
  if (contestedCredentialCount < 1) {
    const target = personnelNodes.find(n =>
      n.attestations.some(a => a.predicate === "holds_certification" && a.status === "verified")
    );
    if (target) {
      const certAtt = target.attestations.find(a => a.predicate === "holds_certification" && a.status === "verified");
      if (certAtt) {
        certAtt.status = "contested";
        contestedCredentialCount++;
      }
    }
  }

  // 2-3 personnel with training expiring within 30 days (Feb/Mar 2026)
  if (expiringTrainingCount < 2) {
    const candidates = personnelNodes.filter(n =>
      n.attestations.some(a => a.predicate === "completed_training" && a.status === "verified")
    );
    for (const n of candidates) {
      if (expiringTrainingCount >= 3) break;
      const trainingAtt = n.attestations.find(a =>
        a.predicate === "completed_training" && a.status === "verified"
      );
      if (trainingAtt) {
        trainingAtt.validUntil = `2026-${pad2(range(2, 3))}-${pad2(range(1, 28))}`;
        expiringTrainingCount++;
      }
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
