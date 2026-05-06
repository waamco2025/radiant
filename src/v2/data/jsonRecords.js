// jsonRecords.js — Phase 13.4 (#175). Realistic distributed-storage-style
// JSON records for each artifact type. Surfaced by the JSON tab of every
// expand modal as a hand-crafted view of what the artifact would look like
// as a document persisted in the user's qualified storage.
//
// Realism rules:
//   • References are ID-only — never embedded objects (a Claim's
//     `referencedAssetIds` is `[\"asset-a3k7m2x9\", ...]`, not nested
//     Asset payloads).
//   • Top-level shape is uniform across types: id, artifactType,
//     artifactUri, ownerDid, dot{...}, createdAt, updatedAt, status,
//     followed by type-specific content + reference fields.
//   • Timestamps are ISO 8601.
//   • `dot` mirrors the structured DOT object (spec §2.4 / canon X.1–X.10):
//     pin, hash (or null for synthetic artifacts), ownerDid,
//     registrationTimestamp, metadata, lineage.

function _dotRecord(dot, fallbacks = {}) {
  return {
    pin: dot?.pin ?? fallbacks.pin ?? null,
    hash: dot?.hash ?? fallbacks.hash ?? null,
    ownerDid: dot?.ownerDid ?? fallbacks.ownerDid ?? null,
    registrationTimestamp: dot?.registrationTimestamp ?? fallbacks.registrationTimestamp ?? null,
    metadata: dot?.metadata ?? {},
    lineage: dot?.lineage ?? [],
  }
}

export function getAssetJsonRecord(asset) {
  if (!asset) return {}
  const ownerDid = asset.dot?.ownerDid || asset.ownerDot || null
  return {
    id: asset.id,
    artifactType: 'asset',
    artifactUri: asset.artifactUri || `provenance://assets/${asset.id}`,
    ownerDid,
    dot: _dotRecord(asset.dot, {
      pin: asset.pin,
      hash: asset.file?.hash,
      ownerDid,
      registrationTimestamp: asset.registrationDate,
    }),
    name: asset.name || null,
    description: asset.description || '',
    file: {
      filename: asset.file?.filename || null,
      mimeType: asset.file?.mimeType || null,
      sizeBytes: asset.file?.size ?? null,
      sha256: asset.file?.hash || null,
      uri: asset.file?.uri || null,
    },
    parentAssetId: asset.parentAssetId || null,
    parseResultIds: Array.isArray(asset.parseResultIds) ? [...asset.parseResultIds] : [],
    createdAt: asset.registrationDate || null,
    updatedAt: asset.registrationDate || null,
    status: 'active',
  }
}

export function getClaimJsonRecord(claim) {
  if (!claim) return {}
  const ownerDid = claim.dot?.ownerDid || claim.ownerDot || null
  return {
    id: claim.id,
    artifactType: 'claim',
    artifactUri: claim.artifactUri || `provenance://claims/${claim.id}`,
    ownerDid,
    dot: _dotRecord(claim.dot, {
      pin: claim.pin,
      hash: null,
      ownerDid,
      registrationTimestamp: claim.createdDate,
    }),
    name: claim.name || null,
    description: claim.description || '',
    referencedAssetIds: Array.isArray(claim.referencedAssetIds)
      ? [...claim.referencedAssetIds]
      : [],
    assetReferences: Array.isArray(claim.assetReferences)
      ? claim.assetReferences.map((r) => ({
          assetId: r.assetId,
          supersededBy: r.supersededBy ?? null,
          addedDate: r.addedDate ?? null,
          removedDate: r.removedDate ?? null,
        }))
      : [],
    referencedRequirementsSetIds: Array.isArray(claim.referencedRequirementsSets)
      ? claim.referencedRequirementsSets.map((r) => ({
          id: r.requirementsSetId,
          addedDate: r.addedDate || null,
        }))
      : [],
    acknowledgments: Array.isArray(claim.acknowledgments)
      ? claim.acknowledgments.map((a) => ({ id: a.id, title: a.title, description: a.description }))
      : [],
    amendments: Array.isArray(claim.amendments)
      ? claim.amendments.map((a) => ({
          date: a.date,
          added: [...(a.added || [])],
          removed: [...(a.removed || [])],
          addedRequirementsSetIds: [...(a.addedRequirementsSetIds || [])],
          removedRequirementsSetIds: [...(a.removedRequirementsSetIds || [])],
          supersededAssets: (a.supersededAssets || []).map((s) => ({ from: s.from, to: s.to })),
          removedAssetIds: [...(a.removedAssetIds || [])],
        }))
      : [],
    createdAt: claim.createdDate || null,
    updatedAt: claim.amendments && claim.amendments.length > 0
      ? claim.amendments[claim.amendments.length - 1].date
      : claim.createdDate || null,
    status: 'active',
  }
}

export function getParseResultJsonRecord(parseResult) {
  if (!parseResult) return {}
  return {
    id: parseResult.id,
    artifactType: 'parseResult',
    artifactUri: parseResult.artifactUri || `provenance://artifacts/${parseResult.id}`,
    ownerDid: parseResult.ownerDot || null,
    sourceAssetId: parseResult.sourceAssetId || null,
    parseTemplateId: parseResult.templateId || null,
    parseTemplateName: parseResult.templateName || null,
    parseTemplateVersion: parseResult.templateVersion ?? 1,
    extractedFields: Array.isArray(parseResult.fields)
      ? parseResult.fields.map((f) => ({
          id: f.id,
          name: f.name,
          value: f.value,
          confidence: f.confidence ?? null,
        }))
      : [],
    createdAt: parseResult.parseDate || null,
    updatedAt: parseResult.parseDate || null,
    status: 'active',
  }
}

export function getEvalResultJsonRecord(evalResult) {
  if (!evalResult) return {}
  const ownerDid = evalResult.dot?.ownerDid || evalResult.ownerDot || null
  return {
    id: evalResult.id,
    artifactType: 'evaluationResult',
    artifactUri: evalResult.artifactUri || `provenance://artifacts/${evalResult.id}`,
    ownerDid,
    evaluatorDid: ownerDid,
    dot: _dotRecord(evalResult.dot, {
      pin: evalResult.pin,
      hash: null,
      ownerDid,
      registrationTimestamp: evalResult.evaluationDate,
    }),
    claimId: evalResult.claimId || null,
    evaluationAgreementId: evalResult.evaluationAgreementId || null,
    granteeAssetId: evalResult.granteeAssetId || null,
    requirementsSetIds: Array.isArray(evalResult.requirementsSets)
      ? evalResult.requirementsSets.map((rs) => ({
          id: rs.id,
          name: rs.name,
          version: rs.version ?? 1,
        }))
      : [],
    evidenceUsed: Array.isArray(evalResult.evidenceUsed) ? [...evalResult.evidenceUsed] : [],
    priorEvalResultId: evalResult.priorEvalResultId || null,
    supersededBy: evalResult.supersededBy || null,
    evidenceDiff: evalResult.evidenceDiff
      ? {
          added: [...(evalResult.evidenceDiff.added || [])],
          removed: [...(evalResult.evidenceDiff.removed || [])],
          superseded: (evalResult.evidenceDiff.superseded || []).map((s) => ({ from: s.from, to: s.to })),
          carried: [...(evalResult.evidenceDiff.carried || [])],
        }
      : null,
    results: Array.isArray(evalResult.results)
      ? evalResult.results.map((r) => ({
          requirementsSetId: r.requirementsSetId,
          requirementId: r.requirementId,
          label: r.label,
          value: r.value,
          status: r.status,
          confidence: r.confidence ?? null,
        }))
      : [],
    evaluationDate: evalResult.evaluationDate || null,
    createdAt: evalResult.evaluationDate || null,
    updatedAt: evalResult.evaluationDate || null,
    status: evalResult.status || 'active',
  }
}

export function getPoeJsonRecord(poe) {
  if (!poe) return {}
  const ownerDid = poe.dot?.ownerDid || poe.ownerDot || null
  return {
    id: poe.id,
    artifactType: 'poe',
    artifactUri: poe.artifactUri || `provenance://poe/${poe.id}`,
    ownerDid,
    evaluatorDid: ownerDid,
    dot: _dotRecord(poe.dot, {
      pin: poe.pin,
      hash: null,
      ownerDid,
      registrationTimestamp: poe.createdDate,
    }),
    name: poe.name || null,
    claimId: poe.claimId || null,
    wrappedEvalResultId: poe.wrappedEvalResultId || null,
    requirementsSetIds: Array.isArray(poe.requirementsSetIds) ? [...poe.requirementsSetIds] : [],
    assetSnapshot: Array.isArray(poe.assetSnapshot) ? [...poe.assetSnapshot] : [],
    createdAt: poe.createdDate || null,
    updatedAt: poe.createdDate || null,
    status: poe.status || 'active',
  }
}

export function getDaJsonRecord(da) {
  if (!da) return {}
  return {
    id: da.id,
    artifactType: 'disclosureAgreement',
    artifactUri: da.artifactUri || `provenance://agreements/${da.id}`,
    grantorDid: da.grantor?.dot || null,
    granteeDid: da.grantee?.dot || null,
    grantorParty: da.grantor?.party || null,
    granteeParty: da.grantee?.party || null,
    subject: da.subject ? { kind: da.subject.kind, id: da.subject.id } : null,
    granteeAssetId: da.granteeAssetId || null,
    type: da.type || null,
    scope: {
      assetIds: Array.isArray(da.scope?.assetIds) ? [...da.scope.assetIds] : null,
      fieldIds: Array.isArray(da.scope?.fieldIds) ? [...da.scope.fieldIds] : null,
      evaluationResultIds: Array.isArray(da.scope?.evaluationResultIds)
        ? [...da.scope.evaluationResultIds] : null,
      poeIds: Array.isArray(da.scope?.poeIds) ? [...da.scope.poeIds] : null,
      includeDerivatives: da.scope?.includeDerivatives ?? null,
    },
    terms: {
      createdDate: da.terms?.createdDate || null,
      expires: da.terms?.expires || null,
      autoRenew: da.terms?.autoRenew ?? false,
    },
    amendments: Array.isArray(da.amendments)
      ? da.amendments.map((a) => ({ ...a }))
      : [],
    createdAt: da.terms?.createdDate || null,
    updatedAt: Array.isArray(da.amendments) && da.amendments.length > 0
      ? da.amendments[da.amendments.length - 1].date || da.terms?.createdDate || null
      : da.terms?.createdDate || null,
    status: da.status || 'active',
  }
}

export function getEaJsonRecord(ea) {
  if (!ea) return {}
  return {
    id: ea.id,
    artifactType: 'evaluationAgreement',
    artifactUri: ea.artifactUri || `provenance://agreements/${ea.id}`,
    grantorDid: ea.grantor?.dot || null,
    granteeDid: ea.grantee?.dot || null,
    grantorParty: ea.grantor?.party || null,
    granteeParty: ea.grantee?.party || null,
    claimId: ea.claimId || null,
    granteeAssetId: ea.granteeAssetId || null,
    disclosureAgreementId: ea.disclosureAgreementId || null,
    authorizedRequirementsSetIds: Array.isArray(ea.authorizedRequirementsSetIds)
      ? [...ea.authorizedRequirementsSetIds] : [],
    acknowledgmentsAccepted: Array.isArray(ea.acknowledgmentsAccepted)
      ? [...ea.acknowledgmentsAccepted] : [],
    restrictions: {
      priorEvaluationRequired: ea.restrictions?.priorEvaluationRequired ?? null,
      additionalParticipants: Array.isArray(ea.restrictions?.additionalParticipants)
        ? [...ea.restrictions.additionalParticipants] : [],
    },
    terms: {
      createdDate: ea.terms?.createdDate || null,
      evaluationDeadline: ea.terms?.evaluationDeadline || null,
      resultExpiry: ea.terms?.resultExpiry || null,
      flowDownRequirements: Array.isArray(ea.terms?.flowDownRequirements)
        ? [...ea.terms.flowDownRequirements] : [],
    },
    incentives: {
      onSatisfactory: ea.incentives?.onSatisfactory ?? null,
      onUnsatisfactory: ea.incentives?.onUnsatisfactory ?? null,
    },
    amendments: Array.isArray(ea.amendments)
      ? ea.amendments.map((a) => ({ ...a }))
      : [],
    createdAt: ea.terms?.createdDate || null,
    updatedAt: Array.isArray(ea.amendments) && ea.amendments.length > 0
      ? ea.amendments[ea.amendments.length - 1].date || ea.terms?.createdDate || null
      : ea.terms?.createdDate || null,
    status: ea.status || 'active',
  }
}

// Phase 14.0 (#169 part 1): Badge Template record. Versioned Library artifact
// owned by a creator Actor; references Requirements Sets by ID only.
export function getBadgeTemplateJsonRecord(template) {
  if (!template) return {}
  const ownerDid = template.dot?.ownerDid || template.ownerDot || null
  return {
    id: template.id,
    artifactType: 'badgeTemplate',
    artifactUri: template.artifactUri || `provenance://badges/${template.id}`,
    ownerDid,
    ownerParty: template.ownerParty || null,
    dot: _dotRecord(template.dot, {
      pin: template.pin,
      hash: null,
      ownerDid,
      registrationTimestamp: template.createdDate,
    }),
    name: template.name || null,
    description: template.description || '',
    referencedRequirementsSetIds: Array.isArray(template.referencedRequirementsSetIds)
      ? [...template.referencedRequirementsSetIds]
      : [],
    lineageId: template.lineageId || null,
    version: template.version ?? 1,
    supersededBy: template.supersededBy || null,
    published: template.published === true,
    createdAt: template.createdDate || null,
    updatedAt: template.createdDate || null,
    status: template.supersededBy ? 'superseded' : 'active',
  }
}

// Phase 14.2 (#169a): Badge Issuance targets the CLAIM, not the PoE.
// Recipient is derived from the target Claim's owner at record-construction
// time. `badgeTemplateLineageId` resolves from the referenced Badge Template
// version. Computed fields are clearly marked with `_computed_` prefix so
// consumers don't mistake them for canonical references.
export function getBadgeIssuanceJsonRecord(issuance, allClaims = [], allBadgeTemplates = []) {
  if (!issuance) return {}
  const issuerDid = issuance.dot?.ownerDid || issuance.issuerDot || null
  const targetClaim = (allClaims || []).find((c) => c.id === issuance.targetClaimId) || null
  const recipientParty = targetClaim?.owner || targetClaim?.ownerParty || null
  const recipientDid = targetClaim?.ownerDot || null
  const template = (allBadgeTemplates || []).find((t) => t.id === issuance.badgeTemplateId) || null
  const badgeTemplateLineageId = template?.lineageId || null
  return {
    id: issuance.id,
    artifactType: 'badgeIssuance',
    artifactUri: issuance.artifactUri || `provenance://badges/issuances/${issuance.id}`,
    issuerDid,
    issuerParty: issuance.issuerParty || null,
    // Computed fields — derived from target Claim / template at record build.
    _computed_recipientDid: recipientDid,
    _computed_recipientParty: recipientParty,
    _computed_badgeTemplateLineageId: badgeTemplateLineageId,
    targetClaimId: issuance.targetClaimId || null,
    badgeTemplateId: issuance.badgeTemplateId || null,
    description: issuance.description || '',
    dot: _dotRecord(issuance.dot, {
      pin: issuance.pin,
      hash: null,
      ownerDid: issuerDid,
      registrationTimestamp: issuance.createdDate,
    }),
    createdAt: issuance.createdDate || null,
    updatedAt: issuance.revokedDate || issuance.createdDate || null,
    status: issuance.status || 'active',
    revokedDate: issuance.revokedDate || null,
    revocationReason: issuance.revocationReason || null,
  }
}

// Convenience dispatcher — returns the right record for any artifact based
// on its `artifactType` field. Also accepts an explicit `kind` override
// (`'asset' | 'claim' | 'evalResult' | 'poe' | 'disclosureAgreement' |
// 'evaluationAgreement' | 'parseResult' | 'badgeTemplate' |
// 'badgeIssuance'`) for callers that already know.
//
// Phase 14.1 (#169 part 2): added optional `context` parameter for cross-
// artifact reference resolution. Phase 14.2: Badge Issuance now uses
// `context.claims` (was `context.poes`) since the target shifted from PoE
// to Claim. Caller shape: `{ claims, badgeTemplates }`.
export function getJsonRecordFor(artifact, kind, context = {}) {
  const k = kind || artifact?.artifactType
  switch (k) {
    case 'asset': return getAssetJsonRecord(artifact)
    case 'claim': return getClaimJsonRecord(artifact)
    case 'parseResult': return getParseResultJsonRecord(artifact)
    case 'evaluationResult':
    case 'evalResult': return getEvalResultJsonRecord(artifact)
    case 'poe': return getPoeJsonRecord(artifact)
    case 'disclosureAgreement': return getDaJsonRecord(artifact)
    case 'evaluationAgreement': return getEaJsonRecord(artifact)
    case 'badgeTemplate': return getBadgeTemplateJsonRecord(artifact)
    case 'badgeIssuance': return getBadgeIssuanceJsonRecord(artifact, context.claims, context.badgeTemplates)
    default: return artifact
  }
}
