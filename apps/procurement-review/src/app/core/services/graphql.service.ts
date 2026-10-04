import { Injectable, inject } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { Observable, map } from "rxjs";
import type {
  AssessmentInput,
  Clarification,
  ClarificationInput,
  ClarificationResponseInput,
  ConfirmScopeInput,
  ConfirmScopePayload,
  FinalizeVersionInput,
  ProofMaterial,
  ReviewVersion,
  ReviewerOpinion,
  UpdateProofMaterialInput,
  WorkspaceQueryResult,
} from "../models/review.models";

const WORKSPACE_QUERY = gql`
  query ProcurementReviewWorkspace {
    workspace {
      clauses {
        id
        code
        title
        category
        requirement
        type
        weight
        parentId
        evidenceRequired
        order
        responses {
          id
          clauseId
          supplierId
          supplierName
          status
          responseText
          claimedScore
          attachmentName
          proofFingerprint
          submittedBy
          submittedAt
          reviewRound
          scopeConfirmed
          needsReReview
          reviews {
            id
            responseId
            reviewer
            role
            decision
            score
            comment
            createdAt
            invalidatedAt
            invalidReason
          }
          clarifications {
            id
            responseId
            clauseId
            round
            requestText
            supplierResponse
            requestedAt
            dueAt
            respondedAt
            status
          }
        }
      }
      versions {
        id
        version
        label
        status
        createdAt
        createdBy
        signedBy
        clauseCount
        responseCount
        contentHash
        materialSnapshots {
          materialId
          fingerprint
          attachmentName
          revision
          supplierNames
          clauseCodes
        }
      }
      auditLogs {
        id
        at
        actor
        action
        entity
        detail
      }
      dashboard {
        totalClauses
        mandatoryCount
        pendingReviews
        differences
        overdueClarifications
        reusedProofs
        activeVersion
        materialCount
        pendingScopeConfirmations
        pendingReReview
        materialConflicts
      }
      suppliers {
        id
        name
      }
      materials {
        id
        fingerprint
        attachmentName
        revision
        status
        firstSeenAt
        updatedAt
        coverage {
          responseId
          clauseId
          clauseCode
          clauseTitle
          supplierId
          supplierName
          scopeStatus
          needsReReview
        }
        confirmations {
          id
          materialId
          baseRevision
          confirmedBy
          role
          note
          supplierIds
          supplierNames
          clauseIds
          clauseCodes
          createdAt
          superseded
        }
        conflicts {
          id
          at
          actor
          source
          detail
        }
        history {
          revision
          at
          actor
          reason
          detail
        }
        pendingReReviewCount
        confirmedSupplierNames
        confirmedClauseCodes
      }
    }
  }
`;

const SUBMIT_ASSESSMENT = gql`
  mutation SubmitAssessment($input: AssessmentInput!) {
    submitAssessment(input: $input) {
      id
      responseId
      reviewer
      role
      decision
      score
      comment
      createdAt
    }
  }
`;

const REQUEST_CLARIFICATION = gql`
  mutation RequestClarification($input: ClarificationInput!) {
    requestClarification(input: $input) {
      id
      responseId
      clauseId
      round
      requestText
      supplierResponse
      requestedAt
      dueAt
      respondedAt
      status
    }
  }
`;

const RESPOND_CLARIFICATION = gql`
  mutation RespondClarification($input: ClarificationResponseInput!) {
    respondClarification(input: $input) {
      id
      responseId
      clauseId
      round
      requestText
      supplierResponse
      requestedAt
      dueAt
      respondedAt
      status
    }
  }
`;

const FINALIZE_VERSION = gql`
  mutation FinalizeVersion($input: FinalizeVersionInput!) {
    finalizeVersion(input: $input) {
      id
      version
      label
      status
      createdAt
      createdBy
      signedBy
      clauseCount
      responseCount
      contentHash
      materialSnapshots {
        materialId
        fingerprint
        attachmentName
        revision
        supplierNames
        clauseCodes
      }
    }
  }
`;

const CONFIRM_MATERIAL_SCOPE = gql`
  mutation ConfirmMaterialScope($input: ConfirmScopeInput!) {
    confirmMaterialScope(input: $input) {
      conflict
      message
      currentRevision
      confirmation {
        id
        materialId
        baseRevision
        confirmedBy
        role
        note
        supplierIds
        supplierNames
        clauseIds
        clauseCodes
        createdAt
        superseded
      }
    }
  }
`;

const UPDATE_PROOF_MATERIAL = gql`
  mutation UpdateProofMaterial($input: UpdateProofMaterialInput!) {
    updateProofMaterial(input: $input) {
      id
      fingerprint
      attachmentName
      revision
      status
      updatedAt
    }
  }
`;

const RESET_REVIEW_DATA = gql`
  mutation ResetReviewData {
    resetReviewData
  }
`;

@Injectable({ providedIn: "root" })
export class ReviewGraphqlService {
  private readonly apollo = inject(Apollo);

  loadWorkspace(): Observable<WorkspaceQueryResult> {
    return this.apollo
      .query<WorkspaceQueryResult>({
        query: WORKSPACE_QUERY,
        fetchPolicy: "network-only",
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error("GraphQL 未返回评审工作区。");
          }
          return result.data as WorkspaceQueryResult;
        }),
      );
  }

  submitAssessment(input: AssessmentInput): Observable<ReviewerOpinion> {
    return this.apollo
      .mutate<{ submitAssessment: ReviewerOpinion }>({
        mutation: SUBMIT_ASSESSMENT,
        variables: { input },
        refetchQueries: ["ProcurementReviewWorkspace"],
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error("GraphQL 未返回评审意见。");
          }
          return result.data.submitAssessment;
        }),
      );
  }

  requestClarification(input: ClarificationInput): Observable<Clarification> {
    return this.apollo
      .mutate<{ requestClarification: Clarification }>({
        mutation: REQUEST_CLARIFICATION,
        variables: { input },
        refetchQueries: ["ProcurementReviewWorkspace"],
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error("GraphQL 未返回澄清记录。");
          }
          return result.data.requestClarification;
        }),
      );
  }

  respondClarification(
    input: ClarificationResponseInput,
  ): Observable<Clarification> {
    return this.apollo
      .mutate<{ respondClarification: Clarification }>({
        mutation: RESPOND_CLARIFICATION,
        variables: { input },
        refetchQueries: ["ProcurementReviewWorkspace"],
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error("GraphQL 未返回澄清回复。");
          }
          return result.data.respondClarification;
        }),
      );
  }

  finalizeVersion(input: FinalizeVersionInput): Observable<ReviewVersion> {
    return this.apollo
      .mutate<{ finalizeVersion: ReviewVersion }>({
        mutation: FINALIZE_VERSION,
        variables: { input },
        refetchQueries: ["ProcurementReviewWorkspace"],
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error("GraphQL 未返回版本信息。");
          }
          return result.data.finalizeVersion;
        }),
      );
  }

  confirmMaterialScope(input: ConfirmScopeInput): Observable<ConfirmScopePayload> {
    return this.apollo
      .mutate<{ confirmMaterialScope: ConfirmScopePayload }>({
        mutation: CONFIRM_MATERIAL_SCOPE,
        variables: { input },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error("GraphQL 未返回确认结果。");
          }
          return result.data.confirmMaterialScope;
        }),
      );
  }

  updateProofMaterial(
    input: UpdateProofMaterialInput,
  ): Observable<ProofMaterial> {
    return this.apollo
      .mutate<{ updateProofMaterial: ProofMaterial }>({
        mutation: UPDATE_PROOF_MATERIAL,
        variables: { input },
        refetchQueries: ["ProcurementReviewWorkspace"],
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error("GraphQL 未返回材料记录。");
          }
          return result.data.updateProofMaterial;
        }),
      );
  }

  resetReviewData(): Observable<boolean> {
    return this.apollo
      .mutate<{ resetReviewData: boolean }>({
        mutation: RESET_REVIEW_DATA,
        refetchQueries: ["ProcurementReviewWorkspace"],
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error("GraphQL 未返回重置结果。");
          }
          return result.data.resetReviewData;
        }),
      );
  }
}
