import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoBox } from "@/components/shared/InfoBox";
import { SALE_FILE_ACCEPT, validateSaleFile } from "@/lib/saleContracts/files";
import { generateSaleDraftFile } from "@/hooks/useSaleContracts";
import type { SaleContractDetail } from "@/types/auction-sale-contract";

export interface ShareDraftValues {
  file: File;
  generated: boolean;
}

/**
 * Chia sẻ dự thảo. "Tạo từ kết quả đấu giá" dựng PDF ngay trên máy tổ chức
 * (pdfmake nạp động) rồi tải lên như một tệp bình thường — server không phân
 * biệt, chỉ ghi lại `draft_source`.
 */
export function ShareDraftDialog({
  open, onOpenChange, detail, categoryLabel, isPending, replacing, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: Pick<SaleContractDetail, "contract" | "installments">;
  categoryLabel?: string | null;
  isPending: boolean;
  /** Đã có bản ký ⇒ chia sẻ lại sẽ xoá bản ký và mọi xác nhận. */
  replacing: boolean;
  onSubmit: (v: ShareDraftValues) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [generated, setGenerated] = useState(false);
  const [building, setBuilding] = useState(false);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setGenerated(false);
    setBuilding(false);
  }, [open]);

  // Thu hồi object URL khi đổi tệp / đóng hộp thoại.
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    },
    [file],
  );

  const pick = (f: File | null) => {
    if (!f) return;
    const invalid = validateSaleFile(f);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setFile(f);
    setGenerated(false);
  };

  const build = async () => {
    setBuilding(true);
    try {
      const f = await generateSaleDraftFile(detail, categoryLabel);
      setFile(f);
      setGenerated(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được dự thảo.");
    } finally {
      setBuilding(false);
    }
  };

  const preview = () => {
    if (!file) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(file);
    window.open(previewRef.current, "_blank", "noopener");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chia sẻ dự thảo hợp đồng</DialogTitle>
          <DialogDescription>
            Bên mua và bên bán sẽ xem được bản dự thảo này để rà soát trước khi ký.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {replacing ? (
            <InfoBox variant="amber">
              Hợp đồng đã có bản ký. Chia sẻ dự thảo mới sẽ <strong>xoá bản ký cũ</strong> và mọi xác
              nhận — các bên phải ký lại từ đầu.
            </InfoBox>
          ) : null}

          <div className="space-y-2">
            <Button type="button" variant="outline" onClick={build} disabled={building || isPending}>
              {building ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              )}
              Tạo dự thảo từ kết quả đấu giá
            </Button>
            <p className="text-xs text-muted-foreground">
              Bản dựng tự động dùng mẫu tham khảo, chưa được rà soát pháp lý — hai bên nên đọc kỹ và
              chỉnh sửa trước khi ký.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sale-draft-file">Hoặc tải lên bản dự thảo của tổ chức</Label>
            <Input
              id="sale-draft-file"
              type="file"
              accept={SALE_FILE_ACCEPT}
              disabled={isPending}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">PDF, JPG hoặc PNG, tối đa 10MB.</p>
          </div>

          {file ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <span className="flex-1 break-all">{file.name}</span>
              {generated ? <span className="text-xs text-muted-foreground">(bản dựng tự động)</span> : null}
              <Button type="button" variant="ghost" size="sm" onClick={preview}>
                Xem trước
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={!file || isPending || building}
            onClick={() => file && onSubmit({ file, generated })}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Chia sẻ dự thảo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
