import { parse } from "graphql";

export const typeDefs = parse(`
  enum ClauseType {
    mandatory
    scoring
    evidence
  }

  enum ComplianceStatus {
    compliant
    deviation
    clarification
    pending
  }

  enum ReviewRole {
    procurement
    reviewer_a
    reviewer_b
    chair
  }

  enum ClarificationStatus {
    open
    responded
    overdue
  }

  enum VersionStatus {
    draft
    finalized
  }

  enum MaterialStatus {
    pending
    confirmed
    reconfirm
  }

  enum ScopeStatus {
    confirmed
    pending
  }

  type Clause {
    id: ID!
    code: String!
    title: String!
    category: String!
    requirement: String!
    type: ClauseType!
    weight: Int!
    parentId: String
    evidenceRequired: Boolean!
    order: Int!
    responses: [SupplierResponse!]!
  }

  type ReviewerOpinion {
    id: ID!
    responseId: String!
    reviewer: String!
    role: ReviewRole!
    decision: ComplianceStatus!
    score: Int!
    comment: String!
    createdAt: String!
    invalidatedAt: String
    invalidReason: String
  }

  type Clarification {
    id: ID!
    responseId: String!
    clauseId: String!
    round: Int!
    requestText: String!
    supplierResponse: String
    requestedAt: String!
    dueAt: String!
    respondedAt: String
    status: ClarificationStatus!
  }

  type SupplierResponse {
    id: ID!
    clauseId: String!
    supplierId: String!
    supplierName: String!
    status: ComplianceStatus!
    responseText: String!
    claimedScore: Int!
    attachmentName: String!
    proofFingerprint: String!
    submittedBy: String!
    submittedAt: String!
    reviewRound: Int!
    scopeConfirmed: Boolean!
    needsReReview: Boolean!
    reviews: [ReviewerOpinion!]!
    clarifications: [Clarification!]!
  }

  type MaterialRevision {
    revision: Int!
    at: String!
    actor: String!
    reason: String!
    detail: String!
  }

  type ScopeConfirmation {
    id: ID!
    materialId: String!
    baseRevision: Int!
    confirmedBy: String!
    role: ReviewRole!
    note: String!
    supplierIds: [String!]!
    supplierNames: [String!]!
    clauseIds: [String!]!
    clauseCodes: [String!]!
    createdAt: String!
    superseded: Boolean!
  }

  type MaterialConflict {
    id: ID!
    at: String!
    actor: String!
    source: String!
    detail: String!
  }

  type MaterialCoverage {
    responseId: String!
    clauseId: String!
    clauseCode: String!
    clauseTitle: String!
    supplierId: String!
    supplierName: String!
    scopeStatus: ScopeStatus!
    needsReReview: Boolean!
  }

  type ProofMaterial {
    id: ID!
    fingerprint: String!
    attachmentName: String!
    revision: Int!
    status: MaterialStatus!
    firstSeenAt: String!
    updatedAt: String!
    coverage: [MaterialCoverage!]!
    confirmations: [ScopeConfirmation!]!
    conflicts: [MaterialConflict!]!
    history: [MaterialRevision!]!
    pendingReReviewCount: Int!
    confirmedSupplierNames: [String!]!
    confirmedClauseCodes: [String!]!
  }

  type VersionMaterialSnapshot {
    materialId: String!
    fingerprint: String!
    attachmentName: String!
    revision: Int!
    supplierNames: [String!]!
    clauseCodes: [String!]!
  }

  type ReviewVersion {
    id: ID!
    version: String!
    label: String!
    status: VersionStatus!
    createdAt: String!
    createdBy: String!
    signedBy: [String!]!
    clauseCount: Int!
    responseCount: Int!
    contentHash: String!
    materialSnapshots: [VersionMaterialSnapshot!]!
  }

  type AuditLog {
    id: ID!
    at: String!
    actor: String!
    action: String!
    entity: String!
    detail: String!
  }

  type DashboardStats {
    totalClauses: Int!
    mandatoryCount: Int!
    pendingReviews: Int!
    differences: Int!
    overdueClarifications: Int!
    reusedProofs: Int!
    activeVersion: String!
    materialCount: Int!
    pendingScopeConfirmations: Int!
    pendingReReview: Int!
    materialConflicts: Int!
  }

  type Supplier {
    id: ID!
    name: String!
  }

  type WorkspaceData {
    clauses: [Clause!]!
    versions: [ReviewVersion!]!
    auditLogs: [AuditLog!]!
    dashboard: DashboardStats!
    suppliers: [Supplier!]!
    materials: [ProofMaterial!]!
  }

  input AssessmentInput {
    responseId: ID!
    decision: ComplianceStatus!
    score: Int!
    comment: String!
    reviewer: String!
    role: ReviewRole!
  }

  input ClarificationInput {
    responseId: ID!
    requestText: String!
    dueAt: String!
    actor: String!
  }

  input ClarificationResponseInput {
    clarificationId: ID!
    responseText: String!
    actor: String!
  }

  input FinalizeVersionInput {
    label: String!
    actor: String!
    role: ReviewRole!
  }

  input ConfirmScopeInput {
    verificationId: ID!
    materialId: ID!
    baseRevision: Int!
    supplierIds: [String!]!
    clauseIds: [String!]!
    note: String!
    actor: String!
    role: ReviewRole!
  }

  input UpdateProofMaterialInput {
    responseId: ID!
    attachmentName: String!
    proofFingerprint: String!
    note: String!
    actor: String!
    role: ReviewRole!
  }

  type ConfirmScopePayload {
    confirmation: ScopeConfirmation
    conflict: Boolean!
    message: String!
    currentRevision: Int
  }

  type Query {
    workspace: WorkspaceData!
    dashboard: DashboardStats!
  }

  type Mutation {
    submitAssessment(input: AssessmentInput!): ReviewerOpinion!
    requestClarification(input: ClarificationInput!): Clarification!
    respondClarification(input: ClarificationResponseInput!): Clarification!
    finalizeVersion(input: FinalizeVersionInput!): ReviewVersion!
    confirmMaterialScope(input: ConfirmScopeInput!): ConfirmScopePayload!
    updateProofMaterial(input: UpdateProofMaterialInput!): ProofMaterial!
    resetReviewData: Boolean!
  }
`);
