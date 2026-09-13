import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InfoBox } from "@/components/shared/InfoBox";
import { formatVnd, groupNumber, parseNumber } from "@/lib/advertising/slug";
import { SALE_FILE_ACCEPT, validateSaleFile } from "@/lib/saleContracts/files";
import {
  SALE_PAYMENT_METHOD_LABELS,
  type SalePaymentMethod,
} from "@/types/auction-sale-contract";

export interface RecordPaymentValues {
  amount: number;
  method: SalePaymentMethod;
  txnRef: string;
  receivedAt: string;
  note: string;
  file: File | null;
}

const METHODS = Object.keys(SALE_PAYMENT_METHOD_LABELS) as SalePaymentMethod[];

/** Giờ địa phương dạng `datetime-local`. */
const nowLocal = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Ghi nhận một khoản thu. Số tiền nhập có tách nhóm bằng DẤU PHẨY để khớp cách
 * hiển thị ở mọi nơi khác; số dư hiện ngay để khỏi thu quá tay (server cũng
 * chặn bằng `amount_exceeds_balance`).
 */
export function RecordPaymentDialog({
  open, onOpenChange, balance, unsigned, isPending, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  balance: number;
  /** Hợp đồng chưa ký — vẫn ghi được nhưng phải cảnh báo. */
  unsigned: boolean;
  isPending: boolean;
  onSubmit: (v: RecordPaymentValues) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SalePaymentMethod>("bank_transfer");
  const [txnRef, setTxnRef] = useState("");
  const [receivedAt, setReceivedAt] = useState(nowLocal());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setMethod("bank_transfer");
    setTxnRef("");
    setReceivedAt(nowLocal());
    setNote("");
    setFile(null);
  }, [open]);

  const value = parseNumber(amount);
  const tooMuch = value > balance;
  const invalidAmount = !Number.isFinite(value) || value <= 0;

  const pick = (f: File | null) => {
    if (!f) return;
    const bad = validateSaleFile(f);
    if (bad) {
      toast.error(bad);
      return;
    }
    setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ghi nhận khoản thu</DialogTitle>
          <DialogDescription>
            Số còn phải trả hiện tại: <strong>{formatVnd(balance)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {unsigned ? (
            <InfoBox variant="amber">
              Hợp đồng <strong>chưa ký</strong>. Khoản thu vẫn được ghi vào sổ, nhưng tiến trình chỉ
              chuyển sang giai đoạn thanh toán sau khi các bên ký xong.
            </InfoBox>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sale-pay-amount">Số tiền</Label>
              <Input
                id="sale-pay-amount"
                inputMode="numeric"
                value={amount}
                disabled={isPending}
                placeholder="0"
                onChange={(e) => setAmount(groupNumber(parseNumber(e.target.value)))}
              />
              {tooMuch ? (
                <p className="text-xs text-destructive">Vượt quá số còn phải trả.</p>
              ) : (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  disabled={isPending || balance <= 0}
                  onClick={() => setAmount(groupNumber(balance))}
                >
                  Điền toàn bộ số còn lại
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sale-pay-method">Hình thức</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as SalePaymentMethod)} disabled={isPending}>
                <SelectTrigger id="sale-pay-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {SALE_PAYMENT_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sale-pay-at">Thời điểm nhận</Label>
              <Input
                id="sale-pay-at"
                type="datetime-local"
                value={receivedAt}
                disabled={isPending}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sale-pay-ref">Mã giao dịch</Label>
              <Input
                id="sale-pay-ref"
                value={txnRef}
                disabled={isPending}
                placeholder="FT26091200123"
                onChange={(e) => setTxnRef(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sale-pay-file">Chứng từ (tuỳ chọn)</Label>
            <Input
              id="sale-pay-file"
              type="file"
              accept={SALE_FILE_ACCEPT}
              disabled={isPending}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {file ? <p className="text-xs text-muted-foreground break-all">{file.name}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sale-pay-note">Ghi chú</Label>
            <Textarea
              id="sale-pay-note"
              rows={2}
              value={note}
              disabled={isPending}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={invalidAmount || tooMuch || isPending}
            onClick={() =>
              onSubmit({
                amount: value,
                method,
                txnRef: txnRef.trim(),
                receivedAt: receivedAt ? new Date(receivedAt).toISOString() : "",
                note: note.trim(),
                file,
              })
            }
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Ghi nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
