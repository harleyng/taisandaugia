import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toLocalInput } from "@/lib/auctionSessions/datetime";
import { CHECKIN_GRACE_RANGE, CHECKIN_LEAD_RANGE, type SessionFormValues } from "@/lib/auctionSessions/sessionForm";

const TWO_HOURS = 2 * 60 * 60 * 1000;

type DateField =
  | "registration_start_at"
  | "registration_end_at"
  | "viewing_start_at"
  | "viewing_end_at"
  | "starts_at"
  | "ends_at";

const DATE_GROUPS: { label: string; from: DateField; to: DateField; required?: boolean }[] = [
  { label: "Bán & nhận hồ sơ", from: "registration_start_at", to: "registration_end_at" },
  { label: "Xem tài sản", from: "viewing_start_at", to: "viewing_end_at" },
  { label: "Thời gian đấu giá", from: "starts_at", to: "ends_at", required: true },
];

const CHECKIN_FIELDS = [
  {
    name: "checkin_lead_minutes",
    label: "Mở trước giờ bắt đầu (phút)",
    range: CHECKIN_LEAD_RANGE,
    hint: `Từ ${CHECKIN_LEAD_RANGE.min} đến ${CHECKIN_LEAD_RANGE.max} phút.`,
  },
  {
    name: "checkin_grace_minutes",
    label: "Còn nhận sau giờ bắt đầu (phút)",
    range: CHECKIN_GRACE_RANGE,
    hint: `Từ ${CHECKIN_GRACE_RANGE.min} đến ${CHECKIN_GRACE_RANGE.max} phút. Hết giờ này danh sách tự chốt, ai chưa điểm danh bị ghi vắng.`,
  },
] as const;

interface Props {
  form: UseFormReturn<SessionFormValues>;
  /** Đã chốt danh sách điểm danh ⇒ server không cho đổi thời gian điểm danh. */
  checkinLocked: boolean;
}

/** Khối "Lịch phiên" của SessionFormCard: các mốc thời gian + cửa sổ điểm danh. */
export function SessionScheduleFields({ form, checkinLocked }: Props) {
  // Dời giờ bắt đầu qua giờ kết thúc thì tự đẩy giờ kết thúc theo (+2 giờ).
  const onStartsChange = (value: string) => {
    form.setValue("starts_at", value, { shouldDirty: true, shouldValidate: true });
    const starts = Date.parse(value);
    const ends = Date.parse(form.getValues("ends_at"));
    if (!Number.isNaN(starts) && (Number.isNaN(ends) || ends <= starts)) {
      form.setValue("ends_at", toLocalInput(new Date(starts + TWO_HOURS).toISOString()), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Lịch phiên</h3>
      {DATE_GROUPS.map((group) => (
        <div key={group.label} className="grid gap-3 md:grid-cols-[10rem_1fr_1fr] md:items-start">
          <p className="text-sm font-medium text-foreground md:pt-8">
            {group.label}
            {group.required && <span className="text-destructive"> *</span>}
          </p>
          {([group.from, group.to] as const).map((name, i) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">{i === 0 ? "Bắt đầu" : "Kết thúc"}</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      value={field.value ?? ""}
                      onChange={name === "starts_at" ? (e) => onStartsChange(e.target.value) : field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      ))}

      <div className="grid gap-3 md:grid-cols-[10rem_1fr_1fr] md:items-start">
        <p className="text-sm font-medium text-foreground md:pt-8">
          Điểm danh<span className="text-destructive"> *</span>
        </p>
        {CHECKIN_FIELDS.map((f) => (
          <FormField
            key={f.name}
            control={form.control}
            name={f.name}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground">
                  {f.label} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    allowDecimal={false}
                    disabled={checkinLocked}
                    placeholder={String(f.range.min)}
                  />
                </FormControl>
                <FormDescription>
                  {checkinLocked ? "Đã chốt danh sách điểm danh — không đổi được." : f.hint}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  );
}
