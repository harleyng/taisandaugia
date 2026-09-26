import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuoteTermsFields } from "./QuoteTermsFields";
import { isValidQuoteTerms, type QuoteTerms } from "@/lib/serviceRequests/form";

/**
 * Khung dialog báo giá THAY đối tác — dùng chung mọi loại yêu cầu dịch vụ. Báo lại được khi
 * người bán chưa thanh toán. Trường riêng (phân công chuyên gia…) truyền qua `children`.
 */
export function ServiceQuoteDialog({
  title,
  description,
  initial,
  pricePlaceholder,
  notePlaceholder,
  noteMaxLength,
  extraValid = true,
  children,
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  title: string;
  description: React.ReactNode;
  initial: { price: number | null; note: string | null };
  pricePlaceholder: string;
  notePlaceholder: string;
  noteMaxLength?: number;
  extraValid?: boolean;
  children?: React.ReactNode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (terms: QuoteTerms) => Promise<unknown>;
}) {
  const [terms, setTerms] = useState<QuoteTerms>({ price: 0, validDays: 7, note: "" });

  useEffect(() => {
    if (!open) return;
    setTerms({ price: Number(initial.price ?? 0), validDays: 7, note: initial.note ?? "" });
  }, [open, initial.price, initial.note]);

  const submit = () =>
    onSubmit(terms).then(
      () => onOpenChange(false),
      // Lỗi đã được toast ở hook; giữ dialog mở để sửa lại.
      (): void => undefined,
    );

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {children}
          <QuoteTermsFields
            value={terms}
            onChange={setTerms}
            pricePlaceholder={pricePlaceholder}
            notePlaceholder={notePlaceholder}
            noteMaxLength={noteMaxLength}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button disabled={!isValidQuoteTerms(terms) || !extraValid || isPending} onClick={submit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi báo giá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
