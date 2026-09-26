import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCompleteAuthentication } from "@/hooks/useAdminAuthenticationOrders";
import { GD_VERDICT_LABELS } from "@/lib/authentication/status";
import type { AuthenticationOrder, AuthenticationVerdict } from "@/types/authentication";

const MAX_BYTES = 10 * 1024 * 1024;

const VERDICT_HINT: Record<AuthenticationVerdict, string> = {
  authentic: "Lô được gắn huy hiệu “Đã giám định”, mức xác minh ≥ 3.",
  inconclusive: "Lô không đăng được ở nhóm Cổ vật; hồ sơ Cổ vật bị trả về nháp.",
  suspected_fake: "Hồ sơ bị trả về nháp; lô không đăng được ở nhóm Cổ vật.",
};

/**
 * Tải chứng thư PDF + kết luận THAY đối tác (BR-GD-01). File lên bucket trước, RPC kiểm
 * file có thật rồi mới chốt; lý do kết luận tiêu cực chỉ người bán + admin đọc (BR-GD-02).
 */
export function CompleteAuthenticationDialog({
  order,
  open,
  onOpenChange,
}: {
  order: AuthenticationOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const complete = useCompleteAuthentication();
  const inputRef = useRef<HTMLInputElement>(null);
  const [verdict, setVerdict] = useState<AuthenticationVerdict>("authentic");
  const [reason, setReason] = useState("");
  const [certNo, setCertNo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setVerdict("authentic");
    setReason("");
    setCertNo("");
    setFile(null);
    setFileError(null);
  }, [open]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf") return setFileError("Chứng thư phải là file PDF.");
    if (f.size > MAX_BYTES) return setFileError("File tối đa 10MB.");
    setFileError(null);
    setFile(f);
  };

  const negative = verdict !== "authentic";
  const valid = !!file && (!negative || reason.trim().length >= 5);

  return (
    <Dialog open={open} onOpenChange={(v) => !complete.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kết luận giám định · {order.code}</DialogTitle>
          <DialogDescription>
            Tải lên thay đối tác <span className="font-semibold text-foreground">{order.partner_name}</span>. Người bán
            không tải được chứng thư. Sau khi lưu, hệ thống ghi nhận hoa hồng đối tác.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kết luận</Label>
            <RadioGroup value={verdict} onValueChange={(v) => setVerdict(v as AuthenticationVerdict)} className="gap-2">
              {(Object.keys(GD_VERDICT_LABELS) as AuthenticationVerdict[]).map((v) => (
                <label
                  key={v}
                  htmlFor={`gd-verdict-${v}`}
                  className={[
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                    verdict === v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  ].join(" ")}
                >
                  <RadioGroupItem id={`gd-verdict-${v}`} value={v} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{GD_VERDICT_LABELS[v]}</span>
                    <span className="block text-xs text-muted-foreground">{VERDICT_HINT[v]}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {negative && (
            <div className="space-y-1.5">
              <Label htmlFor="gd-reason">Lý do (gửi riêng cho người bán)</Label>
              <Textarea
                id="gd-reason"
                rows={3}
                maxLength={2000}
                value={reason}
                placeholder="VD: Men gốm là men công nghiệp; hoa văn không khớp niên đại khai báo"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="gd-cert-no">
              Số chứng thư <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
            </Label>
            <Input id="gd-cert-no" value={certNo} maxLength={200} onChange={(e) => setCertNo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Chứng thư PDF</Label>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              {file ? <FileText className="mr-1.5 h-3.5 w-3.5" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              {file ? file.name : "Chọn file PDF (≤ 10MB)"}
            </Button>
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={complete.isPending}>
            Huỷ
          </Button>
          <Button
            disabled={!valid || complete.isPending}
            variant={verdict === "suspected_fake" ? "destructive" : "default"}
            onClick={() =>
              file &&
              complete.mutate(
                {
                  orderId: order.id,
                  postingId: order.asset_posting_id,
                  verdict,
                  reason: negative ? reason.trim() : "",
                  certificateNo: certNo.trim(),
                  file,
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu kết luận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
