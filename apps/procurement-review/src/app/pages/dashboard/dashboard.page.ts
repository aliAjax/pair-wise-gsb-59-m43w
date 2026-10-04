import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { DatePipe } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { ProgressBarModule } from "primeng/progressbar";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import {
  type Clause,
  type Clarification,
  type ProofMaterial,
  type SupplierResponse,
} from "../../core/models/review.models";
import {
  hasReviewDifference,
  selectAuditLogs,
  selectClauses,
  selectDashboard,
  selectError,
  selectLoading,
  selectMaterials,
  selectPendingClarifications,
  selectRole,
  selectVersions,
} from "../../core/state/review.selectors";
import {
  ClarificationTagComponent,
  MaterialStatusTagComponent,
  StatusTagComponent,
} from "../../shared/status-tag.component";

interface PendingIssue {
  clause: Clause;
  response: SupplierResponse;
  clarification: Clarification;
}

@Component({
  selector: "app-dashboard-page",
  imports: [
    RouterLink,
    DatePipe,
    ButtonModule,
    ProgressBarModule,
    TableModule,
    TagModule,
    StatusTagComponent,
    ClarificationTagComponent,
    MaterialStatusTagComponent,
  ],
  templateUrl: "./dashboard.page.html",
  styleUrl: "./dashboard.page.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly store = inject(Store);

  readonly dashboard = toSignal(this.store.select(selectDashboard), {
    initialValue: undefined,
  });
  readonly clauses = toSignal(this.store.select(selectClauses), {
    initialValue: [],
  });
  readonly versions = toSignal(this.store.select(selectVersions), {
    initialValue: [],
  });
  readonly auditLogs = toSignal(this.store.select(selectAuditLogs), {
    initialValue: [],
  });
  readonly role = toSignal(this.store.select(selectRole), {
    initialValue: "reviewer_a",
  });
  readonly loading = toSignal(this.store.select(selectLoading), {
    initialValue: true,
  });
  readonly error = toSignal(this.store.select(selectError), {
    initialValue: undefined,
  });
  readonly pendingClarifications = toSignal(
    this.store.select(selectPendingClarifications),
    { initialValue: [] as PendingIssue[] },
  );
  readonly materials = toSignal(this.store.select(selectMaterials), {
    initialValue: [],
  });
  readonly materialAttention = computed(() =>
    this.materials()
      .filter(
        (material) =>
          material.status !== "confirmed" ||
          material.pendingReReviewCount > 0 ||
          material.conflicts.length > 0,
      )
      .slice(0, 8),
  );
  readonly differences = computed(() =>
    this.clauses().flatMap((clause) =>
      clause.responses
        .filter(hasReviewDifference)
        .map((response) => ({ clause, response })),
    ),
  );
  readonly mandatoryGaps = computed(() =>
    this.clauses()
      .filter((clause) => clause.type === "mandatory")
      .flatMap((clause) =>
        clause.responses
          .filter(
            (response) =>
              response.status === "pending" ||
              response.status === "clarification",
          )
          .map((response) => ({ clause, response })),
      ),
  );
  readonly completion = computed(() => {
    const clauses = this.clauses();
    if (clauses.length === 0) {
      return 0;
    }
    const reviewed = clauses.filter((clause) =>
      clause.responses.every((response) =>
        response.reviews.some((review) => !review.invalidatedAt),
      ),
    ).length;
    return Math.round((reviewed / clauses.length) * 100);
  });

  coverageSuppliers(material: ProofMaterial): string {
    return Array.from(
      new Set(material.coverage.map((entry) => entry.supplierName)),
    ).join("、");
  }

  coverageClauses(material: ProofMaterial): string {
    return Array.from(
      new Set(material.coverage.map((entry) => entry.clauseCode)),
    ).join("、");
  }
}
