import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { useSaveCashEvent } from "@/hooks/useOwnerCashFlow";
import { todayIso } from "@/lib/ownerOutcomeReport";
import {
  makePartialPaymentSchema,
  partialPaymentEvent,
  remainingOf,
  type PartialPaymentForm,
} from "@/lib/ownerOutcomePayment";
import { formatMoneyFull } from "@/utils/money";

export interface PartialPaymentTarget {
  outcomeId: string;
  title: string;
  winningPrice: number | null;
  /** Số đã thu tới nay (tổng các khoản trong sổ). */
  paidAmount: number | null;
}

interface PartialPaymentDialogProps {
  workspaceId: string;
  /** null ⇒ đóng. */
  target: PartialPaymentTarget | null;
  onClose: () => void;
}

/** "Thu một phần": ghi số thu LẦN NÀY thành một khoản trong sổ thu chi (Phase 15a). */
export function PartialPaymentDialog({ workspaceId, target, onClose }: PartialPaymentDialogProps) {
  const save = useSaveCashEvent(workspaceId);
  const open = !!target;
  const today = useMemo(() => todayIso(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const remaining = target ? remainingOf(target.winningPrice, target.paidAmount) : null;
  const schema = useMemo(() => makePartialPaymentSchema(remaining, today), [remaining, today]);
  const form = useForm<PartialPaymentForm>({ resolver: zodResolver(schema) });
  const busy = save.isPending;
  const errors = form.formState.errors;

  useEffect(() => {
    if (!target) return;
    form.reset({ amount: "", paidAt: today });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.outcomeId]);

  const submit = form.handleSubmit((values) => {
    if (!target) return;
    const settles = remaining !== null && Number(values.amount) >= remaining;
    save.mutate(
      {
        mode: "create",
        payload: partialPaymentEvent(target.outcomeId, values),
        successMessage: settles ? "Đã ghi nhận thu đủ" : "Đã ghi nhận thu một phần",
      },
      { onSuccess: onClose },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Thu một phần</DialogTitle>
          <DialogDescription className="space-y-0.5">
            <span className="line-clamp-2 block text-foreground">{target?.title}</span>
            {target?.winningPrice ? (
              <span className="block tabular-nums">Giá trúng {formatMoneyFull(target.winningPrice)}</span>
            ) : null}
            {target?.paidAmount ? (
              <span className="block tabular-nums">
                Đã thu trước đó {formatMoneyFull(target.paidAmount)}
                {remaining !== null ? ` · còn ${formatMoneyFull(remaining)}` : ""}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <form id="owner-partial-payment" className="grid gap-3 sm:grid-cols-2" onSubmit={submit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pp-amount">Số thu lần này (₫)</Label>
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <NumberInput
                  id="pp-amount"
                  allowDecimal={false}
                  className="tabular-nums"
                  disabled={busy}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.amount ? (
              <OutcomeFieldError msg={errors.amount.message} />
            ) : (
              <p className="text-xs text-muted-foreground">Chỉ số tiền của lần này — hệ thống tự cộng dồn</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-date">Ngày thu</Label>
            <Input id="pp-date" type="date" max={today} disabled={busy} {...form.register("paidAt")} />
            <OutcomeFieldError msg={errors.paidAt?.message} />
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" form="owner-partial-payment" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ghi khoản thu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
