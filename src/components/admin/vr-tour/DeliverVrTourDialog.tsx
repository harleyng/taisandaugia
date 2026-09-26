import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VrTourViewer } from "@/components/vr-tour/VrTourViewer";
import { useDeliverVrTour } from "@/hooks/useAdminVrTourOrders";
import type { VrTourOrder } from "@/types/vrTour";

// Khớp CHECK/regex ở admin_deliver_vr_tour — server vẫn là chốt cuối.
const HTTPS_URL = /^https:\/\/[^\s/]+(\/\S*)?$/;

/** Ghi nhận link VR tour đối tác giao ⇒ đơn "Đã giao" + server ghi 1 dòng hoa hồng (BR-VR-03). */
export function DeliverVrTourDialog({
  order,
  open,
  onOpenChange,
}: {
  order: VrTourOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const deliver = useDeliverVrTour();
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  const trimmed = url.trim();
  const valid = HTTPS_URL.test(trimmed) && trimmed.length <= 2000;

  return (
    <Dialog open={open} onOpenChange={(v) => !deliver.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Giao VR tour · {order.code}</DialogTitle>
          <DialogDescription>
            Dán link tour đối tác gửi và kiểm tra bản xem trước. Xác nhận sẽ ghi hoa hồng đối tác theo hợp đồng — không
            hoàn tác được. Tour chỉ công khai sau khi duyệt & gắn vào lô.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vr-deliver-url">Link VR tour</Label>
            <Input
              id="vr-deliver-url"
              value={url}
              placeholder="https://…"
              onChange={(e) => setUrl(e.target.value)}
            />
            {trimmed && !valid && (
              <p className="text-xs text-destructive">Link phải bắt đầu bằng https:// và không chứa khoảng trắng.</p>
            )}
          </div>
          {valid && <VrTourViewer url={trimmed} title={order.posting_title} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deliver.isPending}>
            Huỷ
          </Button>
          <Button
            disabled={!valid || deliver.isPending}
            onClick={() => deliver.mutate({ orderId: order.id, vrUrl: trimmed }, { onSuccess: () => onOpenChange(false) })}
          >
            {deliver.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận đã giao
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
