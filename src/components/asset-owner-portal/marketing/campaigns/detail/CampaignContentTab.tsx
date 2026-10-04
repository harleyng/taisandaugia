import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileText, Info, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { useCampaignFactsPreview, useLogCampaignExport } from "@/hooks/useOwnerMarketingCampaigns";
import type { PostingShareLink } from "@/lib/postingShare/types";
import { printFlyer } from "@/lib/outreach/printFlyer";
import { hasTrackingLinks, isExportableStatus, type CampaignChannel, type CampaignRow } from "@/lib/ownerMarketing/campaigns";
import { factsDiffer, renderChannel, renderFlyer } from "@/lib/ownerMarketing/composer";
import { downloadMediaKit, linkMapsByChannel } from "@/lib/ownerMarketing/mediaKit";
import { FactsLockedBlock } from "../FactsLockedBlock";
import { ExportChannelCard } from "./ExportChannelCard";

interface CampaignContentTabProps {
  campaign: CampaignRow;
  links: PostingShareLink[] | undefined;
  linksLoading: boolean;
  canShare: boolean;
  senderName: string;
  senderShort: string;
  onMarkSent: (channel: CampaignChannel) => void;
}

/**
 * Tab "Nội dung". Trước khi duyệt: xem trước với chỗ giữ link. Đã duyệt: văn bản từng
 * kênh đã ghép link Hồ sơ online riêng, sao chép / tải bộ tư liệu / in tờ rơi / đánh dấu đã gửi.
 * Đã kết thúc: vẫn hiện nội dung kèm link đã gửi, chỉ đọc.
 */
export function CampaignContentTab({
  campaign: c,
  links,
  linksLoading,
  canShare,
  senderName,
  senderShort,
  onMarkSent,
}: CampaignContentTabProps) {
  const exportable = isExportableStatus(c.status);
  const linked = hasTrackingLinks(c.status);
  const logExport = useLogCampaignExport();
  const [kitBusy, setKitBusy] = useState(false);
  const maps = useMemo(() => (linked && links ? linkMapsByChannel(links) : null), [linked, links]);

  // Dữ kiện có đổi kể từ lúc gửi duyệt không (vd. phiên mới, giá mới)?
  const current = useCampaignFactsPreview(c.assetKeys, c.status !== "draft");
  const stale = !!current.data && c.facts.assets.length > 0 && factsDiffer(c.facts, current.data);

  const downloadKit = async () => {
    if (!links) return;
    setKitBusy(true);
    try {
      const r = await downloadMediaKit(c, links, senderName, senderShort);
      logExport.mutate({ id: c.id, kind: "kit" });
      toast.success("Đã tải bộ tư liệu", {
        description: r.missedImages ? `${r.missedImages} ảnh không tải được — đã bỏ qua, nội dung chữ vẫn đủ.` : undefined,
      });
    } catch {
      toast.error("Không tạo được bộ tư liệu. Vui lòng thử lại.");
    } finally {
      setKitBusy(false);
    }
  };

  const printKit = () => {
    const flyerLinks = maps ? (maps.zalo ?? maps[c.channels[0]] ?? null) : null;
    if (printFlyer(renderFlyer(c.name, senderName, c.facts, c.drafts, flyerLinks), c.name)) {
      logExport.mutate({ id: c.id, kind: "flyer" });
    } else {
      toast.error("Trình duyệt chặn cửa sổ in.");
    }
  };

  return (
    <div className="space-y-4">
      {stale && (
        <div className="flex gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} />
          <p>
            Thông tin phiên đã thay đổi sau khi gửi duyệt (giá, hạn hoặc phiên mới). Nội dung bên dưới vẫn theo bản đã{" "}
            {exportable ? "duyệt" : "gửi"} — {exportable ? "tạo chiến dịch mới" : "từ chối để người soạn lưu lại"} nếu cần cập nhật.
          </p>
        </div>
      )}

      {exportable ? (
        canShare && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 shadow-card">
            <p className="text-sm text-muted-foreground">
              Mỗi kênh có link Hồ sơ online riêng cho từng tài sản. Gửi xong nhớ “Đánh dấu đã gửi”.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5" onClick={printKit}>
                <Printer className="h-4 w-4" strokeWidth={1.5} />
                In tờ rơi
              </Button>
              <Button className="gap-1.5" disabled={kitBusy || !links} onClick={downloadKit}>
                {kitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={1.5} />}
                Tải bộ tư liệu
              </Button>
            </div>
          </div>
        )
      ) : linked ? (
        <p className="flex gap-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
          Chiến dịch đã kết thúc. Nội dung bên dưới giữ nguyên link Hồ sơ online đã gửi; lượt mở xem ở tab Hiệu quả.
        </p>
      ) : (
        <p className="flex gap-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
          Bản xem trước. Link Hồ sơ online được tạo và ghép vào nội dung khi chiến dịch được duyệt.
        </p>
      )}

      <SectionCard title="Thông tin phiên" icon={FileText}>
        <div className="space-y-2">
          {c.facts.assets.length ? (
            c.facts.assets.map((a) => <FactsLockedBlock key={a.listing_id} asset={a} />)
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có thông tin — lưu nháp để sàn lấy từ thông báo đấu giá.</p>
          )}
        </div>
      </SectionCard>

      {linked && linksLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
        </div>
      ) : (
        c.channels.map((ch) => (
          <ExportChannelCard
            key={ch}
            channel={ch}
            text={renderChannel(ch, c.facts, c.drafts, maps ? (maps[ch] ?? {}) : null, senderShort)}
            itemLabels={ch === "sms" ? c.facts.assets.map((a) => a.title) : undefined}
            exportable={exportable}
            sentAt={c.sentChannels[ch] ?? null}
            canShare={canShare}
            onMarkSent={() => onMarkSent(ch)}
          />
        ))
      )}
    </div>
  );
}
