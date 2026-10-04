import { createActionGroup, emptyProps, props } from "@ngrx/store";
import type {
  AssessmentInput,
  ClauseFilters,
  ClarificationInput,
  ClarificationResponseInput,
  ConfirmScopeInput,
  FinalizeVersionInput,
  ReviewRole,
  ReviewState,
  UpdateProofMaterialInput,
} from "../models/review.models";

export const ReviewActions = createActionGroup({
  source: "Procurement Review",
  events: {
    "Load Review Data": emptyProps(),
    "Load Review Data Success": props<{
      workspace: Pick<
        ReviewState,
        | "clauses"
        | "versions"
        | "auditLogs"
        | "dashboard"
        | "suppliers"
        | "materials"
      >;
      toast?: string;
    }>(),
    "Load Review Data Failure": props<{ error: string }>(),
    "Set Role": props<{ role: ReviewRole }>(),
    "Set Filters": props<{ filters: Partial<ClauseFilters> }>(),
    "Toggle Supplier": props<{ supplierId: string }>(),
    "Clear Toast": emptyProps(),
    "Submit Assessment": props<{ input: AssessmentInput }>(),
    "Request Clarification": props<{ input: ClarificationInput }>(),
    "Respond Clarification": props<{ input: ClarificationResponseInput }>(),
    "Finalize Version": props<{ input: FinalizeVersionInput }>(),
    "Confirm Material Scope": props<{ input: ConfirmScopeInput }>(),
    "Confirm Material Scope Success": props<{ materialId: string }>(),
    "Confirm Material Scope Failure": props<{
      materialId: string;
      error: string;
      currentRevision?: number;
    }>(),
    "Update Proof Material": props<{ input: UpdateProofMaterialInput }>(),
    "Clear Material Feedback": emptyProps(),
    "Reset Review Data": emptyProps(),
  },
});
