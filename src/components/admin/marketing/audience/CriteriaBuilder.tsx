import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  KYC_STATUS_LABELS,
  KYC_STATUS_ORDER,
  PROVINCE_OPTIONS,
} from "@/lib/marketing/audienceCriteria";
import {
  MultiSelectField,
  type MultiSelectOption,
} from "./MultiSelectField";
import type { AccountType, AudienceCriteria, KycStatusValue } from "@/types/marketing";

interface Props {
  criteria: AudienceCriteria;
  onChange: (c: AudienceCriteria) => void;
}

type FieldKey = "registration" | "accountTypes" | "kycStatuses" | "credit" | "provinces";

const ACCOUNT_OPTIONS: MultiSelectOption[] = ACCOUNT_TYPE_ORDER.map((t) => ({
  value: t,
  label: ACCOUNT_TYPE_LABELS[t],
}));
const KYC_OPTIONS: MultiSelectOption[] = KYC_STATUS_ORDER.map((s) => ({
  value: s,
  label: KYC_STATUS_LABELS[s],
}));
/** Giá trị đại diện cho "chưa xác định tỉnh/thành" trong danh sách chọn tỉnh. */
const NULL_PROVINCE = "__null__";
const PROVINCE_MULTI_OPTIONS: MultiSelectOption[] = [
  { value: NULL_PROVINCE, label: "Chưa xác định" },
  ...PROVINCE_OPTIONS.map((p) => ({ value: p, label: p })),
];

/** Mỗi trường được tính là "đang lọc" khi giá trị của nó khác rỗng (khớp criteriaHasFilter). */
const fieldFilled = (c: AudienceCriteria): Record<FieldKey, boolean> => ({
  registration: !!c.registration,
  accountTypes: c.accountTypes.length > 0,
  kycStatuses: c.kycStatuses.length > 0,
  credit: !!c.credit && (c.credit.min != null || c.credit.max != null),
  provinces: c.provinces.length > 0 || c.includeNullProvince,
});

/** Khi bỏ chọn 1 trường, xoá sạch giá trị criteria tương ứng. */
const CLEARED: Record<FieldKey, Partial<AudienceCriteria>> = {
  registration: { registration: null },
  accountTypes: { accountTypes: [] },
  kycStatuses: { kycStatuses: [] },
  credit: { credit: null },
  provinces: { provinces: [], includeNullProvince: false },
};

/** Một hàng lọc: checkbox + nhãn bên trái, control luôn hiển thị bên phải (không co giật). */
function GatedField({
  id,
  checked,
  onCheckedChange,
  label,
  children,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,176px)_minmax(0,1fr)] sm:items-center sm:gap-4">
      <label htmlFor={id} className="flex cursor-pointer select-none items-center gap-2.5 sm:h-10">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
        />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </label>
      {checked && <div>{children}</div>}
    </div>
  );
}

export function CriteriaBuilder({ criteria, onChange }: Props) {
  const [dateOpen, setDateOpen] = useState(false);
  // Trạng thái bật/tắt của từng trường — khởi tạo 1 lần từ criteria (chế độ sửa),
  // sau đó do UI sở hữu để giữ được trạng thái tick khi control còn rỗng.
  const [enabled, setEnabled] = useState<Record<FieldKey, boolean>>(() =>
    fieldFilled(criteria),
  );

  const patch = (p: Partial<AudienceCriteria>) => onChange({ ...criteria, ...p });

  const setGate = (key: FieldKey, on: boolean) => {
    setEnabled((prev) => ({ ...prev, [key]: on }));
    if (!on) patch(CLEARED[key]);
  };

  const range: DateRange = {
    from: criteria.registration?.from ? new Date(criteria.registration.from) : undefined,
    to: criteria.registration?.to ? new Date(criteria.registration.to) : undefined,
  };
  const onRange = (r: DateRange | undefined) => {
    if (!r?.from && !r?.to) {
      patch({ registration: null });
      return;
    }
    patch({
      registration: {
        from: r?.from ? format(r.from, "yyyy-MM-dd") : "",
        to: r?.to ? format(r.to, "yyyy-MM-dd") : "",
      },
    });
    if (r?.from && r?.to) setDateOpen(false);
  };

  const setCredit = (key: "min" | "max", v: string) => {
    const num = v === "" ? null : Number(v);
    const base = criteria.credit ?? { min: null, max: null };
    const next = { ...base, [key]: num };
    patch({ credit: next.min == null && next.max == null ? null : next });
  };

  const provinceSelected = [
    ...criteria.provinces,
    ...(criteria.includeNullProvince ? [NULL_PROVINCE] : []),
  ];
  const onProvinceChange = (vals: string[]) =>
    patch({
      provinces: vals.filter((v) => v !== NULL_PROVINCE),
      includeNullProvince: vals.includes(NULL_PROVINCE),
    });

  const dateLabel =
    criteria.registration && (criteria.registration.from || criteria.registration.to)
      ? `${criteria.registration.from || "…"} → ${criteria.registration.to || "…"}`
      : "Chọn khoảng ngày";

  return (
    <div className="space-y-3 rounded-xl bg-muted/30 p-4">
      {/* Registration date */}
      <GatedField
        id="cb-registration"
        checked={enabled.registration}
        onCheckedChange={(v) => setGate("registration", v)}
        label="Ngày tạo tài khoản"
      >
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-10 w-full justify-start gap-1.5 font-normal",
                !criteria.registration && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateLabel}
              {criteria.registration && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    patch({ registration: null });
                  }}
                  className="ml-auto hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range}
              onSelect={onRange}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </GatedField>

      {/* Account types */}
      <GatedField
        id="cb-accountTypes"
        checked={enabled.accountTypes}
        onCheckedChange={(v) => setGate("accountTypes", v)}
        label="Loại tài khoản"
      >
        <MultiSelectField
          options={ACCOUNT_OPTIONS}
          selected={criteria.accountTypes}
          onChange={(vals) => patch({ accountTypes: vals as AccountType[] })}
          placeholder="Chọn loại tài khoản"
        />
      </GatedField>

      {/* KYC statuses */}
      <GatedField
        id="cb-kycStatuses"
        checked={enabled.kycStatuses}
        onCheckedChange={(v) => setGate("kycStatuses", v)}
        label="Trạng thái KYC"
      >
        <MultiSelectField
          options={KYC_OPTIONS}
          selected={criteria.kycStatuses}
          onChange={(vals) => patch({ kycStatuses: vals as KycStatusValue[] })}
          placeholder="Chọn trạng thái KYC"
          maxBadges={3}
        />
      </GatedField>

      {/* Credit range */}
      <GatedField
        id="cb-credit"
        checked={enabled.credit}
        onCheckedChange={(v) => setGate("credit", v)}
        label="Số dư credit"
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Tối thiểu"
            value={criteria.credit?.min ?? ""}
            onChange={(e) => setCredit("min", e.target.value)}
            className="h-10"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Tối đa"
            value={criteria.credit?.max ?? ""}
            onChange={(e) => setCredit("max", e.target.value)}
            className="h-10"
          />
        </div>
      </GatedField>

      {/* Provinces */}
      <GatedField
        id="cb-provinces"
        checked={enabled.provinces}
        onCheckedChange={(v) => setGate("provinces", v)}
        label="Tỉnh/thành"
      >
        <MultiSelectField
          options={PROVINCE_MULTI_OPTIONS}
          selected={provinceSelected}
          onChange={onProvinceChange}
          placeholder="Chọn tỉnh/thành"
          searchPlaceholder="Tìm tỉnh/thành…"
          searchable
          emptyText="Không tìm thấy."
        />
      </GatedField>
    </div>
  );
}
