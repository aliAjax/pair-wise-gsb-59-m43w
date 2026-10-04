import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { ReviewActions } from "../../core/state/review.actions";
import {
  selectAuditLogs,
  selectMaterials,
  selectMaterialSummary,
  selectRole,
  selectVersions,
} from "../../core/state/review.selectors";
import {
  materialStatusLabels,
  roleProfiles,
  type ProofMaterial,
} from "../../core/models/review.models";

@Component({
  selector: "app-audit-page",
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TableModule,
  ],
  templateUrl: "./audit.page.html",
  styleUrl: "./audit.page.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage {
  private readonly store = inject(Store);

  readonly roleProfiles = roleProfiles;
  readonly logs = toSignal(this.store.select(selectAuditLogs), {
    initialValue: [],
  });
  readonly versions = toSignal(this.store.select(selectVersions), {
    initialValue: [],
  });
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
  readonly role = toSignal(this.store.select(selectRole), {
    initialValue: "reviewer_a",
  });
  readonly keyword = signal("");
  readonly action = signal("all");
  readonly actionOptions = computed(() => [
    { label: "全部动作", value: "all" },
    ...Array.from(new Set(this.logs().map((log) => log.action))).map(
      (item) => ({ label: item, value: item }),
    ),
  ]);
  readonly filteredLogs = computed(() => {
    const keyword = this.keyword().trim().toLowerCase();
    const action = this.action();
    return this.logs().filter((log) => {
      const matchesAction = action === "all" || log.action === action;
      const matchesKeyword =
        !keyword ||
        [log.actor, log.action, log.entity, log.detail]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return matchesAction && matchesKeyword;
    });
  });
  readonly finalVersion = computed(
    () => this.versions().find((version) => version.status === "finalized"),
  );
  readonly finalizedCount = computed(
    () => this.versions().filter((version) => version.status === "finalized").length,
  );

  exportJson(): void {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: `${this.role()} · ${roleProfiles[this.role()].name}`,
      auditLogs: this.filteredLogs(),
      materials: this.materials().map((material) =>
        this.materialExportRow(material),
      ),
    };
    this.download(
      "procurement-review-audit.json",
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
  }

  exportCsv(): void {
    const header = ["时间", "操作人", "动作", "对象", "详情"];
    const rows = this.filteredLogs().map((log) => [
      log.at,
      log.actor,
      log.action,
      log.entity,
      log.detail,
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    this.download(
      "procurement-review-audit.csv",
      csv,
      "text/csv;charset=utf-8",
    );
  }

  exportMaterialsCsv(): void {
    const header = [
      "材料指纹",
      "附件",
      "修订",
      "状态",
      "覆盖供应商",
      "覆盖条款",
      "已确认供应商",
      "已确认条款",
      "待重评数量",
      "冲突来源",
    ];
    const rows = this.materials().map((material) => {
      const row = this.materialExportRow(material);
      return [
        row.fingerprint,
        row.attachmentName,
        `R${row.revision}`,
        row.statusLabel,
        row.coverageSuppliers,
        row.coverageClauses,
        row.confirmedSuppliers,
        row.confirmedClauses,
        String(row.pendingReReviewCount),
        row.conflictSources,
      ];
    });
    const csv = [header, ...rows]
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    this.download(
      "procurement-review-materials.csv",
      csv,
      "text/csv;charset=utf-8",
    );
  }

  resetReviewData(): void {
    this.store.dispatch(ReviewActions.resetReviewData());
  }

  private materialExportRow(material: ProofMaterial) {
    return {
      fingerprint: material.fingerprint,
      attachmentName: material.attachmentName,
      revision: material.revision,
      statusLabel: materialStatusLabels[material.status],
      coverageSuppliers: Array.from(
        new Set(material.coverage.map((entry) => entry.supplierName)),
      ).join("、"),
      coverageClauses: Array.from(
        new Set(material.coverage.map((entry) => entry.clauseCode)),
      ).join("、"),
      confirmedSuppliers: material.confirmedSupplierNames.join("、"),
      confirmedClauses: material.confirmedClauseCodes.join("、"),
      pendingReReviewCount: material.pendingReReviewCount,
      conflictSources: material.conflicts
        .map((conflict) => `${conflict.source}(${conflict.actor})`)
        .join("；"),
    };
  }

  private download(filename: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
