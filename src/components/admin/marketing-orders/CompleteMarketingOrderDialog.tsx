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
import { Textarea } from "@/components/ui/textarea";

interface CompleteMarketingOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  /** Gói đăng MXH bắt buộc link bài đăng (khớp admin_mkt_order_complete). */
  requirePostUrl: boolean;
  initialPostUrl: string | null;
  isPending: boolean;
  onSubmit: (v: { note: string; postUrl: string }) => Promise<unknown>;
}

const URL_RE = /^https?:\/\//i;

/** Hoàn tất đơn: ghi chú kết quả cho chủ tài sản (+ link bài đăng). Số liệu email/banner tự đóng băng. */
export function CompleteMarketingOrderDialog({
  open,
  onOpenChange,
  code,
  requirePostUrl,
  initialPostUrl,
  isPending,
  onSubmit,
}: CompleteMarketingOrderDialogProps) {
  const [note, setNote] = useState("");
  const [postUrl, setPostUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setNote("");
    setPostUrl(initialPostUrl ?? "");
  }, [open, initialPostUrl]);

  const url = postUrl.trim();
  const urlOk = url ? URL_RE.test(url) : !requirePostUrl;
  const valid = note.trim().length >= 5 && urlOk;

  const submit = () =>
    onSubmit({ note: note.trim(), postUrl: url }).then(
      () => onOpenChange(false),
      // Lỗi đã được toast ở hook; giữ dialog mở để sửa lại.
      (): void => undefined,
    );

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hoàn tất đơn {code}</DialogTitle>
          <DialogDescription>
            Chủ tài sản sẽ thấy ghi chú này cùng số liệu của chiến dịch / banner đã gắn (đóng băng lúc hoàn tất).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mkt-complete-note">Kết quả</Label>
            <Textarea
              id="mkt-complete-note"
              rows={4}
              maxLength={2000}
              value={note}
              placeholder="Đã làm gì, ở đâu, trong bao lâu; điểm đáng chú ý cho đợt sau…"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mkt-complete-url">Link bài đăng{requirePostUrl ? "" : " (nếu có)"}</Label>
            <Input
              id="mkt-complete-url"
              value={postUrl}
              placeholder="https://facebook.com/…"
              onChange={(e) => setPostUrl(e.target.value)}
            />
            {url && !URL_RE.test(url) && (
              <p className="text-xs text-destructive">Link phải bắt đầu bằng http:// hoặc https://</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button disabled={!valid || isPending} onClick={submit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Hoàn tất
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
