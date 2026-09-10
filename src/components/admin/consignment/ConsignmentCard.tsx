import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatVnd } from "@/lib/advertising/slug";
import { DispatchOrgsDialog } from "./DispatchOrgsDialog";
import { useAdminConsignment, useDispatchServiceRequests } from "@/hooks/useAdminConsignment";
import {
  BROKER_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  type AssetPosting,
} from "@/types/asset-posting";

interface ConsignmentCardProps {
  posting: AssetPosting;
}

/**
 * Ghép tổ chức đấu giá cho một hồ sơ tài sản (màn duyệt của admin).
 *
 * Chỉ mở khi hồ sơ đã duyệt — RPC cũng chặn ở server, nút này chỉ là lớp UI để
 * không mời admin bấm vào việc chắc chắn lỗi.
 */
export function ConsignmentCard({ posting }: ConsignmentCardProps) {
  const { data, isLoading } = useAdminConsignment(posting.id);
  const dispatch = useDispatchServiceRequests();
  const [open, setOpen] = useState(false);

  const requests = data?.requests ?? [];
  const broker = data?.brokerRequest ?? null;
  const alreadySent = new Set(requests.map((r) => r.auction_org_id));
  const approved = posting.review_status === "approved";

  const handleDispatch = (orgs: { org_id: string; score: number | null }[], message: string) => {
    dispatch.mutate(
      { postingId: posting.id, orgs, message },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <div className="space-y-3">
      {broker && broker.status !== "cancelled" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-foreground">
              Chủ tài sản nhờ sàn chọn giúp · {BROKER_REQUEST_STATUS_LABELS[broker.status]}
            </p>
            {broker.note && <p className="mt-0.5 text-muted-foreground">“{broker.note}”</p>}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa gửi hồ sơ cho tổ chức nào.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {r.org?.name ?? "Tổ chức đấu giá"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.origin === "platform" ? "Sàn gửi" : "Chủ tài sản tự chọn"}
                    {r.org?.province ? ` · ${r.org.province}` : ""}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 font-normal">
                  {SERVICE_REQUEST_STATUS_LABELS[r.status]}
                </Badge>
              </div>

              {r.quoted_at && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {r.quote_commission_pct != null && <span>Thù lao: {r.quote_commission_pct}%</span>}
                  {r.quote_service_fee != null && <span>Phí: {formatVnd(r.quote_service_fee)}</span>}
                  {r.quote_lead_time_days != null && <span>{r.quote_lead_time_days} ngày</span>}
                </div>
              )}
              {r.status === "declined" && r.decline_reason && (
                <p className="mt-2 text-xs text-muted-foreground">Lý do: {r.decline_reason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        className="w-full gap-2"
        disabled={!approved}
        onClick={() => setOpen(true)}
      >
        <Send className="h-4 w-4" />
        {requests.length === 0 ? "Gửi cho tổ chức đấu giá" : "Gửi thêm tổ chức"}
      </Button>
      {!approved && (
        <p className="text-xs text-muted-foreground">Duyệt hồ sơ trước khi gửi cho tổ chức đấu giá.</p>
      )}

      <DispatchOrgsDialog
        posting={posting}
        alreadySentIds={alreadySent}
        open={open}
        onOpenChange={setOpen}
        onDispatch={handleDispatch}
        isPending={dispatch.isPending}
      />
    </div>
  );
}
