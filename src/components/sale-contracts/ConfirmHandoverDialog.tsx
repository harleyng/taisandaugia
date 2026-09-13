import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SALE_FILE_ACCEPT, validateSaleFile } from "@/lib/saleContracts/files";
import { SALE_SIDE_LABELS, type SaleSide } from "@/types/auction-sale-contract";

/** Biên bản bàn giao là tuỳ chọn — nhiều nơi ký giấy rồi mới scan sau. */
export function ConfirmHandoverDialog({
  open, onOpenChange, side, isPending, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  side: SaleSide;
  isPending: boolean;
  onSubmit: (file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (open) setFile(null);
  }, [open]);

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xác nhận đã bàn giao tài sản</DialogTitle>
          <DialogDescription>
            Bạn xác nhận với tư cách <strong>{SALE_SIDE_LABELS[side].toLowerCase()}</strong> rằng
            tài sản đã được bàn giao trên thực tế. Hợp đồng chỉ chuyển bước khi cả hai bên xác nhận.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="sale-handover-doc">Biên bản bàn giao (tuỳ chọn)</Label>
          <Input
            id="sale-handover-doc"
            type="file"
            accept={SALE_FILE_ACCEPT}
            disabled={isPending}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          {file ? <p className="text-xs text-muted-foreground break-all">{file.name}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Để sau
          </Button>
          <Button type="button" disabled={isPending} onClick={() => onSubmit(file)}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Xác nhận đã bàn giao
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
