import { Skeleton } from "@/components/ui/skeleton";
import { useCampaignRecipients } from "@/hooks/useCampaigns";
import type { Campaign, RecipientStatus } from "@/types/marketing";

const RECIPIENT_STATUS_LABELS: Record<RecipientStatus, string> = {
  pending: "Chờ gửi",
  sent: "Đã gửi",
  failed: "Thất bại",
  opened: "Đã mở",
  clicked: "Đã click",
};

const RECIPIENT_STATUS_CLASS: Record<RecipientStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  opened: "bg-green-100 text-green-700",
  clicked: "bg-emerald-100 text-emerald-700",
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1">
        {value.toLocaleString("vi-VN")}
      </p>
    </div>
  );
}

export function StatsTab({ campaign }: { campaign: Campaign }) {
  const { data: recipients, isLoading } = useCampaignRecipients(campaign.id);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Đã đưa vào danh sách" value={campaign.recipient_count} />
        <Stat label="Đã gửi" value={campaign.sent_count} />
        <Stat label="Đã mở" value={campaign.opened_count} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Danh sách người nhận</h3>
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/70">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Tên
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3" colSpan={3}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !recipients || recipients.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      Chưa có người nhận. Danh sách được tạo khi gửi chiến dịch.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-foreground">{r.email}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RECIPIENT_STATUS_CLASS[r.status]}`}
                        >
                          {RECIPIENT_STATUS_LABELS[r.status]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
