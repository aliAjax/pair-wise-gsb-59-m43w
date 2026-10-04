import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from "primeng/inputtext";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { TextareaModule } from "primeng/textarea";
import {
  roleProfiles,
  type Clarification,
  type Clause,
  type ProofMaterial,
  type SupplierResponse,
} from "../../core/models/review.models";
import { ReviewActions } from "../../core/state/review.actions";
import {
  hasReviewDifference,
  selectClauses,
  selectMaterials,
  selectMaterialSummary,
  selectPendingClarifications,
  selectRole,
  selectVersions,
} from "../../core/state/review.selectors";
import {
  ClarificationTagComponent,
  MaterialStatusTagComponent,
  StatusTagComponent,
  VersionTagComponent,
} from "../../shared/status-tag.component";

interface PendingClarification {
  clause: Clause;
  response: SupplierResponse;
  clarification: Clarification;
}

@Component({
  selector: "app-review-page",
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TableModule,
    TagModule,
    TextareaModule,
    ClarificationTagComponent,
    StatusTagComponent,
    VersionTagComponent,
    MaterialStatusTagComponent,
  ],
  templateUrl: "./review.page.html",
  styleUrl: "./review.page.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPage {
  private readonly store = inject(Store);

  readonly versions = toSignal(this.store.select(selectVersions), {
    initialValue: [],
  });
  readonly clauses = toSignal(this.store.select(selectClauses), {
    initialValue: [],
  });
  readonly role = toSignal(this.store.select(selectRole), {
    initialValue: "reviewer_a",
  });
  readonly pendingClarifications = toSignal(
    this.store.select(selectPendingClarifications),
    { initialValue: [] as PendingClarification[] },
  );
  readonly finalizeVisible = signal(false);
  readonly responseVisible = signal(false);
  readonly selectedClarification = signal<PendingClarification | null>(null);
  readonly canFinalize = computed(() => this.role() === "chair");
  readonly canRespond = computed(() =>
    ["procurement", "chair"].includes(this.role()),
  );
  readonly differences = computed(() =>
    this.clauses().flatMap((clause) =>
      clause.responses
        .filter(hasReviewDifference)
        .map((response) => ({ clause, response })),
    ),
  );
  readonly finalizedCount = computed(
    () => this.versions().filter((version) => version.status === "finalized").length,
  );
  readonly materials = toSignal(this.store.select(selectMaterials), {
    initialValue: [],
  });
  readonly materialSummary = toSignal(this.store.select(selectMaterialSummary), {
    initialValue: {
      materialCount: 0,
      pendingScope: 0,
      pendingReReview: 0,
      conflictCount: 0,
    },
  });

  readonly finalizeForm = new FormGroup({
    label: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4)],
    }),
  });
  readonly responseForm = new FormGroup({
    responseText: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  openFinalize(): void {
    this.finalizeForm.reset({ label: "技术响应符合性评审汇总" });
    this.finalizeVisible.set(true);
  }

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

  finalizeVersion(): void {
    if (!this.canFinalize() || this.finalizeForm.invalid) {
      this.finalizeForm.markAllAsTouched();
      return;
    }
    this.store.dispatch(
      ReviewActions.finalizeVersion({
        input: {
          label: this.finalizeForm.controls.label.value,
          actor: roleProfiles[this.role()].name,
          role: this.role(),
        },
      }),
    );
    this.finalizeVisible.set(false);
  }

  openResponse(item: PendingClarification): void {
    this.selectedClarification.set(item);
    this.responseForm.reset({ responseText: "" });
    this.responseVisible.set(true);
  }

  respondClarification(): void {
    const item = this.selectedClarification();
    if (
      !item ||
      !this.canRespond() ||
      this.responseForm.invalid
    ) {
      this.responseForm.markAllAsTouched();
      return;
    }
    this.store.dispatch(
      ReviewActions.respondClarification({
        input: {
          clarificationId: item.clarification.id,
          responseText: this.responseForm.controls.responseText.value,
          actor: roleProfiles[this.role()].name,
        },
      }),
    );
    this.responseVisible.set(false);
  }
}
