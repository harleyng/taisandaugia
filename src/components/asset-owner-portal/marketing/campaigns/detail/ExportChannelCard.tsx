import { CheckCircle2, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { copyText } from "@/lib/outreach/labels";
import { formatShareDateTime } from "@/lib/ownerReportShare";
import { CAMPAIGN_CHANNEL_META, type CampaignChannel } from "@/lib/ownerMarketing/campaigns";
import type { ChannelText } from "@/lib/ownerMarketing/composer";

interface ExportChannelCardProps {
  channel: CampaignChannel;
  text: ChannelText;
  /** Chỉ khi chiến dịch đã duyệt (có link thật). */
  exportable: boolean;
  /** Tiêu đề phụ cho từng tin SMS (tên tài sản). */
  itemLabels?: string[];
  sentAt: string | null;
  canShare: boolean;
  onMarkSent: () => void;
}

const copy = async (text: string, what: string) => {
  if (await copyText(text)) toast.success(`Đã sao chép ${what}`);
  else toast.error("Trình duyệt chặn sao chép — hãy bôi đen nội dung để chép.");
};

/** Nội dung một kênh, link Hồ sơ online đã ghép sẵn: sao chép · đánh dấu đã gửi. */
export function ExportChannelCard({ channel, text, exportable, itemLabels, sentAt, canShare, onMarkSent }: ExportChannelCardProps) {
  const meta = CAMPAIGN_CHANNEL_META[channel];
  const allowCopy = exportable && canShare;

  return (
    <SectionCard
      title={meta.label}
      icon={meta.icon}
      tone={sentAt ? "success" : "primary"}
      actions={
        sentAt ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
            Đã gửi {formatShareDateTime(sentAt)}
          </span>
        ) : (
          exportable &&
          canShare && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onMarkSent}>
              <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
              Đánh dấu đã gửi
            </Button>
          )
        )
      }
    >
      {text.subject !== undefined && (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-muted/40 px-3.5 py-2.5">
          <p className="min-w-0 text-sm">
            <span className="text-muted-foreground">Tiêu đề: </span>
            <span className="font-medium text-foreground">{text.subject || "—"}</span>
          </p>
          {allowCopy && text.subject && (
            <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => copy(text.subject!, "tiêu đề")}>
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
              Sao chép
            </Button>
          )}
        </div>
      )}
      <div className="space-y-2.5">
        {text.texts.map((t, i) => (
          <div key={i} className="space-y-1.5">
            {itemLabels?.[i] && (
              <p className="truncate text-xs font-medium text-muted-foreground" title={itemLabels[i]}>
                {itemLabels[i]} · {t.length} ký tự
              </p>
            )}
            <div className="relative">
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-muted/40 px-3.5 py-3 pr-12 font-sans text-[13px] leading-relaxed text-foreground">
                {t}
              </pre>
              {allowCopy && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sao chép nội dung"
                  title="Sao chép nội dung"
                  className="absolute right-1.5 top-1.5 h-8 w-8 text-muted-foreground"
                  onClick={() => copy(t, "nội dung")}
                >
                  <Copy className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
