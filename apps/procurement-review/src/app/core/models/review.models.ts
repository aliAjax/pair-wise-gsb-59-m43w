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
  scopeConfirmed: boolean;
  needsReReview: boolean;
  reviews: ReviewerOpinion[];
  clarifications: Clarification[];
}

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
  responses: SupplierResponse[];
  children?: ClauseTreeNode[];
}

export interface ClauseTreeNode extends Clause {
  children: ClauseTreeNode[];
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
  supplierNames: string[];
  clauseIds: string[];
  clauseCodes: string[];
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

export interface MaterialCoverage {
  responseId: string;
  clauseId: string;
  clauseCode: string;
  clauseTitle: string;
  supplierId: string;
  supplierName: string;
  scopeStatus: ScopeStatus;
  needsReReview: boolean;
}

export interface ProofMaterial {
  id: string;
  fingerprint: string;
  attachmentName: string;
  revision: number;
  status: MaterialStatus;
  firstSeenAt: string;
  updatedAt: string;
  coverage: MaterialCoverage[];
  confirmations: ScopeConfirmation[];
  conflicts: MaterialConflict[];
  history: MaterialRevision[];
  pendingReReviewCount: number;
  confirmedSupplierNames: string[];
  confirmedClauseCodes: string[];
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

export interface Supplier {
  id: string;
  name: string;
}

export interface ClauseFilters {
  keyword: string;
  category: string;
  type: ClauseType | "all";
  differencesOnly: boolean;
}

export interface MaterialFeedback {
  kind: "confirmed" | "conflict" | "error";
  materialId: string;
  message: string;
  currentRevision?: number;
}

export interface ReviewState {
  clauses: Clause[];
  versions: ReviewVersion[];
  auditLogs: AuditLog[];
  dashboard?: DashboardStats;
  suppliers: Supplier[];
  materials: ProofMaterial[];
  filters: ClauseFilters;
  role: ReviewRole;
  selectedSupplierIds: string[];
  loading: boolean;
  saving: boolean;
  error?: string;
  toast?: string;
  materialFeedback?: MaterialFeedback;
}

export interface WorkspaceQueryResult {
  workspace: {
    clauses: Clause[];
    versions: ReviewVersion[];
    auditLogs: AuditLog[];
    dashboard: DashboardStats;
    suppliers: Supplier[];
    materials: ProofMaterial[];
  };
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

export interface ConfirmScopePayload {
  confirmation: ScopeConfirmation | null;
  conflict: boolean;
  message: string;
  currentRevision?: number;
}

export interface UpdateProofMaterialInput {
  responseId: string;
  attachmentName: string;
  proofFingerprint: string;
  note: string;
  actor: string;
  role: ReviewRole;
}

export const roleProfiles: Record<ReviewRole, { name: string; label: string }> = {
  procurement: { name: "采购专员", label: "采购人员" },
  reviewer_a: { name: "陈评审", label: "技术评审员 A" },
  reviewer_b: { name: "李评审", label: "技术评审员 B" },
  chair: { name: "赵主任", label: "评审组长" },
};

export const complianceLabels: Record<ComplianceStatus, string> = {
  compliant: "符合",
  deviation: "偏离",
  clarification: "待澄清",
  pending: "待评审",
};

export const clauseTypeLabels: Record<ClauseType, string> = {
  mandatory: "否决项",
  scoring: "评分项",
  evidence: "证明项",
};

export const materialStatusLabels: Record<MaterialStatus, string> = {
  pending: "待确认",
  confirmed: "已确认",
  reconfirm: "待重新确认",
};

export const statusSeverity: Record<ComplianceStatus, string> = {
  compliant: "success",
  deviation: "danger",
  clarification: "warn",
  pending: "secondary",
};
