import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Clock, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { toLocalInput } from "@/lib/auctionSessions/datetime";
import { CHECKIN_GRACE_RANGE, CHECKIN_LEAD_RANGE, type SessionFormValues } from "@/lib/auctionSessions/sessionForm";
import { FormSection, Req, SuffixNumberInput } from "./formParts";

type Form = UseFormReturn<SessionFormValues>;
type DateField =
  | "registration_start_at"
  | "registration_end_at"
  | "viewing_start_at"
  | "viewing_end_at"
  | "starts_at"
  | "ends_at";

const TWO_HOURS = 2 * 60 * 60 * 1000;
const MINUTE = 60_000;
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dmy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

const ROWS: { title: string; sub: string; from: DateField; to: DateField; key?: boolean }[] = [
  { title: "Bán & nhận hồ sơ", sub: "Người mua mua hồ sơ và nộp đăng ký.", from: "registration_start_at", to: "registration_end_at" },
  { title: "Xem tài sản", sub: "Người mua xem tài sản thực tế.", from: "viewing_start_at", to: "viewing_end_at" },
  { title: "Thời gian đấu giá", sub: "Giờ mở và đóng phiên.", from: "starts_at", to: "ends_at", key: true },
];

/** Một hàng của bảng lịch: tiêu đề bên trái, hai ô bên phải (design `.sr`). */
function Row({ title, sub, required, tint, children }: { title: string; sub: string; required?: boolean; tint?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid items-start gap-3 border-t px-4 py-3.5 first:border-t-0 md:grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)]",
        tint && "bg-primary/[0.03]",
      )}
    >
      <div>
        <b className="block text-[13px] font-semibold">
          {title}
          {required && <Req />}
        </b>
        <small className="mt-0.5 block text-xs text-muted-foreground [text-wrap:pretty]">{sub}</small>
      </div>
      {children}
    </div>
  );
}

const SUB_LABEL = "text-xs font-medium text-muted-foreground";

/** 3 · Lịch phiên — các mốc thời gian + cửa sổ điểm danh. */
export function SessionScheduleSection({ form, checkinLocked }: { form: Form; checkinLocked: boolean }) {
  const [startsAt, lead, grace] = form.watch(["starts_at", "checkin_lead_minutes", "checkin_grace_minutes"]);

  // Dời giờ bắt đầu qua giờ kết thúc thì tự đẩy giờ kết thúc theo (+2 giờ).
  const onStartsChange = (value: string) => {
    form.setValue("starts_at", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    const starts = Date.parse(value);
    const ends = Date.parse(form.getValues("ends_at"));
    if (!Number.isNaN(starts) && (Number.isNaN(ends) || ends <= starts)) {
      form.setValue("ends_at", toLocalInput(new Date(starts + TWO_HOURS).toISOString()), {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      });
    }
  };

  const starts = Date.parse(startsAt);
  const leadN = Number(lead);
  const graceN = Number(grace);
  const windowOk =
    !Number.isNaN(starts) &&
    /^\d+$/.test(lead) &&
    /^\d+$/.test(grace) &&
    leadN >= CHECKIN_LEAD_RANGE.min &&
    leadN <= CHECKIN_LEAD_RANGE.max &&
    graceN >= CHECKIN_GRACE_RANGE.min &&
    graceN <= CHECKIN_GRACE_RANGE.max;

  return (
    <FormSection
      no={3}
      title="Lịch phiên"
      description="Các mốc theo thứ tự: nhận hồ sơ và xem tài sản phải kết thúc trước giờ đấu giá."
    >
      <div className="flex flex-col rounded-xl shadow-[inset_0_0_0_1px_hsl(var(--border))]">
        {ROWS.map((r) => (
          <Row key={r.title} title={r.title} sub={r.sub} required={r.key} tint={r.key}>
            {([r.from, r.to] as const).map((name, i) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={SUB_LABEL}>{i === 0 ? "Bắt đầu" : "Kết thúc"}</FormLabel>
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
          </Row>
        ))}

        <Row title="Điểm danh" sub="Cửa sổ xác nhận có mặt quanh giờ bắt đầu." required>
          {(
            [
              ["checkin_lead_minutes", "Mở trước giờ bắt đầu"],
              ["checkin_grace_minutes", "Còn nhận sau giờ bắt đầu"],
            ] as const
          ).map(([name, label]) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel className={SUB_LABEL}>{label}</FormLabel>
                  <FormControl>
                    <SuffixNumberInput
                      unit="phút"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={checkinLocked}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <p
            className={cn(
              "flex items-center gap-1.5 text-[12.5px] font-semibold md:col-start-2 md:col-end-4",
              windowOk ? "text-primary" : "text-[hsl(var(--tier-warn-strong))]",
            )}
          >
            {windowOk ? (
              <>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Mở {hm(new Date(starts - leadN * MINUTE))} → chốt danh sách {hm(new Date(starts + graceN * MINUTE))}, ngày{" "}
                {dmy(new Date(starts))}
              </>
            ) : Number.isNaN(starts) ? (
              <>
                <Info className="h-3.5 w-3.5 shrink-0" />
                Chọn thời gian đấu giá để tính cửa sổ điểm danh
              </>
            ) : null}
          </p>
        </Row>
      </div>

      {checkinLocked && (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-muted px-3.5 py-3 text-[13px] font-medium text-muted-foreground">
          <Info className="mt-px h-4 w-4 shrink-0" />
          <span>Đã chốt danh sách điểm danh — không đổi được thời gian điểm danh.</span>
        </div>
      )}
    </FormSection>
  );
}
