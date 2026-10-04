import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { catchError, map, mergeMap, of, switchMap } from "rxjs";
import { ReviewGraphqlService } from "../services/graphql.service";
import { ReviewActions } from "./review.actions";

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return "GraphQL 请求失败，请检查本地 mock server。";
};

@Injectable()
export class ReviewEffects {
  private readonly actions$ = inject(Actions);
  private readonly graphql = inject(ReviewGraphqlService);

  loadReviewData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.loadReviewData),
      switchMap(() =>
        this.graphql.loadWorkspace().pipe(
          map(({ workspace }) =>
            ReviewActions.loadReviewDataSuccess({ workspace }),
          ),
          catchError((error: unknown) =>
            of(
              ReviewActions.loadReviewDataFailure({
                error: errorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  submitAssessment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.submitAssessment),
      switchMap(({ input }) =>
        this.graphql.submitAssessment(input).pipe(
          switchMap(() => this.graphql.loadWorkspace()),
          map(({ workspace }) =>
            ReviewActions.loadReviewDataSuccess({
              workspace,
              toast: "评审意见已提交，其他评审员意见保持不变。",
            }),
          ),
          catchError((error: unknown) =>
            of(
              ReviewActions.loadReviewDataFailure({
                error: errorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  requestClarification$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.requestClarification),
      switchMap(({ input }) =>
        this.graphql.requestClarification(input).pipe(
          switchMap(() => this.graphql.loadWorkspace()),
          map(({ workspace }) =>
            ReviewActions.loadReviewDataSuccess({
              workspace,
              toast: "澄清要求已发出，并写入审计日志。",
            }),
          ),
          catchError((error: unknown) =>
            of(
              ReviewActions.loadReviewDataFailure({
                error: errorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  respondClarification$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.respondClarification),
      switchMap(({ input }) =>
        this.graphql.respondClarification(input).pipe(
          switchMap(() => this.graphql.loadWorkspace()),
          map(({ workspace }) =>
            ReviewActions.loadReviewDataSuccess({
              workspace,
              toast: "澄清回复已登记，等待评审员复核。",
            }),
          ),
          catchError((error: unknown) =>
            of(
              ReviewActions.loadReviewDataFailure({
                error: errorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  finalizeVersion$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.finalizeVersion),
      switchMap(({ input }) =>
        this.graphql.finalizeVersion(input).pipe(
          switchMap(() => this.graphql.loadWorkspace()),
          map(({ workspace }) =>
            ReviewActions.loadReviewDataSuccess({
              workspace,
              toast: "评审版本已汇总签字并锁定。",
            }),
          ),
          catchError((error: unknown) =>
            of(
              ReviewActions.loadReviewDataFailure({
                error: errorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  resetReviewData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.resetReviewData),
      switchMap(() =>
        this.graphql.resetReviewData().pipe(
          switchMap(() => this.graphql.loadWorkspace()),
          map(({ workspace }) =>
            ReviewActions.loadReviewDataSuccess({
              workspace,
              toast: "评审演示数据已恢复。",
            }),
          ),
          catchError((error: unknown) =>
            of(
              ReviewActions.loadReviewDataFailure({
                error: errorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  confirmMaterialScope$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.confirmMaterialScope),
      switchMap(({ input }) =>
        this.graphql.confirmMaterialScope(input).pipe(
          switchMap((payload) => {
            if (payload.conflict) {
              return [
                ReviewActions.confirmMaterialScopeFailure({
                  materialId: input.materialId,
                  error: payload.message,
                  currentRevision: payload.currentRevision,
                }),
                ReviewActions.loadReviewData(),
              ];
            }
            return this.graphql.loadWorkspace().pipe(
              mergeMap(({ workspace }) => [
                ReviewActions.confirmMaterialScopeSuccess({
                  materialId: input.materialId,
                }),
                ReviewActions.loadReviewDataSuccess({
                  workspace,
                  toast: payload.message || "适用范围已确认，相关响应可进入评审。",
                }),
              ]),
            );
          }),
          catchError((error: unknown) =>
            of(
              ReviewActions.confirmMaterialScopeFailure({
                materialId: input.materialId,
                error: errorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  updateProofMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewActions.updateProofMaterial),
      switchMap(({ input }) =>
        this.graphql.updateProofMaterial(input).pipe(
          switchMap(() => this.graphql.loadWorkspace()),
          map(({ workspace }) =>
            ReviewActions.loadReviewDataSuccess({
              workspace,
              toast: "证明材料已更新，未定稿意见失效，相关响应进入待重评。",
            }),
          ),
          catchError((error: unknown) =>
            of(
              ReviewActions.loadReviewDataFailure({
                error: errorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
