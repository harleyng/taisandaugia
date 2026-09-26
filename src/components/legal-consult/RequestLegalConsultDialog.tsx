import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssetDocUpload } from "@/components/asset-posting/AssetDocUpload";
import { useLegalConsultPackage, useRequestLegalConsult } from "@/hooks/useLegalConsultations";
import { formatVnd } from "@/lib/advertising/slug";
import { docLabel } from "@/lib/legalConsult/paths";

interface RequestLegalConsultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trả id hồ sơ — trong wizard tự lưu nháp nếu chưa có. null = chưa lưu được (hàm tự báo lỗi). */
  resolvePostingId: () => Promise<string | null>;
  /** Tệp đã có trong hồ sơ (giấy tờ sở hữu, tài liệu bổ sung, lần tư vấn trước). */
  availableDocPaths: string[];
  /** Rà soát lại sau khi có kết quả ⇒ đổi tiêu đề / lời dẫn. */
  isFollowUp: boolean;
}

const MAX_DOCS = 50;

/** "Tư vấn pháp lý": chọn tệp hiện có + tải thêm ⇒ gửi cho sàn phân công chuyên gia & báo giá. */
export function RequestLegalConsultDialog({
  open,
  onOpenChange,
  resolvePostingId,
  availableDocPaths,
  isFollowUp,
}: RequestLegalConsultDialogProps) {
  const { data: pkg, isLoading, error } = useLegalConsultPackage(open);
  const request = useRequestLegalConsult();
  const [selected, setSelected] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [preparing, setPreparing] = useState(false);

  const available = useMemo(() => Array.from(new Set(availableDocPaths)), [availableDocPaths]);

  // Mở dialog: mặc định chọn sẵn mọi tệp đã có — người bán thường muốn gửi cả bộ.
  useEffect(() => {
    if (open) setSelected(available);
  }, [open, available]);

  const docPaths = Array.from(new Set([...selected, ...uploaded]));
  const busy = preparing || request.isPending;
  const tooMany = docPaths.length > MAX_DOCS;
  const canSubmit = !!pkg && docPaths.length > 0 && !tooMany && !busy;

  const toggle = (path: string, on: boolean) =>
    setSelected((cur) => (on ? [...cur, path] : cur.filter((p) => p !== path)));

  const submit = async () => {
    setPreparing(true);
    const postingId = await resolvePostingId();
    setPreparing(false);
    if (!postingId) return;
    request.mutate(
      { postingId, docPaths, note },
      {
        onSuccess: () => {
          onOpenChange(false);
          setUploaded([]);
          setNote("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isFollowUp ? "Bổ sung hồ sơ & rà soát lại" : "Tư vấn pháp lý"}</DialogTitle>
          <DialogDescription>
            Chuyên gia pháp lý rà soát giấy tờ, đánh dấu từng mục Đủ / Thiếu / Cần làm rõ và gửi bạn checklist cần bổ
            sung trước khi đưa tài sản ra đấu giá. Sàn gửi báo giá chính thức trước khi bạn thanh toán.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải dịch vụ…
          </div>
        ) : error || !pkg ? (
          <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Dịch vụ tư vấn pháp lý đang tạm ngưng nhận yêu cầu. Vui lòng thử lại sau.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {pkg.name} · tham khảo từ <span className="font-semibold text-foreground">{formatVnd(pkg.from_price)}</span>
            </p>

            <div className="space-y-2">
              <Label>Tệp đã có trong hồ sơ</Label>
              {available.length === 0 ? (
                <p className="text-xs text-muted-foreground">Hồ sơ chưa có tệp nào — tải lên bên dưới.</p>
              ) : (
                <ul className="space-y-1.5">
                  {available.map((p) => (
                    <li key={p}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm hover:border-primary/40">
                        <Checkbox checked={selected.includes(p)} onCheckedChange={(v) => toggle(p, v === true)} />
                        <span className="truncate">{docLabel(p)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Tải thêm giấy tờ <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
              </Label>
              <AssetDocUpload value={uploaded} onChange={setUploaded} prefix="legal-consult" />
              <p className="text-xs text-muted-foreground">
                Tệp tải ở đây chỉ bạn, chuyên gia được phân công và quản trị sàn xem được.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tvpl-note">
                Câu hỏi / ghi chú cho chuyên gia <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
              </Label>
              <Textarea
                id="tvpl-note"
                rows={3}
                value={note}
                maxLength={2000}
                placeholder="VD: sổ đứng tên hai vợ chồng, đang làm thủ tục giải chấp…"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {tooMany && <p className="text-xs text-destructive">Tối đa {MAX_DOCS} tệp cho một lần tư vấn.</p>}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Đóng
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi hồ sơ ({docPaths.length} tệp)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
