import { createReducer, on } from "@ngrx/store";
import type { ReviewState } from "../models/review.models";
import { ReviewActions } from "./review.actions";

export const initialReviewState: ReviewState = {
  clauses: [],
  versions: [],
  auditLogs: [],
  suppliers: [],
  materials: [],
  filters: {
    keyword: "",
    category: "",
    type: "all",
    differencesOnly: false,
  },
  role: "reviewer_a",
  selectedSupplierIds: ["SUP-A", "SUP-B", "SUP-C"],
  loading: false,
  saving: false,
};

export const reviewReducer = createReducer(
  initialReviewState,
  on(ReviewActions.loadReviewData, (state) => ({
    ...state,
    loading: true,
    error: undefined,
  })),
  on(
    ReviewActions.loadReviewDataSuccess,
    (state, { workspace, toast }) => ({
      ...state,
      ...workspace,
      loading: false,
      saving: false,
      error: undefined,
      toast,
    }),
  ),
  on(ReviewActions.loadReviewDataFailure, (state, { error }) => ({
    ...state,
    loading: false,
    saving: false,
    error,
  })),
  on(ReviewActions.setRole, (state, { role }) => ({
    ...state,
    role,
    toast: undefined,
  })),
  on(ReviewActions.setFilters, (state, { filters }) => ({
    ...state,
    filters: {
      ...state.filters,
      ...filters,
    },
  })),
  on(ReviewActions.toggleSupplier, (state, { supplierId }) => {
    const selected = state.selectedSupplierIds.includes(supplierId);
    const next = selected
      ? state.selectedSupplierIds.filter((id) => id !== supplierId)
      : [...state.selectedSupplierIds, supplierId];
    return {
      ...state,
      selectedSupplierIds: next.length > 0 ? next : state.selectedSupplierIds,
    };
  }),
  on(ReviewActions.clearToast, (state) => ({
    ...state,
    toast: undefined,
    error: undefined,
  })),
  on(ReviewActions.confirmMaterialScope, (state) => ({
    ...state,
    saving: true,
    error: undefined,
    toast: undefined,
    materialFeedback: undefined,
  })),
  on(ReviewActions.confirmMaterialScopeSuccess, (state, { materialId }) => ({
    ...state,
    materialFeedback: {
      kind: "confirmed" as const,
      materialId,
      message: "适用范围已确认，相关响应可进入评审。",
    },
  })),
  on(
    ReviewActions.confirmMaterialScopeFailure,
    (state, { materialId, error, currentRevision }) => ({
      ...state,
      saving: false,
      materialFeedback: {
        kind: (currentRevision !== undefined
          ? "conflict"
          : "error") as "conflict" | "error",
        materialId,
        message: error,
        currentRevision,
      },
    }),
  ),
  on(ReviewActions.clearMaterialFeedback, (state) => ({
    ...state,
    materialFeedback: undefined,
  })),
  on(
    ReviewActions.submitAssessment,
    ReviewActions.requestClarification,
    ReviewActions.respondClarification,
    ReviewActions.finalizeVersion,
    ReviewActions.updateProofMaterial,
    ReviewActions.resetReviewData,
    (state) => ({
      ...state,
      saving: true,
      error: undefined,
      toast: undefined,
    }),
  ),
);
