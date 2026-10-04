import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRequestValuation, useValuationPackage } from "@/hooks/useValuationOrders";
import { formatVnd } from "@/lib/advertising/slug";
import { PURPOSE_LABELS } from "@/lib/valuation/status";
import type { ValuationPurpose } from "@/types/valuation";

interface RequestValuationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trả id hồ sơ — trong wizard tự lưu nháp nếu chưa có. null = chưa lưu được (hàm tự báo lỗi). */
  resolvePostingId: () => Promise<string | null>;
  /** Thẩm định lại sau khi đã có chứng thư ⇒ đổi tiêu đề. */
  isFollowUp: boolean;
}

const PURPOSES = Object.keys(PURPOSE_LABELS) as ValuationPurpose[];

/** "Thẩm định giá qua sàn": chọn mục đích + địa chỉ khảo sát ⇒ sàn phân công đơn vị & báo giá. */
export function RequestValuationDialog({ open, onOpenChange, resolvePostingId, isFollowUp }: RequestValuationDialogProps) {
  const { data: pkg, isLoading, error } = useValuationPackage(open);
  const request = useRequestValuation();
  const [purpose, setPurpose] = useState<ValuationPurpose>("auction");
  const [siteAddress, setSiteAddress] = useState("");
  const [note, setNote] = useState("");
  const [preparing, setPreparing] = useState(false);

  const busy = preparing || request.isPending;

  const submit = async () => {
    setPreparing(true);
    const postingId = await resolvePostingId();
    setPreparing(false);
    if (!postingId) return;
    request.mutate(
      { postingId, purpose, siteAddress, note },
      {
        onSuccess: () => {
          onOpenChange(false);
          setNote("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isFollowUp ? "Thẩm định giá lại" : "Thẩm định giá qua sàn"}</DialogTitle>
          <DialogDescription>
            Đơn vị thẩm định giá đối tác của sàn khảo sát tài sản, định giá và cấp chứng thư thẩm định giá. Sàn gửi báo
            giá chính thức trước khi bạn thanh toán.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải dịch vụ…
          </div>
        ) : error || !pkg ? (
          <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Dịch vụ thẩm định giá đang tạm ngưng nhận yêu cầu. Vui lòng thử lại sau.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {pkg.name} · tham khảo từ <span className="font-semibold text-foreground">{formatVnd(pkg.from_price)}</span>
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="tdg-purpose">
                Mục đích thẩm định<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as ValuationPurpose)}>
                <SelectTrigger id="tdg-purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PURPOSE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tdg-address">Địa chỉ khảo sát</Label>
              <Input
                id="tdg-address"
                value={siteAddress}
                maxLength={500}
                placeholder="Để trống nếu trùng địa chỉ tài sản trong hồ sơ"
                onChange={(e) => setSiteAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tdg-note">Ghi chú cho đơn vị thẩm định</Label>
              <Textarea
                id="tdg-note"
                rows={3}
                value={note}
                maxLength={2000}
                placeholder="VD: thời gian thuận tiện khảo sát, người liên hệ tại chỗ…"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Đóng
          </Button>
          <Button type="button" onClick={submit} disabled={!pkg || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
