import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CheckboxModule } from "primeng/checkbox";
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from "primeng/inputtext";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { TextareaModule } from "primeng/textarea";
import {
  roleProfiles,
  type ProofMaterial,
  type SupplierResponse,
} from "../../core/models/review.models";
import { ReviewActions } from "../../core/state/review.actions";
import {
  selectClauses,
  selectMaterialFeedback,
  selectMaterials,
  selectMaterialSummary,
  selectRole,
  selectSaving,
} from "../../core/state/review.selectors";
import { MaterialStatusTagComponent } from "../../shared/status-tag.component";

const createVerificationId = (): string =>
  `VERI-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

@Component({
  selector: "app-materials-page",
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    TextareaModule,
    MaterialStatusTagComponent,
  ],
  templateUrl: "./materials.page.html",
  styleUrl: "./materials.page.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialsPage {
  private readonly store = inject(Store);

  readonly materials = toSignal(this.store.select(selectMaterials), {
    initialValue: [],
  });
  readonly clauses = toSignal(this.store.select(selectClauses), {
    initialValue: [],
  });
  readonly summary = toSignal(this.store.select(selectMaterialSummary), {
    initialValue: {
      materialCount: 0,
      pendingScope: 0,
      pendingReReview: 0,
      conflictCount: 0,
    },
  });
  readonly role = toSignal(this.store.select(selectRole), {
    initialValue: "reviewer_a",
  });
  readonly saving = toSignal(this.store.select(selectSaving), {
    initialValue: false,
  });
  readonly feedback = toSignal(this.store.select(selectMaterialFeedback), {
    initialValue: undefined,
  });

  readonly canVerify = computed(() =>
    ["procurement", "chair"].includes(this.role()),
  );

  readonly confirmVisible = signal(false);
  readonly confirmMaterialId = signal<string | null>(null);
  readonly verificationId = signal("");
  readonly confirmSupplierIds = signal<string[]>([]);
  readonly confirmClauseIds = signal<string[]>([]);
  readonly confirmNote = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6)],
  });
  readonly confirmMaterial = computed(() => {
    const id = this.confirmMaterialId();
    return this.materials().find((material) => material.id === id) ?? null;
  });
  readonly confirmSuppliers = computed(() => {
    const material = this.confirmMaterial();
    if (!material) {
      return [];
    }
    const seen = new Map<string, string>();
    material.coverage.forEach((entry) =>
      seen.set(entry.supplierId, entry.supplierName),
    );
    return Array.from(seen, ([id, name]) => ({ id, name }));
  });
  readonly confirmClauses = computed(() => {
    const material = this.confirmMaterial();
    if (!material) {
      return [];
    }
    const seen = new Map<string, string>();
    material.coverage.forEach((entry) =>
      seen.set(entry.clauseId, `${entry.clauseCode} ${entry.clauseTitle}`),
    );
    return Array.from(seen, ([id, label]) => ({ id, label }));
  });
  readonly confirmFeedback = computed(() => {
    const feedback = this.feedback();
    const material = this.confirmMaterial();
    if (!feedback || !material || feedback.materialId !== material.id) {
      return null;
    }
    return feedback;
  });

  readonly updateVisible = signal(false);
  readonly updateMaterialId = signal<string | null>(null);
  readonly updateResponseId = signal("");
  readonly updateAttachment = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly updateFingerprint = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly updateNote = new FormControl("", { nonNullable: true });
  readonly updateMaterial = computed(() => {
    const id = this.updateMaterialId();
    return this.materials().find((material) => material.id === id) ?? null;
  });
  readonly updateResponseOptions = computed(() =>
    (this.updateMaterial()?.coverage ?? []).map((entry) => ({
      label: `${entry.clauseCode} ${entry.clauseTitle} · ${entry.supplierName}`,
      value: entry.responseId,
    })),
  );

  constructor() {
    effect(() => {
      const feedback = this.confirmFeedback();
      if (
        feedback?.kind === "confirmed" &&
        this.confirmVisible() &&
        !this.saving()
      ) {
        this.confirmVisible.set(false);
        this.store.dispatch(ReviewActions.clearMaterialFeedback());
      }
    });
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

  openConfirm(material: ProofMaterial): void {
    this.store.dispatch(ReviewActions.clearMaterialFeedback());
    this.confirmMaterialId.set(material.id);
    this.verificationId.set(createVerificationId());
    this.confirmSupplierIds.set(
      Array.from(
        new Set(material.coverage.map((entry) => entry.supplierId)),
      ),
    );
    this.confirmClauseIds.set(
      Array.from(new Set(material.coverage.map((entry) => entry.clauseId))),
    );
    this.confirmNote.reset("");
    this.confirmVisible.set(true);
  }

  toggleConfirmSupplier(supplierId: string, checked: boolean): void {
    this.confirmSupplierIds.update((current) =>
      checked
        ? [...current, supplierId]
        : current.filter((id) => id !== supplierId),
    );
  }

  toggleConfirmClause(clauseId: string, checked: boolean): void {
    this.confirmClauseIds.update((current) =>
      checked
        ? [...current, clauseId]
        : current.filter((id) => id !== clauseId),
    );
  }

  submitConfirm(): void {
    const material = this.confirmMaterial();
    if (
      !material ||
      !this.canVerify() ||
      this.confirmNote.invalid ||
      this.confirmSupplierIds().length === 0 ||
      this.confirmClauseIds().length === 0
    ) {
      this.confirmNote.markAsTouched();
      return;
    }
    this.store.dispatch(
      ReviewActions.confirmMaterialScope({
        input: {
          verificationId: this.verificationId(),
          materialId: material.id,
          baseRevision: material.revision,
          supplierIds: this.confirmSupplierIds(),
          clauseIds: this.confirmClauseIds(),
          note: this.confirmNote.value,
          actor: roleProfiles[this.role()].name,
          role: this.role(),
        },
      }),
    );
  }

  openUpdate(material: ProofMaterial): void {
    this.updateMaterialId.set(material.id);
    const firstResponseId = material.coverage[0]?.responseId ?? "";
    this.updateResponseId.set(firstResponseId);
    const response = this.findResponse(firstResponseId);
    this.updateAttachment.reset(
      response?.attachmentName ?? material.attachmentName,
    );
    this.updateFingerprint.reset(
      response?.proofFingerprint ?? material.fingerprint,
    );
    this.updateNote.reset("");
    this.updateVisible.set(true);
  }

  updateResponseChanged(responseId: string): void {
    this.updateResponseId.set(responseId);
    const response = this.findResponse(responseId);
    if (response) {
      this.updateAttachment.reset(response.attachmentName);
      this.updateFingerprint.reset(response.proofFingerprint);
    }
  }

  submitUpdate(): void {
    const responseId = this.updateResponseId();
    if (
      !responseId ||
      !this.canVerify() ||
      this.updateAttachment.invalid ||
      this.updateFingerprint.invalid
    ) {
      this.updateAttachment.markAsTouched();
      this.updateFingerprint.markAsTouched();
      return;
    }
    this.store.dispatch(
      ReviewActions.updateProofMaterial({
        input: {
          responseId,
          attachmentName: this.updateAttachment.value.trim(),
          proofFingerprint: this.updateFingerprint.value.trim(),
          note: this.updateNote.value.trim(),
          actor: roleProfiles[this.role()].name,
          role: this.role(),
        },
      }),
    );
    this.updateVisible.set(false);
  }

  private findResponse(responseId: string): SupplierResponse | undefined {
    for (const clause of this.clauses()) {
      const response = clause.responses.find((item) => item.id === responseId);
      if (response) {
        return response;
      }
    }
    return undefined;
  }
}
