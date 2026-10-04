import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { OWNER_MODULE_DEFINITIONS } from "@/lib/ownerWorkspace/permissions";
import {
  AUDIT_ACTOR_KIND_LABELS,
  AUDIT_KIND_LABELS,
  AUDIT_PERIOD_LABELS,
  auditSeesOthers,
  type AuditFilterState,
  type AuditKind,
  type AuditPeriod,
  type AuditScope,
} from "@/lib/ownerAudit";

interface Props {
  value: AuditFilterState;
  onChange: (next: AuditFilterState) => void;
  scope: AuditScope | undefined;
}

const KINDS: AuditKind[] = ["all", "changes", "sessions", "views", "events"];
const PERIODS: AuditPeriod[] = ["1d", "7d", "30d", "90d", "365d", "all"];
const OTHER_KINDS = ["platform", "partner", "system"] as const;

/** Tab nhóm thao tác + tìm + lọc module / người / chi nhánh / thời gian — bộ điều khiển chung của cổng. */
export function AuditFilters({ value, onChange, scope }: Props) {
  const set = <K extends keyof AuditFilterState>(key: K, v: AuditFilterState[K]) => onChange({ ...value, [key]: v });
  // Chỉ liệt kê module người xem được (server cũng lọc lại).
  const modules = OWNER_MODULE_DEFINITIONS.filter((d) => !scope?.modules || scope.modules.includes(d.module));
  const seesOthers = scope ? auditSeesOthers(scope.level) : false;
  const showBranches = seesOthers && (scope?.branches.length ?? 0) > 0;

  // Năm bộ lọc chiếm hết một hàng ⇒ tab đứng riêng một hàng phía trên (không bị bóp mất chữ).
  return (
    <div className="space-y-3">
      <OwnerTabBar
        aria-label="Nhóm thao tác"
        value={value.kind}
        onValueChange={(k) => set("kind", k)}
        items={KINDS.map((k) => ({ value: k, label: AUDIT_KIND_LABELS[k] }))}
      />
      <OwnerFilterBar>
        <OwnerSearchInput
          aria-label="Tìm trong nhật ký"
          placeholder="Tìm người, mã hồ sơ, tên tài sản…"
          value={value.q}
          onValueChange={(q) => set("q", q)}
        />
        <OwnerFilterSelect label="Module" value={value.module} onValueChange={(v) => set("module", v)}>
          <SelectItem value="all">Tất cả</SelectItem>
          <SelectItem value="_none">Chung (truy cập, gói dịch vụ)</SelectItem>
          <SelectSeparator />
          {modules.map((d) => (
            <SelectItem key={d.module} value={d.module}>
              {d.label}
            </SelectItem>
          ))}
        </OwnerFilterSelect>
        {seesOthers && (
          <OwnerFilterSelect label="Người" value={value.actor} onValueChange={(v) => set("actor", v)}>
            <SelectItem value="all">Tất cả</SelectItem>
            {(scope?.actors.length ?? 0) > 0 && (
              <SelectGroup>
                <SelectLabel>Thành viên</SelectLabel>
                {scope!.actors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            <SelectGroup>
              <SelectLabel>Ngoài đơn vị</SelectLabel>
              {OTHER_KINDS.map((k) => (
                <SelectItem key={k} value={`kind:${k}`}>
                  {AUDIT_ACTOR_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectGroup>
          </OwnerFilterSelect>
        )}
        {showBranches && (
          <OwnerFilterSelect label="Chi nhánh" value={value.branch} onValueChange={(v) => set("branch", v)}>
            <SelectItem value="all">Tất cả</SelectItem>
            {scope!.branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
        )}
        <OwnerFilterSelect
          label="Thời gian"
          value={value.period}
          onValueChange={(v) => set("period", v as AuditPeriod)}
        >
          {PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {AUDIT_PERIOD_LABELS[p]}
            </SelectItem>
          ))}
        </OwnerFilterSelect>
      </OwnerFilterBar>
    </div>
  );
}
