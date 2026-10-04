export type ClauseType = "mandatory" | "scoring" | "evidence";
export type ComplianceStatus =
  | "compliant"
  | "deviation"
  | "clarification"
  | "pending";
export type ReviewRole =
  | "procurement"
  | "reviewer_a"
  | "reviewer_b"
  | "chair";
export type ClarificationStatus = "open" | "responded" | "overdue";
export type VersionStatus = "draft" | "finalized";
export type MaterialStatus = "pending" | "confirmed" | "reconfirm";
export type ScopeStatus = "confirmed" | "pending";

export interface Clause {
  id: string;
  code: string;
  title: string;
  category: string;
  requirement: string;
  type: ClauseType;
  weight: number;
  parentId?: string;
  evidenceRequired: boolean;
  order: number;
}

export interface ReviewerOpinion {
  id: string;
  responseId: string;
  reviewer: string;
  role: ReviewRole;
  decision: ComplianceStatus;
  score: number;
  comment: string;
  createdAt: string;
  invalidatedAt?: string;
  invalidReason?: string;
}

export interface Clarification {
  id: string;
  responseId: string;
  clauseId: string;
  round: number;
  requestText: string;
  supplierResponse?: string;
  requestedAt: string;
  dueAt: string;
  respondedAt?: string;
  status: ClarificationStatus;
}

export interface SupplierResponse {
  id: string;
  clauseId: string;
  supplierId: string;
  supplierName: string;
  status: ComplianceStatus;
  responseText: string;
  claimedScore: number;
  attachmentName: string;
  proofFingerprint: string;
  submittedBy: string;
  submittedAt: string;
  reviewRound: number;
  reviews: ReviewerOpinion[];
  clarifications: Clarification[];
}

export interface MaterialRevision {
  revision: number;
  at: string;
  actor: string;
  reason: string;
  detail: string;
}

export interface ScopeConfirmation {
  id: string;
  materialId: string;
  baseRevision: number;
  confirmedBy: string;
  role: ReviewRole;
  note: string;
  supplierIds: string[];
  clauseIds: string[];
  createdAt: string;
  superseded: boolean;
}

export interface MaterialConflict {
  id: string;
  at: string;
  actor: string;
  source: string;
  detail: string;
}

export interface ProofMaterial {
  id: string;
  fingerprint: string;
  attachmentName: string;
  revision: number;
  firstSeenAt: string;
  updatedAt: string;
  history: MaterialRevision[];
  confirmations: ScopeConfirmation[];
  conflicts: MaterialConflict[];
}

export interface VersionMaterialSnapshot {
  materialId: string;
  fingerprint: string;
  attachmentName: string;
  revision: number;
  supplierNames: string[];
  clauseCodes: string[];
}

export interface ReviewVersion {
  id: string;
  version: string;
  label: string;
  status: VersionStatus;
  createdAt: string;
  createdBy: string;
  signedBy: string[];
  clauseCount: number;
  responseCount: number;
  contentHash: string;
  materialSnapshots: VersionMaterialSnapshot[];
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  detail: string;
}

export interface DashboardStats {
  totalClauses: number;
  mandatoryCount: number;
  pendingReviews: number;
  differences: number;
  overdueClarifications: number;
  reusedProofs: number;
  activeVersion: string;
  materialCount: number;
  pendingScopeConfirmations: number;
  pendingReReview: number;
  materialConflicts: number;
}

export interface ReviewDatabase {
  clauses: Clause[];
  responses: SupplierResponse[];
  versions: ReviewVersion[];
  auditLogs: AuditLog[];
  suppliers: Array<{ id: string; name: string }>;
  materials: ProofMaterial[];
}

export interface AssessmentInput {
  responseId: string;
  decision: ComplianceStatus;
  score: number;
  comment: string;
  reviewer: string;
  role: ReviewRole;
}

export interface ClarificationInput {
  responseId: string;
  requestText: string;
  dueAt: string;
  actor: string;
}

export interface ClarificationResponseInput {
  clarificationId: string;
  responseText: string;
  actor: string;
}

export interface FinalizeVersionInput {
  label: string;
  actor: string;
  role: ReviewRole;
}

export interface ConfirmScopeInput {
  verificationId: string;
  materialId: string;
  baseRevision: number;
  supplierIds: string[];
  clauseIds: string[];
  note: string;
  actor: string;
  role: ReviewRole;
}

export interface UpdateProofMaterialInput {
  responseId: string;
  attachmentName: string;
  proofFingerprint: string;
  note: string;
  actor: string;
  role: ReviewRole;
}
