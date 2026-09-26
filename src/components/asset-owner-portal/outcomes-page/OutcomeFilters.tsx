import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OUTCOME_CONFIDENCES, OUTCOME_CONFIDENCE_META } from "@/lib/ownerOutcomes";
import { BRANCH_ALL, BRANCH_NONE, OUTCOME_FILTERS, OUTCOME_FILTER_LABEL } from "@/lib/ownerOutcomesOverview";
import type { OwnerPeriodGroup } from "@/lib/ownerPeriods";

/** Kiểu (không phải interface) để gán được vào Record<string, string> của useUrlFilterState. */
export type OutcomeFilterValues = {
  period: string;
  branch: string;
  outcome: string;
  source: string;
  lech: string;
  q: string;
};

interface OutcomeFiltersProps {
  values: OutcomeFilterValues;
  onChange: (patch: Partial<OutcomeFilterValues>) => void;
  periodGroups: OwnerPeriodGroup[];
  branches: { id: string; label: string }[];
}

const TRIGGER = "h-9 w-full sm:w-auto sm:min-w-[10rem]";

/** Bộ lọc L4 của "Kết quả phiên": kỳ · chi nhánh · kết quả · nguồn · chỉ số liệu lệch · tìm. */
export function OutcomeFilters({ values, onChange, periodGroups, branches }: OutcomeFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={values.period} onValueChange={(v) => onChange({ period: v })}>
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

      {branches.length > 0 && (
        <Select value={values.branch} onValueChange={(v) => onChange({ branch: v })}>
          <SelectTrigger className={TRIGGER} aria-label="Chi nhánh">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BRANCH_ALL}>Mọi chi nhánh</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
            <SelectItem value={BRANCH_NONE}>Chưa gắn chi nhánh</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Select value={values.outcome} onValueChange={(v) => onChange({ outcome: v })}>
        <SelectTrigger className={TRIGGER} aria-label="Kết quả">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OUTCOME_FILTERS.map((k) => (
            <SelectItem key={k} value={k}>
              {OUTCOME_FILTER_LABEL[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={values.source} onValueChange={(v) => onChange({ source: v })}>
        <SelectTrigger className={TRIGGER} aria-label="Nguồn số liệu">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Mọi nguồn</SelectItem>
          {OUTCOME_CONFIDENCES.map((c) => (
            <SelectItem key={c} value={c}>
              {OUTCOME_CONFIDENCE_META[c].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex h-9 items-center gap-2 px-1">
        <Switch
          id="oc-conflict-only"
          checked={values.lech === "1"}
          onCheckedChange={(on) => onChange({ lech: on ? "1" : "0" })}
        />
        <Label htmlFor="oc-conflict-only" className="text-sm font-normal">
          Chỉ số liệu lệch
        </Label>
      </div>

      <div className="relative sm:ml-auto sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <Input
          value={values.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Tìm tên hoặc mã tài sản"
          className="h-9 pl-8"
          aria-label="Tìm tài sản"
        />
      </div>
    </div>
  );
}
