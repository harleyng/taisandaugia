import { SelectItem } from "@/components/ui/select";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { SCOPE_ALL, TARGET_PERIOD_LABEL, TARGET_PERIOD_TYPES, type TargetPeriodType } from "@/lib/ownerTargets";

interface OverviewFiltersProps {
  scope: string;
  periodType: TargetPeriodType;
  branches: { id: string; label: string }[];
  onChange: (patch: { scope?: string; period?: string }) => void;
}

/** Đơn vị + Kỳ cho cả trang Tổng quan — nằm ở đầu trang, không trong từng khối. */
export function OverviewFilters({ scope, periodType, branches, onChange }: OverviewFiltersProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {branches.length > 0 && (
        <OwnerFilterSelect label="Đơn vị" value={scope} onValueChange={(v) => onChange({ scope: v })}>
          <SelectItem value={SCOPE_ALL}>Toàn đơn vị</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.label}
            </SelectItem>
          ))}
        </OwnerFilterSelect>
      )}

      <OwnerFilterSelect label="Kỳ" value={periodType} onValueChange={(v) => onChange({ period: v })}>
        {TARGET_PERIOD_TYPES.map((t) => (
          <SelectItem key={t} value={t}>
            {TARGET_PERIOD_LABEL[t]}
          </SelectItem>
        ))}
      </OwnerFilterSelect>
    </div>
  );
}
