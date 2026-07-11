import { CampaignStatusBadge } from "../CampaignStatusBadge";
import type { Campaign } from "@/types/marketing";

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

export function CampaignDetailHeader({ campaign }: { campaign: Campaign }) {
  const sendTime =
    campaign.status === "sent"
      ? campaign.sent_at
      : campaign.schedule_type === "scheduled"
        ? campaign.scheduled_at
        : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h2 className="text-base font-semibold text-foreground mb-4">Thông tin chung</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2.5 gap-x-8">
        <Row label="Tên chiến dịch">{campaign.name}</Row>
        <Row label="Trạng thái">
          <CampaignStatusBadge status={campaign.status} />
        </Row>
        <Row label="Người nhận">
          {campaign.recipient_count > 0
            ? campaign.recipient_count.toLocaleString("vi-VN")
            : "—"}
        </Row>
        <Row label="Ghi chú">{campaign.notes || "Chưa có ghi chú"}</Row>
        <Row label="Thời gian gửi">{fmt(sendTime)}</Row>
      </div>
    </div>
  );
}
