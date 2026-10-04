import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import {
  createAudit,
  createClarificationId,
  createConflictId,
  createMaterialId,
  createOpinionId,
  reviewDataStore,
} from "./data";
import {
  activeReviews,
  confirmedScope,
  findMaterialByFingerprint,
  isResponseScopeConfirmed,
  latestFinalizedAt,
  materialCoverage,
  materialStatus,
  responseNeedsReReview,
  snapshotMaterials,
} from "./materials";
import { typeDefs } from "./schema";
import type {
  AssessmentInput,
  ClarificationInput,
  ClarificationResponseInput,
  Clause,
  ConfirmScopeInput,
  DashboardStats,
  FinalizeVersionInput,
  ProofMaterial,
  ReviewDatabase,
  ReviewRole,
  ScopeConfirmation,
  SupplierResponse,
  UpdateProofMaterialInput,
} from "./types";

const getDashboard = (database: ReviewDatabase): DashboardStats => {
  const opinionsByResponse = database.responses.map((response) => {
    const decisions = new Set(
      activeReviews(response)
        .filter((review) => review.decision !== "clarification")
        .map((review) => review.decision),
    );
    return decisions.size > 1;
  });
  const proofCounts = database.responses.reduce<Record<string, number>>(
    (counts, response) => {
      if (response.proofFingerprint) {
        counts[response.proofFingerprint] =
          (counts[response.proofFingerprint] ?? 0) + 1;
      }
      return counts;
    },
    {},
  );
  const activeVersion =
    database.versions.find((version) => version.status === "draft") ??
    database.versions[0];

  return {
    totalClauses: database.clauses.length,
    mandatoryCount: database.clauses.filter(
      (clause) => clause.type === "mandatory",
    ).length,
    pendingReviews: database.responses.filter(
      (response) => activeReviews(response).length < 2,
    ).length,
    differences: opinionsByResponse.filter(Boolean).length,
    overdueClarifications: database.responses.reduce(
      (count, response) =>
        count +
        response.clarifications.filter(
          (clarification) => clarification.status === "overdue",
        ).length,
      0,
    ),
    reusedProofs: Object.values(proofCounts).filter((count) => count > 1)
      .length,
    activeVersion: activeVersion
      ? `${activeVersion.version} ${activeVersion.label}`
      : "未建立版本",
    materialCount: database.materials.length,
    pendingScopeConfirmations: database.responses.filter(
      (response) => !isResponseScopeConfirmed(database, response),
    ).length,
    pendingReReview: database.responses.filter(responseNeedsReReview).length,
    materialConflicts: database.materials.reduce(
      (count, material) => count + material.conflicts.length,
      0,
    ),
  };
};

const requireRole = (role: ReviewRole, allowed: ReviewRole[]): void => {
  if (!allowed.includes(role)) {
    throw new Error("当前角色无权执行此操作。");
  }
};

const scopeKey = (confirmation: {
  supplierIds: string[];
  clauseIds: string[];
}): string =>
  `${[...confirmation.supplierIds].sort().join("+")}|${[
    ...confirmation.clauseIds,
  ]
    .sort()
    .join("+")}`;

const resolvers = {
  Query: {
    workspace: () => {
      const database = reviewDataStore.snapshot();
      return {
        ...database,
        dashboard: getDashboard(database),
      };
    },
    dashboard: () => getDashboard(reviewDataStore.snapshot()),
  },
  Clause: {
    responses: (clause: Clause, _args: unknown, context: { database: ReviewDatabase }) =>
      context.database.responses.filter(
        (response) => response.clauseId === clause.id,
      ),
  },
  SupplierResponse: {
    scopeConfirmed: (
      response: SupplierResponse,
      _args: unknown,
      context: { database: ReviewDatabase },
    ) => isResponseScopeConfirmed(context.database, response),
    needsReReview: (response: SupplierResponse) =>
      responseNeedsReReview(response),
  },
  ProofMaterial: {
    status: (material: ProofMaterial) => materialStatus(material),
    coverage: (
      material: ProofMaterial,
      _args: unknown,
      context: { database: ReviewDatabase },
    ) => materialCoverage(context.database, material.fingerprint),
    pendingReReviewCount: (
      material: ProofMaterial,
      _args: unknown,
      context: { database: ReviewDatabase },
    ) =>
      materialCoverage(context.database, material.fingerprint).filter(
        (entry) => entry.needsReReview,
      ).length,
    confirmedSupplierNames: (
      material: ProofMaterial,
      _args: unknown,
      context: { database: ReviewDatabase },
    ) => confirmedScope(context.database, material).supplierNames,
    confirmedClauseCodes: (
      material: ProofMaterial,
      _args: unknown,
      context: { database: ReviewDatabase },
    ) => confirmedScope(context.database, material).clauseCodes,
  },
  ScopeConfirmation: {
    supplierNames: (
      confirmation: ScopeConfirmation,
      _args: unknown,
      context: { database: ReviewDatabase },
    ) =>
      context.database.suppliers
        .filter((supplier) => confirmation.supplierIds.includes(supplier.id))
        .map((supplier) => supplier.name),
    clauseCodes: (
      confirmation: ScopeConfirmation,
      _args: unknown,
      context: { database: ReviewDatabase },
    ) =>
      context.database.clauses
        .filter((clause) => confirmation.clauseIds.includes(clause.id))
        .map((clause) => clause.code),
  },
  Mutation: {
    submitAssessment: (
      _parent: unknown,
      { input }: { input: AssessmentInput },
    ) => {
      requireRole(input.role, ["reviewer_a", "reviewer_b", "chair"]);
      if (input.comment.trim().length < 6) {
        throw new Error("评审意见至少需要 6 个字符。");
      }
      return reviewDataStore.mutate((database) => {
        const response = database.responses.find(
          (item) => item.id === input.responseId,
        );
        if (!response) {
          throw new Error("供应商响应不存在。");
        }
        const clause = database.clauses.find(
          (item) => item.id === response.clauseId,
        );
        if (!clause) {
          throw new Error("对应技术条款不存在。");
        }
        if (!isResponseScopeConfirmed(database, response)) {
          throw new Error(
            "该响应的证明材料尚未确认适用范围，不能进入评审。请先在材料核验台完成确认。",
          );
        }
        if (input.score < 0 || input.score > clause.weight) {
          throw new Error(`评分必须在 0 至 ${clause.weight} 之间。`);
        }
        if (
          clause.type === "scoring" &&
          input.decision === "compliant" &&
          input.score === 0
        ) {
          throw new Error("评分项判定为符合时必须填写评分。");
        }
        const opinion = {
          id: createOpinionId(),
          responseId: response.id,
          reviewer: input.reviewer.trim(),
          role: input.role,
          decision: input.decision,
          score: input.score,
          comment: input.comment.trim(),
          createdAt: new Date().toISOString(),
        };
        response.reviews.push(opinion);
        response.status = input.decision;
        response.reviewRound = Math.max(response.reviewRound, 1);
        createAudit(
          database,
          opinion.reviewer,
          "提交独立意见",
          response.id,
          `${clause.code} ${clause.title} 判定为 ${input.decision}，评分 ${input.score}。`,
        );
        return opinion;
      });
    },
    requestClarification: (
      _parent: unknown,
      { input }: { input: ClarificationInput },
    ) =>
      reviewDataStore.mutate((database) => {
        const response = database.responses.find(
          (item) => item.id === input.responseId,
        );
        if (!response) {
          throw new Error("供应商响应不存在。");
        }
        if (input.requestText.trim().length < 6) {
          throw new Error("澄清要求至少需要 6 个字符。");
        }
        const requestedAt = new Date();
        const dueAt = new Date(input.dueAt);
        if (Number.isNaN(dueAt.getTime()) || dueAt <= requestedAt) {
          throw new Error("澄清截止时间必须晚于当前时间。");
        }
        const maximumDueAt = new Date(requestedAt);
        maximumDueAt.setDate(maximumDueAt.getDate() + 7);
        if (dueAt > maximumDueAt) {
          throw new Error("澄清期限不得超过 7 个自然日。");
        }
        const round =
          Math.max(
            0,
            ...response.clarifications.map((item) => item.round),
          ) + 1;
        const clarification = {
          id: createClarificationId(),
          responseId: response.id,
          clauseId: response.clauseId,
          round,
          requestText: input.requestText.trim(),
          requestedAt: requestedAt.toISOString(),
          dueAt: dueAt.toISOString(),
          status: "open" as const,
        };
        response.clarifications.push(clarification);
        response.status = "clarification";
        createAudit(
          database,
          input.actor,
          "发起澄清",
          clarification.id,
          `${response.supplierName} ${response.clauseId} 第 ${round} 轮澄清已发起。`,
        );
        return clarification;
      }),
    respondClarification: (
      _parent: unknown,
      { input }: { input: ClarificationResponseInput },
    ) =>
      reviewDataStore.mutate((database) => {
        const clarification = database.responses
          .flatMap((response) => response.clarifications)
          .find((item) => item.id === input.clarificationId);
        if (!clarification) {
          throw new Error("澄清记录不存在。");
        }
        if (input.responseText.trim().length < 6) {
          throw new Error("澄清回复至少需要 6 个字符。");
        }
        clarification.supplierResponse = input.responseText.trim();
        clarification.respondedAt = new Date().toISOString();
        clarification.status = "responded";
        const response = database.responses.find(
          (item) => item.id === clarification.responseId,
        );
        if (response) {
          response.status = "pending";
        }
        createAudit(
          database,
          input.actor,
          "回复澄清",
          clarification.id,
          `第 ${clarification.round} 轮澄清已回复，等待评审员复核。`,
        );
        return clarification;
      }),
    finalizeVersion: (
      _parent: unknown,
      { input }: { input: FinalizeVersionInput },
    ) =>
      reviewDataStore.mutate((database) => {
        requireRole(input.role, ["chair"]);
        if (input.label.trim().length < 4) {
          throw new Error("版本名称至少需要 4 个字符。");
        }
        const blockingClarifications = database.responses
          .flatMap((response) => response.clarifications)
          .filter(
            (clarification) =>
              clarification.status === "open" ||
              clarification.status === "overdue",
          );
        if (blockingClarifications.length > 0) {
          throw new Error(
            `仍有 ${blockingClarifications.length} 项未完成澄清，不能定稿。`,
          );
        }
        const maxVersion =
          database.versions.reduce((maximum, version) => {
            const numeric = Number(version.version.replace(/\D/g, ""));
            return Number.isFinite(numeric)
              ? Math.max(maximum, numeric)
              : maximum;
          }, 0) + 1;
        database.versions.forEach((version) => {
          version.status = "finalized";
        });
        const version = {
          id: `VER-${Date.now()}`,
          version: `V${maxVersion}`,
          label: input.label.trim(),
          status: "finalized" as const,
          createdAt: new Date().toISOString(),
          createdBy: input.actor,
          signedBy: [input.actor],
          clauseCount: database.clauses.length,
          responseCount: database.responses.length,
          contentHash: Math.random().toString(16).slice(2, 10),
          materialSnapshots: snapshotMaterials(database),
        };
        database.versions.unshift(version);
        createAudit(
          database,
          input.actor,
          "汇总签字定稿",
          version.id,
          `${version.version} ${version.label} 已锁定，签署人 ${input.actor}，材料快照 ${version.materialSnapshots.length} 份。`,
        );
        return version;
      }),
    confirmMaterialScope: (
      _parent: unknown,
      { input }: { input: ConfirmScopeInput },
    ) => {
      requireRole(input.role, ["procurement", "chair"]);
      const note = input.note.trim();
      if (note.length < 6) {
        throw new Error("确认说明至少需要 6 个字符。");
      }
      if (input.supplierIds.length === 0 || input.clauseIds.length === 0) {
        throw new Error("适用范围至少选择一家供应商和一条条款。");
      }
      return reviewDataStore.mutate((database) => {
        const material = database.materials.find(
          (item) => item.id === input.materialId,
        );
        if (!material) {
          throw new Error("材料记录不存在。");
        }
        const existing = material.confirmations.find(
          (confirmation) => confirmation.id === input.verificationId,
        );
        if (existing) {
          return {
            confirmation: existing,
            conflict: false,
            message: "该核验单已保存，重试不会重复记录。",
            currentRevision: material.revision,
          };
        }
        if (input.baseRevision !== material.revision) {
          const now = new Date().toISOString();
          material.conflicts.unshift({
            id: createConflictId(),
            at: now,
            actor: input.actor,
            source: "并发确认",
            detail: `${input.actor} 基于修订 ${input.baseRevision} 提交确认，材料已变化为修订 ${material.revision}，其填写内容保留待重新提交。`,
          });
          material.updatedAt = now;
          return {
            confirmation: null,
            conflict: true,
            message: `材料已变化：当前修订为 ${material.revision}，你基于修订 ${input.baseRevision} 填写的内容已保留，请核对后重新提交。`,
            currentRevision: material.revision,
          };
        }
        const coverage = materialCoverage(database, material.fingerprint);
        const coverageSupplierIds = new Set(
          coverage.map((entry) => entry.supplierId),
        );
        const coverageClauseIds = new Set(
          coverage.map((entry) => entry.clauseId),
        );
        if (
          input.supplierIds.some((id) => !coverageSupplierIds.has(id)) ||
          input.clauseIds.some((id) => !coverageClauseIds.has(id))
        ) {
          throw new Error("确认范围超出材料实际覆盖的供应商或条款。");
        }
        const now = new Date().toISOString();
        const activeKeys = new Set(
          material.confirmations
            .filter((confirmation) => !confirmation.superseded)
            .map(scopeKey),
        );
        const nextKey = scopeKey(input);
        if (activeKeys.size > 0 && !activeKeys.has(nextKey)) {
          material.conflicts.unshift({
            id: createConflictId(),
            at: now,
            actor: input.actor,
            source: "适用范围分歧",
            detail: `${input.actor} 确认范围（供应商 ${input.supplierIds.length} 家、条款 ${input.clauseIds.length} 条）与既有有效确认不一致，需采购组核对后统一。`,
          });
        }
        const confirmation: ScopeConfirmation = {
          id: input.verificationId,
          materialId: material.id,
          baseRevision: input.baseRevision,
          confirmedBy: input.actor,
          role: input.role,
          note,
          supplierIds: [...input.supplierIds],
          clauseIds: [...input.clauseIds],
          createdAt: now,
          superseded: false,
        };
        material.confirmations.unshift(confirmation);
        material.revision += 1;
        material.updatedAt = now;
        const scope = confirmedScope(database, material);
        material.history.unshift({
          revision: material.revision,
          at: now,
          actor: input.actor,
          reason: "确认适用范围",
          detail: `${input.actor} 确认覆盖 ${scope.supplierNames.join("、")} / ${scope.clauseCodes.join("、")}。`,
        });
        createAudit(
          database,
          input.actor,
          "确认材料适用范围",
          material.id,
          `核验单 ${confirmation.id}：${material.fingerprint} 确认覆盖 ${scope.supplierNames.join("、")} 的 ${scope.clauseCodes.join("、")}。`,
        );
        return {
          confirmation,
          conflict: false,
          message: "适用范围已确认，相关响应可进入评审。",
          currentRevision: material.revision,
        };
      });
    },
    updateProofMaterial: (
      _parent: unknown,
      { input }: { input: UpdateProofMaterialInput },
    ) =>
      reviewDataStore.mutate((database) => {
        requireRole(input.role, ["procurement", "chair"]);
        const response = database.responses.find(
          (item) => item.id === input.responseId,
        );
        if (!response) {
          throw new Error("供应商响应不存在。");
        }
        const attachmentName = input.attachmentName.trim();
        const fingerprint = input.proofFingerprint.trim();
        if (!attachmentName || !fingerprint) {
          throw new Error("附件名称和证明指纹不能为空。");
        }
        if (
          attachmentName === response.attachmentName &&
          fingerprint === response.proofFingerprint
        ) {
          throw new Error("附件与指纹均未变化，无需更新。");
        }
        const now = new Date().toISOString();
        const note = input.note.trim() || "供应商更新附件或指纹。";
        const sameFingerprint = fingerprint === response.proofFingerprint;
        const sealedCutoff = latestFinalizedAt(database);

        let material = findMaterialByFingerprint(database, fingerprint);
        if (!material) {
          material = {
            id: createMaterialId(),
            fingerprint,
            attachmentName,
            revision: 1,
            firstSeenAt: now,
            updatedAt: now,
            history: [
              {
                revision: 1,
                at: now,
                actor: input.actor,
                reason: "首次归集",
                detail: `指纹 ${fingerprint} 首次出现，汇成材料记录。`,
              },
            ],
            confirmations: [],
            conflicts: [],
          };
          database.materials.push(material);
        }

        response.attachmentName = attachmentName;
        response.proofFingerprint = fingerprint;

        const affectedResponses = sameFingerprint
          ? database.responses.filter(
              (item) => item.proofFingerprint === fingerprint,
            )
          : [response];

        let invalidatedCount = 0;
        affectedResponses.forEach((affected) => {
          let invalidatedHere = false;
          affected.reviews.forEach((review) => {
            const sealed =
              sealedCutoff !== undefined &&
              Date.parse(review.createdAt) <= Date.parse(sealedCutoff);
            if (!review.invalidatedAt && !sealed) {
              review.invalidatedAt = now;
              review.invalidReason = `证明材料更新（${input.actor}）：附件或指纹变化，未定稿意见失效。`;
              invalidatedCount += 1;
              invalidatedHere = true;
            }
          });
          if (invalidatedHere) {
            affected.reviewRound += 1;
            if (activeReviews(affected).length === 0) {
              affected.status = "pending";
            }
          }
        });

        if (sameFingerprint) {
          material.attachmentName = attachmentName;
          material.revision += 1;
          material.updatedAt = now;
          material.confirmations.forEach((confirmation) => {
            confirmation.superseded = true;
          });
          material.history.unshift({
            revision: material.revision,
            at: now,
            actor: input.actor,
            reason: "更新附件",
            detail: `${note} 附件更新为 ${attachmentName}，既有确认失效，需重新确认适用范围。`,
          });
        }

        if (invalidatedCount > 0) {
          material.conflicts.unshift({
            id: createConflictId(),
            at: now,
            actor: input.actor,
            source: "材料更新",
            detail: `${response.supplierName} ${response.clauseId} 附件或指纹更新，${invalidatedCount} 条未定稿意见失效，相关响应进入待重评；已定稿版本保留原材料。`,
          });
        }

        createAudit(
          database,
          input.actor,
          "更新证明材料",
          material.id,
          `${response.supplierName} ${response.clauseId} 更新为 ${attachmentName}（指纹 ${fingerprint}），${invalidatedCount} 条未定稿意见失效。`,
        );
        return material;
      }),
    resetReviewData: () => {
      reviewDataStore.reset();
      return true;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

async function startServer(): Promise<void> {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 18462, host: "0.0.0.0" },
    context: async () => ({
      database: reviewDataStore.snapshot(),
    }),
  });
  console.log(`GraphQL mock server ready at ${url}`);
}

void startServer();
