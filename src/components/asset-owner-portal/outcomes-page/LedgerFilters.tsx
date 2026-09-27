import { SelectItem } from "@/components/ui/select";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { BRANCH_ALL } from "@/lib/ownerOutcomesOverview";
import { RECENT_PERIODS, ownerPeriodLabel } from "@/lib/ownerPeriods";

/** Kiểu (không phải interface) để gán được vào Record<string, string> của useUrlFilterState. */
export type LedgerFilterValues = {
  tab: string;
  period: string;
  branch: string;
  q: string;
};

interface LedgerFiltersProps {
  values: LedgerFilterValues;
  onChange: (patch: Partial<LedgerFilterValues>) => void;
  branches: { id: string; label: string }[];
}

/** Bộ lọc của sổ: tìm · thời gian · chi nhánh (chỉ hiện khi đơn vị có chi nhánh). */
export function LedgerFilters({ values, onChange, branches }: LedgerFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <OwnerSearchInput
        value={values.q}
        onValueChange={(q) => onChange({ q })}
        placeholder="Tìm tên hoặc mã tài sản"
        aria-label="Tìm tài sản"
        className="min-w-[180px] flex-1"
      />
      <OwnerFilterSelect label="Thời gian" value={values.period} onValueChange={(v) => onChange({ period: v })}>
        {RECENT_PERIODS.map((id) => (
          <SelectItem key={id} value={id}>
            {ownerPeriodLabel(id)}
          </SelectItem>
        ))}
      </OwnerFilterSelect>
      {branches.length > 0 && (
        <OwnerFilterSelect label="Chi nhánh" value={values.branch} onValueChange={(v) => onChange({ branch: v })}>
          <SelectItem value={BRANCH_ALL}>Mọi chi nhánh</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.label}
            </SelectItem>
          ))}
        </OwnerFilterSelect>
      )}
    </div>
  );
}
