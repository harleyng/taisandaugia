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
import { SALE_FILE_ACCEPT, validateSaleFile } from "@/lib/saleContracts/files";
import {
  SALE_TITLE_TRANSFER_LABELS,
  type SaleTitleTransferStatus,
} from "@/types/auction-sale-contract";

const STATUSES = Object.keys(SALE_TITLE_TRANSFER_LABELS) as SaleTitleTransferStatus[];

/**
 * Sang tên chỉ là GHI NHẬN: thủ tục diễn ra ở cơ quan nhà nước, sàn không chạy
 * quy trình nào ở đây.
 */
export function TitleTransferDialog({
  open, onOpenChange, current, currentNote, isPending, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: SaleTitleTransferStatus;
  currentNote: string | null;
  isPending: boolean;
  onSubmit: (v: { status: SaleTitleTransferStatus; note: string; file: File | null }) => void;
}) {
  const [status, setStatus] = useState<SaleTitleTransferStatus>(current);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(current);
    setNote(currentNote ?? "");
    setFile(null);
  }, [open, current, currentNote]);

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
          <DialogTitle>Tiến độ đăng ký sang tên</DialogTitle>
          <DialogDescription>
            Sàn chỉ ghi nhận tiến độ; thủ tục thực hiện tại cơ quan nhà nước có thẩm quyền.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sale-title-status">Trạng thái</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SaleTitleTransferStatus)}
              disabled={isPending}
            >
              <SelectTrigger id="sale-title-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SALE_TITLE_TRANSFER_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sale-title-note">Ghi chú</Label>
            <Textarea
              id="sale-title-note"
              rows={3}
              value={note}
              disabled={isPending}
              placeholder="Ví dụ: đã nộp hồ sơ tại Văn phòng đăng ký đất đai ngày…"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sale-title-doc">Giấy tờ (tuỳ chọn)</Label>
            <Input
              id="sale-title-doc"
              type="file"
              accept={SALE_FILE_ACCEPT}
              disabled={isPending}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {file ? <p className="text-xs text-muted-foreground break-all">{file.name}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => onSubmit({ status, note: note.trim(), file })}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
