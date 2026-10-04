import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { TagModule } from "primeng/tag";
import type {
  ClauseType,
  ClarificationStatus,
  ComplianceStatus,
  MaterialStatus,
  VersionStatus,
} from "../core/models/review.models";

type Severity =
  | "success"
  | "secondary"
  | "info"
  | "warn"
  | "danger"
  | "contrast";

const statusConfig: Record<
  ComplianceStatus,
  { label: string; severity: Severity }
> = {
  compliant: { label: "符合", severity: "success" },
  deviation: { label: "偏离", severity: "danger" },
  clarification: { label: "待澄清", severity: "warn" },
  pending: { label: "待评审", severity: "secondary" },
};

const typeConfig: Record<
  ClauseType,
  { label: string; severity: Severity }
> = {
  mandatory: { label: "否决项", severity: "danger" },
  scoring: { label: "评分项", severity: "info" },
  evidence: { label: "证明项", severity: "secondary" },
};

const clarificationConfig: Record<
  ClarificationStatus,
  { label: string; severity: Severity }
> = {
  open: { label: "待回复", severity: "warn" },
  responded: { label: "已回复", severity: "success" },
  overdue: { label: "已逾期", severity: "danger" },
};

const versionConfig: Record<
  VersionStatus,
  { label: string; severity: Severity }
> = {
  draft: { label: "工作版", severity: "warn" },
  finalized: { label: "已定稿", severity: "success" },
};

const materialConfig: Record<
  MaterialStatus,
  { label: string; severity: Severity }
> = {
  pending: { label: "待确认", severity: "warn" },
  confirmed: { label: "已确认", severity: "success" },
  reconfirm: { label: "待重新确认", severity: "danger" },
};

@Component({
  selector: "app-status-tag",
  imports: [TagModule],
  template: `<p-tag [value]="label()" [severity]="severity()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusTagComponent {
  readonly status = input<ComplianceStatus>("pending");

  label(): string {
    return statusConfig[this.status()].label;
  }

  severity(): Severity {
    return statusConfig[this.status()].severity;
  }
}

@Component({
  selector: "app-clause-type-tag",
  imports: [TagModule],
  template: `<p-tag [value]="label()" [severity]="severity()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClauseTypeTagComponent {
  readonly type = input<ClauseType>("mandatory");

  label(): string {
    return typeConfig[this.type()].label;
  }

  severity(): Severity {
    return typeConfig[this.type()].severity;
  }
}

@Component({
  selector: "app-clarification-tag",
  imports: [TagModule],
  template: `<p-tag [value]="label()" [severity]="severity()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClarificationTagComponent {
  readonly status = input<ClarificationStatus>("open");

  label(): string {
    return clarificationConfig[this.status()].label;
  }

  severity(): Severity {
    return clarificationConfig[this.status()].severity;
  }
}

@Component({
  selector: "app-version-tag",
  imports: [TagModule],
  template: `<p-tag [value]="label()" [severity]="severity()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionTagComponent {
  readonly status = input<VersionStatus>("draft");

  label(): string {
    return versionConfig[this.status()].label;
  }

  severity(): Severity {
    return versionConfig[this.status()].severity;
  }
}

@Component({
  selector: "app-material-status-tag",
  imports: [TagModule],
  template: `<p-tag [value]="label()" [severity]="severity()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialStatusTagComponent {
  readonly status = input<MaterialStatus>("pending");

  label(): string {
    return materialConfig[this.status()].label;
  }

  severity(): Severity {
    return materialConfig[this.status()].severity;
  }
}
