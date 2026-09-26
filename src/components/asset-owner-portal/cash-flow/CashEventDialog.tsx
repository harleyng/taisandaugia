import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { useSaveCashEvent } from "@/hooks/useOwnerCashFlow";
import {
  CASH_KINDS,
  CASH_KIND_HINT,
  CASH_KIND_LABEL,
  makeCashEventSchema,
  toCashEventInsert,
  toCashEventUpdate,
  type CashEventForm,
  type CashKind,
} from "@/lib/ownerCashEvent";
import { outcomeCashContext, recordableRows, type CashEvent, type CashFlowData } from "@/lib/ownerCashFlow";
import { formatDayFull } from "@/lib/ownerPulse";
import { formatMoneyFull } from "@/utils/money";
import type { CanWriteRow } from "./cashFlowDialogState";

export type CashEventTarget =
  | { mode: "create"; outcomeId: string | null; presetKind?: CashKind }
  | { mode: "edit"; event: CashEvent };

interface CashEventDialogProps {
  workspaceId: string;
  data: CashFlowData;
  /** null ⇒ đóng. */
  target: CashEventTarget | null;
  /** Danh sách chọn tài sản chỉ gồm tài sản người dùng ghi được (phạm vi chi nhánh). */
  canWrite: CanWriteRow;
  onClose: () => void;
}

/** Ghi / sửa một khoản thu chi. Sổ là nguồn thật; tổng trên kết quả phiên do server tính lại. */
export function CashEventDialog({ workspaceId, data, target, canWrite, onClose }: CashEventDialogProps) {
  const save = useSaveCashEvent(workspaceId);
  const busy = save.isPending;
  const editing = target?.mode === "edit" ? target.event : null;
  const options = useMemo(() => recordableRows(data).filter((r) => canWrite(r.unitId, r.branchId)), [data, canWrite]);

  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const ctx = outcomeId ? outcomeCashContext(data, outcomeId) : null;
  const row = data.rows.find((r) => r.ownOutcomeId === outcomeId) ?? null;
  const remaining = ctx?.winningPrice ? Math.max(0, ctx.winningPrice - ctx.collected) : null;

  // Bối cảnh kiểm số đổi theo tài sản đang chọn ⇒ resolver đọc qua ref.
  const ctxRef = useRef({ ctx, editing, asOf: data.asOf });
  ctxRef.current = { ctx, editing, asOf: data.asOf };
  const resolver = useCallback<Resolver<CashEventForm>>((values, context, opts) => {
    const { ctx: c, editing: e, asOf } = ctxRef.current;
    const schema = makeCashEventSchema({
      sold: c?.sold ?? false,
      defaulted: c?.defaulted ?? false,
      winningPrice: c?.winningPrice ?? null,
      collected: c?.collected ?? 0,
      maxDay: asOf,
      editing: e ? { kind: e.kind, amount: e.amount } : null,
    });
    return zodResolver(schema)(values, context, opts);
  }, []);
  const form = useForm<CashEventForm>({ resolver });
  const errors = form.formState.errors;
  const kind = form.watch("kind");

  useEffect(() => {
    if (!target) return;
    setPickError(null);
    if (target.mode === "edit") {
      const e = target.event;
      setOutcomeId(e.outcomeId);
      form.reset({ kind: e.kind, amount: String(Math.round(e.amount)), occurredOn: e.occurredOn, note: e.note ?? "" });
      return;
    }
    setOutcomeId(target.outcomeId);
    const c = target.outcomeId ? outcomeCashContext(data, target.outcomeId) : null;
    const payable = !!c?.sold && !c.defaulted;
    const k: CashKind = target.presetKind ?? (payable ? "payment" : "deposit");
    const left = c?.winningPrice ? Math.max(0, c.winningPrice - c.collected) : 0;
    form.reset({ kind: k, amount: k === "payment" && left > 0 ? String(Math.round(left)) : "", occurredOn: data.asOf, note: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const submit = form.handleSubmit((values) => {
    if (editing) {
      save.mutate({ mode: "update", id: editing.id, payload: toCashEventUpdate(values) }, { onSuccess: onClose });
      return;
    }
    if (!outcomeId) {
      setPickError("Chọn tài sản");
      return;
    }
    save.mutate({ mode: "create", payload: toCashEventInsert(outcomeId, values) }, { onSuccess: onClose });
  });

  const locked = editing !== null || (target?.mode === "create" && target.outcomeId !== null);
  const title = editing ? editing.title : row?.title;
  const payDisabled = !ctx?.sold || ctx.defaulted;

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa khoản thu chi" : "Ghi khoản thu chi"}</DialogTitle>
          <DialogDescription className="space-y-0.5">
            {locked && title ? <span className="line-clamp-2 block text-foreground">{title}</span> : null}
            {ctx?.winningPrice ? (
              <span className="block tabular-nums">
                Giá trúng {formatMoneyFull(ctx.winningPrice)} · đã thu {formatMoneyFull(ctx.collected)}
                {remaining !== null ? ` · còn ${formatMoneyFull(remaining)}` : ""}
              </span>
            ) : !locked ? (
              <span className="block">Khoản được gắn vào kết quả phiên đơn vị đã tự khai.</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <form id="owner-cash-event" className="space-y-4" onSubmit={submit} noValidate>
          {!locked && (
            <div className="space-y-1.5">
              <Label htmlFor="ce-asset">Tài sản</Label>
              <Select
                value={outcomeId ?? undefined}
                onValueChange={(v) => {
                  if (!v) return;
                  setOutcomeId(v);
                  setPickError(null);
                }}
              >
                <SelectTrigger id="ce-asset" disabled={busy}>
                  <SelectValue placeholder="Chọn tài sản đã khai kết quả" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((r) => (
                    <SelectItem key={r.ownOutcomeId} value={r.ownOutcomeId!}>
                      {r.title}
                      {r.date ? ` · phiên ${formatDayFull(r.date)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <OutcomeFieldError msg={pickError ?? undefined} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Loại khoản</Label>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                  {CASH_KINDS.map((k) => {
                    const disabled = busy || (k === "payment" && payDisabled && editing?.kind !== "payment");
                    return (
                      <label
                        key={k}
                        htmlFor={`ce-kind-${k}`}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[[data-state=checked]]:border-primary"
                      >
                        <RadioGroupItem id={`ce-kind-${k}`} value={k} disabled={disabled} className="mt-0.5" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">{CASH_KIND_LABEL[k]}</span>
                          <span className="block text-xs text-muted-foreground">{CASH_KIND_HINT[k]}</span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
            />
            <OutcomeFieldError msg={errors.kind?.message} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ce-amount">Số tiền (₫)</Label>
              <Controller
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    id="ce-amount"
                    allowDecimal={false}
                    className="tabular-nums"
                    disabled={busy}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              <OutcomeFieldError msg={errors.amount?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-date">{kind === "fee" || kind === "refund" ? "Ngày chi" : "Ngày tiền về"}</Label>
              <Input id="ce-date" type="date" max={data.asOf} disabled={busy} {...form.register("occurredOn")} />
              <OutcomeFieldError msg={errors.occurredOn?.message} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ce-note">Ghi chú (tuỳ chọn)</Label>
            <Textarea id="ce-note" rows={2} maxLength={500} disabled={busy} {...form.register("note")} />
            <OutcomeFieldError msg={errors.note?.message} />
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" form="owner-cash-event" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Lưu thay đổi" : "Ghi khoản"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
