import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { usePostingAuthenticationState } from "@/hooks/useAuthenticationOrders";
import { useSetLotAuthenticationRequirement } from "@/hooks/useAdminAuthenticationOrders";
import { REQUIRED_REASON_LABELS } from "@/lib/authentication/requirement";
import { qk } from "@/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Admin đánh dấu / bỏ đánh dấu "bắt buộc giám định" cho MỘT lô (BR-GD-03). Cổng quyền
 * tai-san-tu-nguyen:approve — cùng người quyết định lô nào được lên catalogue.
 */
export function LotRequirementControl({ postingId }: { postingId: string }) {
  const canApprove = useHasAdminPermission("tai-san-tu-nguyen", "approve");
  const { data: state } = usePostingAuthenticationState(postingId);
  const setReq = useSetLotAuthenticationRequirement();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const reasons = state?.reasons ?? [];
  const flagged = reasons.includes("lot_flag");
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.authentication.state(postingId) });

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ShieldAlert className="h-4 w-4 text-warning" />
          {reasons.length > 0 ? "Bắt buộc giám định trước khi nộp / đưa vào phiên" : "Không bắt buộc giám định"}
        </p>
        {canApprove && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={setReq.isPending}
            onClick={() =>
              flagged
                ? setReq.mutate({ postingId, required: false, reason: "" }, { onSuccess: refresh })
                : setOpen(true)
            }
          >
            {setReq.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {flagged ? "Bỏ bắt buộc cho lô này" : "Đặt bắt buộc giám định"}
          </Button>
        )}
      </div>
      {reasons.length > 0 && (
        <ul className="text-xs text-muted-foreground">
          {reasons.map((r) => (
            <li key={r}>• {r === "seller_restricted" ? "Người bán thuộc diện bắt buộc giám định" : REQUIRED_REASON_LABELS[r]}</li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bắt buộc giám định cho lô</DialogTitle>
            <DialogDescription>
              Người bán không nộp được hồ sơ và tổ chức không đưa được lô vào phiên cho tới khi có chứng thư “xác
              thực”. Lý do hiển thị cho người bán.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="lot-req-reason">Lý do</Label>
            <Textarea
              id="lot-req-reason"
              rows={3}
              value={reason}
              maxLength={1000}
              placeholder="VD: Giá trị lớn, ảnh con dấu đáy không rõ…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <Button
              disabled={reason.trim().length < 5 || setReq.isPending}
              onClick={() =>
                setReq.mutate(
                  { postingId, required: true, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      refresh();
                      setOpen(false);
                      setReason("");
                    },
                  },
                )
              }
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
