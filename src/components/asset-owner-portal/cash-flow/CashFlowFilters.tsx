import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCOPE_ALL, type CashUnit } from "@/lib/ownerCashFlow";
import type { OwnerPeriodGroup } from "@/lib/ownerPeriods";

interface CashFlowFiltersProps {
  period: string;
  scope: string;
  periodGroups: OwnerPeriodGroup[];
  units: CashUnit[];
  onChange: (patch: { period?: string; scope?: string }) => void;
}

const TRIGGER = "h-9 w-full sm:w-auto sm:min-w-[11rem]";

/**
 * Kỳ + phạm vi. Phạm vi chỉ hiện khi có hơn một đơn vị (trụ sở đã liên kết chi nhánh).
 * Radix Select bắn onValueChange("") khi danh sách lựa chọn đổi ⇒ bỏ qua giá trị rỗng.
 */
export function CashFlowFilters({ period, scope, periodGroups, units, onChange }: CashFlowFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select value={period} onValueChange={(v) => v && onChange({ period: v })}>
        <SelectTrigger className={TRIGGER} aria-label="Kỳ">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periodGroups.map((g) => (
            <SelectGroup key={g.label}>
              <SelectLabel>{g.label}</SelectLabel>
              {g.options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {units.length > 1 && (
        <Select value={scope} onValueChange={(v) => v && onChange({ scope: v })}>
          <SelectTrigger className={TRIGGER} aria-label="Phạm vi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SCOPE_ALL}>Toàn hệ thống ({units.length} đơn vị)</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.isSelf ? `${u.name} · trụ sở` : u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
