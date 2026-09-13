import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InfoBox } from "@/components/shared/InfoBox";
import { cancelConsequenceOf } from "@/lib/saleContracts/errors";
import {
  SALE_CANCEL_KIND_LABELS,
  type SaleCancelKind,
  type SaleSide,
} from "@/types/auction-sale-contract";

const MIN_REASON = 10;

/** Bên nào được nêu loại huỷ nào — tổ chức được chọn cả ba (họ ghi nhận hộ). */
function kindsFor(side: SaleSide): SaleCancelKind[] {
  if (side === "buyer") return ["buyer_refused", "mutual"];
  if (side === "seller") return ["seller_refused", "mutual"];
  return ["buyer_refused", "seller_refused", "mutual"];
}

/**
 * Huỷ hợp đồng. Hậu quả TIỀN ĐẶT TRƯỚC khác nhau hẳn giữa các loại huỷ nên
 * phải nói rõ NGAY dưới lựa chọn, trước khi bấm.
 */
export function CancelSaleDialog({
  open, onOpenChange, side, isPending, isSigned, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  side: SaleSide;
  isPending: boolean;
  isSigned: boolean;
  onSubmit: (v: { kind: SaleCancelKind; reason: string }) => void;
}) {
  const kinds = kindsFor(side);
  const [kind, setKind] = useState<SaleCancelKind>(kinds[0]);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(kinds[0]);
    setReason("");
    // kinds là hằng theo `side`; không đưa vào deps để không reset khi render lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side]);

  const tooShort = reason.trim().length < MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Huỷ hợp đồng mua bán</DialogTitle>
          <DialogDescription>
            {isSigned
              ? "Hợp đồng đã ký — việc huỷ cần có căn cứ rõ ràng và được ghi vào nhật ký."
              : "Việc huỷ được ghi vào nhật ký hợp đồng và không hoàn tác được."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lý do huỷ</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as SaleCancelKind)}>
              {kinds.map((k) => (
                <label key={k} className="flex items-start gap-2 text-sm">
                  <RadioGroupItem value={k} disabled={isPending} className="mt-0.5" />
                  <span>{SALE_CANCEL_KIND_LABELS[k]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <InfoBox variant={kind === "buyer_refused" ? "amber" : "muted"}>
            {cancelConsequenceOf(kind)}
          </InfoBox>

          <div className="space-y-1.5">
            <Label htmlFor="sale-cancel-reason">Diễn giải</Label>
            <Textarea
              id="sale-cancel-reason"
              rows={3}
              value={reason}
              disabled={isPending}
              placeholder="Nêu rõ căn cứ huỷ hợp đồng (ít nhất 10 ký tự)…"
              onChange={(e) => setReason(e.target.value)}
            />
            {tooShort && reason.length > 0 ? (
              <p className="text-xs text-destructive">Cần ít nhất {MIN_REASON} ký tự.</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Để sau
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={tooShort || isPending}
            onClick={() => onSubmit({ kind, reason: reason.trim() })}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Huỷ hợp đồng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
