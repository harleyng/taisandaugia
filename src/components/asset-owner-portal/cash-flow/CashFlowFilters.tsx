import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { SCOPE_ALL, type CashUnit } from "@/lib/ownerCashFlow";
import type { OwnerPeriodGroup } from "@/lib/ownerPeriods";

// Bộ lọc trên đầu trang Thu tiền / Dòng tiền — cùng khuôn `OwnerFilterSelect` của Trạm Điều Hành.

/** Phạm vi — chỉ hiện khi có hơn một đơn vị (trụ sở đã liên kết chi nhánh). */
export function CashScopeSelect({
  scope,
  units,
  onChange,
}: {
  scope: string;
  units: CashUnit[];
  onChange: (scope: string) => void;
}) {
  if (units.length < 2) return null;
  return (
    <OwnerFilterSelect label="Đơn vị" value={scope} onValueChange={onChange}>
      <SelectItem value={SCOPE_ALL}>Toàn hệ thống ({units.length} đơn vị)</SelectItem>
      {units.map((u) => (
        <SelectItem key={u.id} value={u.id}>
          {u.isSelf ? `${u.name} · trụ sở` : u.name}
        </SelectItem>
      ))}
    </OwnerFilterSelect>
  );
}

export function CashPeriodSelect({
  period,
  groups,
  onChange,
}: {
  period: string;
  groups: OwnerPeriodGroup[];
  onChange: (period: string) => void;
}) {
  return (
    <OwnerFilterSelect label="Kỳ" value={period} onValueChange={onChange}>
      {groups.map((g) => (
        <SelectGroup key={g.label}>
          <SelectLabel>{g.label}</SelectLabel>
          {g.options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </OwnerFilterSelect>
  );
}
