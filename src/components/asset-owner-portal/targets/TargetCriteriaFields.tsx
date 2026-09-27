import { Controller, useWatch, type UseFieldArrayReturn, type UseFormReturn } from "react-hook-form";
import { CircleX, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TARGET_METRICS,
  TARGET_METRIC_META,
  formatMetricValue,
  nextUnusedMetric,
  type TargetForm,
  type TargetInput,
  type TargetMetric,
} from "@/lib/ownerTargets";
import { previousPeriodActual, type TargetSlot } from "@/lib/ownerTargetView";
import { FIELD_ERROR, FIELD_HINT } from "./TargetFormSection";
import { HAIRLINE } from "./targetStyles";

const SUB_LABEL = "text-xs font-semibold text-muted-foreground";

interface TargetCriteriaFieldsProps {
  form: UseFormReturn<TargetForm>;
  fieldArray: UseFieldArrayReturn<TargetForm, "criteria">;
  slot: TargetSlot;
  /** Đầu vào "đã thu" — tính số kỳ trước để gợi ý mục tiêu. */
  inputs: TargetInput[];
  disabled: boolean;
}

/** Khối 3 "Tiêu chí": mỗi dòng một loại + mục tiêu (gợi ý số kỳ trước); mỗi loại tối đa một lần, tối đa 4. */
export function TargetCriteriaFields({ form, fieldArray, slot, inputs, disabled }: TargetCriteriaFieldsProps) {
  const { fields, append, remove } = fieldArray;
  const values = useWatch({ control: form.control, name: "criteria" }) ?? [];
  const errors = form.formState.errors.criteria;
  const used = values.map((c) => c?.metric).filter((m): m is TargetMetric => !!m);
  const next = nextUnusedMetric(used);

  /** Đổi loại tiêu chí: cùng đơn vị (tiền ↔ tiền) giữ mục tiêu, khác đơn vị thì xoá. */
  const changeMetric = (i: number, metric: TargetMetric) => {
    const prev = values[i]?.metric;
    form.setValue(`criteria.${i}.metric`, metric);
    if (!prev || TARGET_METRIC_META[prev].unit !== TARGET_METRIC_META[metric].unit) form.setValue(`criteria.${i}.goal`, "");
    form.clearErrors(`criteria.${i}`);
  };

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {fields.map((field, i) => {
          const metric = values[i]?.metric ?? field.metric;
          const meta = TARGET_METRIC_META[metric];
          const goal = Number(values[i]?.goal || 0);
          const goalError = errors?.[i]?.goal?.message;
          const metricError = errors?.[i]?.metric?.message;
          const prev = previousPeriodActual(metric, inputs, slot);
          return (
            <li
              key={field.id}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_40px] items-start gap-2.5 rounded-xl bg-muted/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px]",
                HAIRLINE,
              )}
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={`target-metric-${i}`} className={SUB_LABEL}>
                  Tiêu chí {i + 1}
                </label>
                <Select value={metric} onValueChange={(v) => v && changeMetric(i, v as TargetMetric)} disabled={disabled}>
                  <SelectTrigger id={`target-metric-${i}`} className="rounded-lg bg-card [&>svg]:shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_METRICS.map((m) => (
                      <SelectItem key={m} value={m} disabled={m !== metric && used.includes(m)}>
                        {TARGET_METRIC_META[m].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className={metricError ? FIELD_ERROR : FIELD_HINT}>{metricError ?? meta.hint}</span>
              </div>

              <div className="col-[1] flex min-w-0 flex-col gap-1.5 sm:col-auto">
                <label htmlFor={`target-goal-${i}`} className={SUB_LABEL}>
                  Mục tiêu
                </label>
                <div className="relative">
                  <Controller
                    control={form.control}
                    name={`criteria.${i}.goal`}
                    render={({ field: f }) => (
                      <NumberInput
                        id={`target-goal-${i}`}
                        ref={f.ref}
                        allowDecimal={false}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        aria-invalid={!!goalError}
                        aria-describedby={`target-goal-hint-${i}`}
                        className={cn(
                          "rounded-lg bg-card pr-16 text-right font-semibold tabular-nums",
                          goalError && "border-destructive focus-visible:ring-destructive",
                        )}
                        disabled={disabled}
                        value={f.value ?? ""}
                        onChange={f.onChange}
                      />
                    )}
                  />
                  <span className="pointer-events-none absolute right-3 top-0 flex h-10 items-center text-[12.5px] text-muted-foreground">
                    {meta.unit === "money" ? "₫" : "tài sản"}
                  </span>
                </div>
                <span id={`target-goal-hint-${i}`} className={goalError ? FIELD_ERROR : cn(FIELD_HINT, "tabular-nums")}>
                  {goalError ?? (
                    <>
                      {meta.unit === "money" && goal > 0 && (
                        <>
                          = <b className="font-semibold text-foreground">{formatMetricValue(metric, goal)}</b> ·{" "}
                        </>
                      )}
                      Kỳ trước: <b className="font-semibold text-foreground">{formatMetricValue(metric, prev)}</b>
                    </>
                  )}
                </span>
              </div>

              <button
                type="button"
                className="col-[2] row-[1] mt-[22px] grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-foreground sm:col-auto sm:row-auto"
                disabled={disabled || fields.length === 1}
                onClick={() => remove(i)}
                aria-label={`Bỏ tiêu chí ${meta.label}`}
              >
                <CircleX className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ul>

      {next ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5 self-start text-[13px] font-semibold"
          disabled={disabled}
          onClick={() => append({ metric: next, goal: "" }, { focusName: `criteria.${fields.length}.goal` })}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Thêm tiêu chí
        </Button>
      ) : (
        <span className={FIELD_HINT}>Đã dùng đủ 4 loại tiêu chí.</span>
      )}
    </>
  );
}
