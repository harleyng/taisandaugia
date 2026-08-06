import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignStatusBadge } from "@/components/admin/marketing/CampaignStatusBadge";
import { useUserCampaignRecipients } from "@/hooks/useCampaigns";
import type { RecipientStatus } from "@/types/marketing";

const RECIPIENT_LABELS: Record<RecipientStatus, string> = {
  pending: "Chờ gửi",
  sent: "Đã gửi",
  failed: "Lỗi",
  opened: "Đã mở",
  clicked: "Đã click",
};

const RECIPIENT_CLASS: Record<RecipientStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  opened: "bg-amber-100 text-amber-700",
  clicked: "bg-green-100 text-green-700",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

interface Props {
  userId: string | null;
  /** Mở form khách hàng để gắn tài khoản khi chưa có. */
  onLinkAccount: () => void;
}

/** Chiến dịch email marketing — đi qua campaign_recipients.user_id, nên khách
 *  hàng phải gắn tài khoản trên sàn mới có dữ liệu. */
export function CustomerEmailCampaignsCard({ userId, onLinkAccount }: Props) {
  const navigate = useNavigate();
  const { data: rows, isLoading } = useUserCampaignRecipients(userId);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        Email marketing ({userId ? rows?.length ?? 0 : 0})
      </h2>

      {!userId ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Khách hàng chưa gắn tài khoản trên sàn — gắn tài khoản để xem email marketing.
          </p>
          <Button variant="outline" size="sm" onClick={onLinkAccount}>
            Gắn tài khoản
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tài khoản này chưa nằm trong chiến dịch email nào.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/admin/marketing/email/${r.campaign_id}`)}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground truncate">
                  {r.campaign?.name ?? "Chiến dịch đã xóa"}
                </span>
                {r.campaign?.subject && (
                  <span className="block text-xs text-muted-foreground truncate">
                    {r.campaign.subject}
                  </span>
                )}
              </span>
              <span className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap">
                {fmtDate(r.sent_at ?? r.campaign?.sent_at ?? null)}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${RECIPIENT_CLASS[r.status]}`}
              >
                {RECIPIENT_LABELS[r.status]}
              </span>
              {r.campaign && <CampaignStatusBadge status={r.campaign.status} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
