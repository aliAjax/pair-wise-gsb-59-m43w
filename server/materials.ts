import type {
  MaterialStatus,
  ProofMaterial,
  ReviewDatabase,
  ScopeConfirmation,
  SupplierResponse,
  VersionMaterialSnapshot,
} from "./types";

export interface MaterialCoverageEntry {
  responseId: string;
  clauseId: string;
  clauseCode: string;
  clauseTitle: string;
  supplierId: string;
  supplierName: string;
  scopeStatus: "confirmed" | "pending";
  needsReReview: boolean;
}

export const activeReviews = (response: SupplierResponse) =>
  response.reviews.filter((review) => !review.invalidatedAt);

export const activeConfirmations = (
  material: ProofMaterial,
): ScopeConfirmation[] =>
  material.confirmations.filter((confirmation) => !confirmation.superseded);

export const materialStatus = (material: ProofMaterial): MaterialStatus => {
  if (activeConfirmations(material).length > 0) {
    return "confirmed";
  }
  return material.confirmations.length > 0 ? "reconfirm" : "pending";
};

export const materialCoverage = (
  database: ReviewDatabase,
  fingerprint: string,
): MaterialCoverageEntry[] =>
  database.responses
    .filter((response) => response.proofFingerprint === fingerprint)
    .map((response) => {
      const clause = database.clauses.find(
        (item) => item.id === response.clauseId,
      );
      return {
        responseId: response.id,
        clauseId: response.clauseId,
        clauseCode: clause?.code ?? response.clauseId,
        clauseTitle: clause?.title ?? "未知条款",
        supplierId: response.supplierId,
        supplierName: response.supplierName,
        scopeStatus: isResponseScopeConfirmed(database, response)
          ? ("confirmed" as const)
          : ("pending" as const),
        needsReReview: responseNeedsReReview(response),
      };
    });

export const findMaterialByFingerprint = (
  database: ReviewDatabase,
  fingerprint: string,
): ProofMaterial | undefined =>
  database.materials.find((material) => material.fingerprint === fingerprint);

export const isResponseScopeConfirmed = (
  database: ReviewDatabase,
  response: SupplierResponse,
): boolean => {
  const material = findMaterialByFingerprint(database, response.proofFingerprint);
  if (!material) {
    return false;
  }
  return activeConfirmations(material).some(
    (confirmation) =>
      confirmation.supplierIds.includes(response.supplierId) &&
      confirmation.clauseIds.includes(response.clauseId),
  );
};

export const responseNeedsReReview = (response: SupplierResponse): boolean => {
  const invalidated = response.reviews.filter((review) => review.invalidatedAt);
  if (invalidated.length === 0) {
    return false;
  }
  const latestInvalidation = Math.max(
    ...invalidated.map((review) => Date.parse(review.invalidatedAt ?? "")),
  );
  return !response.reviews.some(
    (review) =>
      !review.invalidatedAt && Date.parse(review.createdAt) > latestInvalidation,
  );
};

export const confirmedScope = (
  database: ReviewDatabase,
  material: ProofMaterial,
): { supplierNames: string[]; clauseCodes: string[] } => {
  const supplierIds = new Set<string>();
  const clauseIds = new Set<string>();
  activeConfirmations(material).forEach((confirmation) => {
    confirmation.supplierIds.forEach((id) => supplierIds.add(id));
    confirmation.clauseIds.forEach((id) => clauseIds.add(id));
  });
  const supplierNames = database.suppliers
    .filter((supplier) => supplierIds.has(supplier.id))
    .map((supplier) => supplier.name);
  const clauseCodes = database.clauses
    .filter((clause) => clauseIds.has(clause.id))
    .map((clause) => clause.code);
  return { supplierNames, clauseCodes };
};

export const latestFinalizedAt = (
  database: ReviewDatabase,
): string | undefined =>
  database.versions.find((version) => version.status === "finalized")
    ?.createdAt;

export const snapshotMaterials = (
  database: ReviewDatabase,
): VersionMaterialSnapshot[] =>
  database.materials.map((material) => {
    const coverage = materialCoverage(database, material.fingerprint);
    return {
      materialId: material.id,
      fingerprint: material.fingerprint,
      attachmentName: material.attachmentName,
      revision: material.revision,
      supplierNames: Array.from(
        new Set(coverage.map((entry) => entry.supplierName)),
      ),
      clauseCodes: Array.from(
        new Set(coverage.map((entry) => entry.clauseCode)),
      ),
    };
  });

export const buildMaterialsFromResponses = (
  database: Pick<ReviewDatabase, "responses" | "clauses">,
): ProofMaterial[] => {
  const materials: ProofMaterial[] = [];
  database.responses.forEach((response) => {
    if (!response.proofFingerprint) {
      return;
    }
    const existing = materials.find(
      (material) => material.fingerprint === response.proofFingerprint,
    );
    if (existing) {
      if (response.submittedAt < existing.firstSeenAt) {
        existing.firstSeenAt = response.submittedAt;
        existing.attachmentName = response.attachmentName;
      }
      return;
    }
    materials.push({
      id: `MAT-${String(materials.length + 1).padStart(3, "0")}`,
      fingerprint: response.proofFingerprint,
      attachmentName: response.attachmentName,
      revision: 1,
      firstSeenAt: response.submittedAt,
      updatedAt: response.submittedAt,
      history: [
        {
          revision: 1,
          at: response.submittedAt,
          actor: "采购工作组",
          reason: "首次归集",
          detail: `指纹 ${response.proofFingerprint} 首次出现，汇成材料记录。`,
        },
      ],
      confirmations: [],
      conflicts: [],
    });
  });
  return materials;
};
