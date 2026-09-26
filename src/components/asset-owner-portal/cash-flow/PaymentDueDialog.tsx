import { useEffect, useState } from "react";
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
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { useSetPaymentDue } from "@/hooks/useOwnerCashFlow";
import { DEFAULT_PAYMENT_TERM_DAYS, addDays, type CashRow } from "@/lib/ownerCashFlow";
import { formatDayFull } from "@/lib/ownerPulse";

interface PaymentDueDialogProps {
  workspaceId: string;
  /** null ⇒ đóng. */
  row: CashRow | null;
  onClose: () => void;
}

/** Hạn người trúng nộp đủ tiền — để dự báo và danh sách quá hạn đúng với thực tế. */
export function PaymentDueDialog({ workspaceId, row, onClose }: PaymentDueDialogProps) {
  const setDue = useSetPaymentDue(workspaceId);
  const busy = setDue.isPending;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fallback = row?.date ? addDays(row.date, DEFAULT_PAYMENT_TERM_DAYS) : null;

  useEffect(() => {
    if (!row) return;
    setValue(row.paymentDueOn ?? fallback ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.ownOutcomeId]);

  const save = (dueOn: string | null) => {
    if (!row?.ownOutcomeId) return;
    if (dueOn !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return setError("Chọn ngày");
      if (row.date && dueOn < row.date) return setError("Hạn thanh toán không được trước ngày phiên");
    }
    setDue.mutate({ outcomeId: row.ownOutcomeId, dueOn }, { onSuccess: onClose });
  };

  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Đặt hạn thanh toán</DialogTitle>
          <DialogDescription className="space-y-0.5">
            <span className="line-clamp-2 block text-foreground">{row?.title}</span>
            {row?.date && <span className="block tabular-nums">Phiên ngày {formatDayFull(row.date)}</span>}
          </DialogDescription>
        </DialogHeader>
        <form
          id="owner-payment-due"
          className="space-y-1.5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save(value);
          }}
        >
          <Label htmlFor="pd-date">Hạn nộp đủ tiền</Label>
          <Input
            id="pd-date"
            type="date"
            min={row?.date ?? undefined}
            value={value}
            disabled={busy}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
          {error ? (
            <OutcomeFieldError msg={error} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Chưa đặt thì tính {DEFAULT_PAYMENT_TERM_DAYS} ngày sau phiên
              {fallback ? ` (${formatDayFull(fallback)})` : ""}.
            </p>
          )}
        </form>
        <DialogFooter className="gap-2 sm:gap-0">
          {row?.paymentDueOn && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => save(null)} className="sm:mr-auto">
              Dùng hạn mặc định
            </Button>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" form="owner-payment-due" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu hạn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
