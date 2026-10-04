import { Check, Download, FilePen, History, Printer, Send, X, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { IconTile, type OwnerTone } from "@/components/asset-owner-portal/ui/IconTile";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import type { CampaignAuditEntry } from "@/hooks/useOwnerMarketingCampaigns";
import { formatShareDateTime } from "@/lib/ownerReportShare";
import { CAMPAIGN_CHANNEL_META, isCampaignChannel } from "@/lib/ownerMarketing/campaigns";

interface CampaignAuditTabProps {
  entries: CampaignAuditEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  personName: (userId: string | null) => string | null;
}

function describe(e: CampaignAuditEntry): { icon: LucideIcon; tone: OwnerTone; text: string } {
  const d = e.detail;
  switch (e.action) {
    case "create":
      return { icon: FilePen, tone: "muted", text: `Tạo bản nháp (${Number(d.assets ?? 0)} tài sản)` };
    case "update":
      return { icon: FilePen, tone: "muted", text: "Sửa nội dung" };
    case "submit":
      return { icon: Send, tone: "warning", text: "Gửi duyệt" };
    case "approve":
      return { icon: Check, tone: "success", text: `Duyệt — tạo ${Number(d.links ?? 0)} link Hồ sơ online` };
    case "reject":
      return { icon: X, tone: "destructive", text: "Từ chối" };
    case "mark_sent": {
      const ch = isCampaignChannel(d.channel) ? CAMPAIGN_CHANNEL_META[d.channel].label : "kênh khác";
      return { icon: Send, tone: "success", text: `Đánh dấu đã gửi qua ${ch}` };
    }
    case "export":
      return d.kind === "flyer"
        ? { icon: Printer, tone: "primary", text: "In tờ rơi" }
        : { icon: Download, tone: "primary", text: "Tải bộ tư liệu" };
    default:
      return { icon: History, tone: "muted", text: e.action };
  }
}

/** Tab "Lịch sử duyệt": nhật ký chỉ ghi thêm — ai làm gì, lúc nào. */
export function CampaignAuditTab({ entries, isLoading, isError, personName }: CampaignAuditTabProps) {
  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  return (
    <SectionCard title="Lịch sử duyệt" icon={History}>
      {isError ? (
        <EmptyState icon={History} compact tone="destructive" title="Không tải được lịch sử" description="Tải lại trang để thử lại." />
      ) : !entries?.length ? (
        <EmptyState icon={History} compact tone="muted" title="Chưa có hoạt động" />
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => {
            const m = describe(e);
            return (
              <li key={e.id} className="flex gap-3">
                <IconTile icon={m.icon} tone={m.tone} className="p-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{m.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {[personName(e.actor) ?? "Thành viên đơn vị", formatShareDateTime(e.createdAt)].join(" · ")}
                  </p>
                  {e.note && <p className="mt-1 break-words rounded-lg bg-muted/40 px-2.5 py-1.5 text-[13px] text-foreground">{e.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
