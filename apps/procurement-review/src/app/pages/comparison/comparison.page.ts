import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CheckboxModule } from "primeng/checkbox";
import { MultiSelectModule } from "primeng/multiselect";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { InputTextModule } from "primeng/inputtext";
import {
  clauseTypeLabels,
  type Clause,
  type ClauseType,
  type ProofMaterial,
  type SupplierResponse,
} from "../../core/models/review.models";
import { ReviewActions } from "../../core/state/review.actions";
import {
  findMaterialByFingerprint,
  hasReviewDifference,
  selectClauses,
  selectFilteredClauses,
  selectFilters,
  selectMaterials,
  selectSelectedSupplierIds,
  selectSuppliers,
} from "../../core/state/review.selectors";
import {
  ClauseTypeTagComponent,
  StatusTagComponent,
} from "../../shared/status-tag.component";

@Component({
  selector: "app-comparison-page",
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TableModule,
    TagModule,
    StatusTagComponent,
    ClauseTypeTagComponent,
  ],
  templateUrl: "./comparison.page.html",
  styleUrl: "./comparison.page.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonPage {
  private readonly store = inject(Store);

  readonly clauses = toSignal(this.store.select(selectClauses), {
    initialValue: [],
  });
  readonly filteredClauses = toSignal(
    this.store.select(selectFilteredClauses),
    { initialValue: [] },
  );
  readonly filters = toSignal(this.store.select(selectFilters), {
    initialValue: {
      keyword: "",
      category: "",
      type: "all" as ClauseType | "all",
      differencesOnly: false,
    },
  });
  readonly suppliers = toSignal(this.store.select(selectSuppliers), {
    initialValue: [],
  });
  readonly materials = toSignal(this.store.select(selectMaterials), {
    initialValue: [],
  });
  readonly selectedSupplierIds = toSignal(
    this.store.select(selectSelectedSupplierIds),
    { initialValue: [] },
  );
  readonly visibleSuppliers = computed(() =>
    this.suppliers().filter((supplier) =>
      this.selectedSupplierIds().includes(supplier.id),
    ),
  );
  readonly categoryOptions = computed(() => [
    { label: "全部类别", value: "" },
    ...Array.from(new Set(this.clauses().map((clause) => clause.category))).map(
      (category) => ({ label: category, value: category }),
    ),
  ]);
  readonly typeOptions = [
    { value: "all" as const, label: "全部类型" },
    ...(
      Object.entries(clauseTypeLabels) as Array<[ClauseType, string]>
    ).map(([value, label]) => ({ value, label })),
  ];
  readonly proofCounts = computed(() => {
    const counts = new Map<string, number>();
    this.clauses().forEach((clause) =>
      clause.responses.forEach((response) => {
        counts.set(
          response.proofFingerprint,
          (counts.get(response.proofFingerprint) ?? 0) + 1,
        );
      }),
    );
    return counts;
  });
  readonly differenceCount = computed(
    () =>
      this.clauses().flatMap((clause) => clause.responses).filter(
        hasReviewDifference,
      ).length,
  );
  readonly reusedProofCount = computed(
    () =>
      Array.from(this.proofCounts().values()).filter((count) => count > 1)
        .length,
  );
  readonly unconfirmedScopeCount = computed(
    () =>
      this.clauses()
        .flatMap((clause) => clause.responses)
        .filter((response) => !response.scopeConfirmed).length,
  );
  readonly pendingReReviewCount = computed(
    () =>
      this.clauses()
        .flatMap((clause) => clause.responses)
        .filter((response) => response.needsReReview).length,
  );
  readonly materialConflictCount = computed(
    () =>
      this.materials().reduce(
        (count, material) => count + material.conflicts.length,
        0,
      ),
  );

  updateFilter(partial: {
    keyword?: string;
    category?: string;
    type?: ClauseType | "all";
    differencesOnly?: boolean;
  }): void {
    this.store.dispatch(ReviewActions.setFilters({ filters: partial }));
  }

  supplierSelectionChanged(ids: string[]): void {
    this.suppliers().forEach((supplier) => {
      const selected = this.selectedSupplierIds().includes(supplier.id);
      if (selected !== ids.includes(supplier.id)) {
        this.store.dispatch(
          ReviewActions.toggleSupplier({ supplierId: supplier.id }),
        );
      }
    });
  }

  responseFor(
    clause: Clause,
    supplierId: string,
  ): SupplierResponse | undefined {
    return clause.responses.find((response) => response.supplierId === supplierId);
  }

  hasDifference(response: SupplierResponse | undefined): boolean {
    return response ? hasReviewDifference(response) : false;
  }

  isReusedProof(response: SupplierResponse | undefined): boolean {
    return response
      ? (this.proofCounts().get(response.proofFingerprint) ?? 0) > 1
      : false;
  }

  hasReusedProof(clause: Clause): boolean {
    return clause.responses.some((response) => this.isReusedProof(response));
  }

  materialFor(response: SupplierResponse | undefined): ProofMaterial | undefined {
    return response
      ? findMaterialByFingerprint(this.materials(), response.proofFingerprint)
      : undefined;
  }

  conflictSource(response: SupplierResponse | undefined): string | undefined {
    const material = this.materialFor(response);
    if (!material || material.conflicts.length === 0) {
      return undefined;
    }
    const latest = material.conflicts[0];
    return `${latest.source}（${latest.actor}）`;
  }

  hasScopeGap(clause: Clause): boolean {
    return clause.responses.some((response) => !response.scopeConfirmed);
  }

  hasReReview(clause: Clause): boolean {
    return clause.responses.some((response) => response.needsReReview);
  }

  hasMaterialConflict(clause: Clause): boolean {
    return clause.responses.some(
      (response) => this.conflictSource(response) !== undefined,
    );
  }
}
