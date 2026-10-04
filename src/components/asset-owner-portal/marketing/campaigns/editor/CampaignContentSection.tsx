import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import {
  CAMPAIGN_CHANNEL_META,
  DRAFT_LIMITS,
  channelDraftDone,
  type CampaignChannel,
  type CampaignDrafts,
  type FactsSnapshot,
} from "@/lib/ownerMarketing/campaigns";
import { renderChannel, suggestDrafts } from "@/lib/ownerMarketing/composer";
import { stripDiacritics } from "@/lib/outreach/sms";
import { FactsLockedBlock } from "../FactsLockedBlock";

interface CampaignContentSectionProps {
  channels: CampaignChannel[];
  drafts: CampaignDrafts;
  onChange: (drafts: CampaignDrafts) => void;
  facts: FactsSnapshot | undefined;
  factsLoading: boolean;
  factsError: boolean;
  senderShort: string;
  disabled?: boolean;
}

const Req = () => <span className="text-destructive">*</span>;

/** SMS: bỏ dấu ngay khi gõ — server từ chối tin có dấu. */
const smsClean = (v: string) => stripDiacritics(v).replace(/[^\x20-\x7E]/g, "");

/**
 * Nội dung theo kênh: khối dữ kiện KHOÁ (từ thông báo đấu giá) + phần mô tả sửa được +
 * bản xem trước đúng như khi xuất (link Hồ sơ online điền khi được duyệt).
 */
export function CampaignContentSection({
  channels,
  drafts,
  onChange,
  facts,
  factsLoading,
  factsError,
  senderShort,
  disabled,
}: CampaignContentSectionProps) {
  const [tab, setTab] = useState<CampaignChannel | undefined>(channels[0]);
  useEffect(() => {
    if (!tab || !channels.includes(tab)) setTab(channels[0]);
  }, [channels, tab]);

  if (channels.length === 0) {
    return <p className="rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground">Chọn kênh ở mục trên để soạn nội dung.</p>;
  }

  const set = <C extends CampaignChannel>(c: C, patch: Partial<CampaignDrafts[C]>) =>
    onChange({ ...drafts, [c]: { ...drafts[c], ...patch } });
  const suggest = (c: CampaignChannel) => facts && onChange({ ...drafts, [c]: suggestDrafts(facts)[c] });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">Thông tin phiên — không sửa được</p>
        {factsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
          </div>
        ) : factsError || !facts ? (
          <p className="rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            {factsError ? "Không tải được thông tin phiên. Tải lại trang để thử lại." : "Chọn tài sản để xem thông tin phiên."}
          </p>
        ) : (
          facts.assets.map((a) => <FactsLockedBlock key={a.listing_id} asset={a} />)
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CampaignChannel)} className="space-y-4">
        <OwnerTabsList aria-label="Nội dung theo kênh">
          {channels.map((c) => (
            <OwnerTabsTrigger key={c} value={c} icon={CAMPAIGN_CHANNEL_META[c].icon}>
              {CAMPAIGN_CHANNEL_META[c].label}
              {!channelDraftDone(drafts, c) && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="chưa xong" />}
            </OwnerTabsTrigger>
          ))}
        </OwnerTabsList>

        {channels.map((c) => {
          const preview = facts ? renderChannel(c, facts, drafts, null, senderShort) : null;
          return (
            <TabsContent key={c} value={c} className="mt-0 space-y-4">
              {c === "email" && (
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-email-subject">
                    Tiêu đề email <Req />
                  </Label>
                  <Input
                    id="mkt-email-subject"
                    maxLength={DRAFT_LIMITS.subject}
                    value={drafts.email.subject}
                    disabled={disabled}
                    onChange={(e) => set("email", { subject: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-end justify-between gap-2">
                  <Label htmlFor={`mkt-body-${c}`}>
                    {c === "sms" ? "Câu mở đầu SMS (không dấu)" : "Phần mô tả"} <Req />
                  </Label>
                  {facts && !disabled && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => suggest(c)}>
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Dùng gợi ý
                    </Button>
                  )}
                </div>
                {c === "sms" ? (
                  <Input
                    id="mkt-body-sms"
                    maxLength={DRAFT_LIMITS.sms}
                    value={drafts.sms.body}
                    disabled={disabled}
                    onChange={(e) => set("sms", { body: smsClean(e.target.value) })}
                  />
                ) : (
                  <Textarea
                    id={`mkt-body-${c}`}
                    rows={c === "email" ? 7 : 5}
                    maxLength={DRAFT_LIMITS[c]}
                    value={drafts[c].body}
                    disabled={disabled}
                    onChange={(e) => set(c, { body: e.target.value })}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {c === "sms"
                    ? `${drafts.sms.body.length}/${DRAFT_LIMITS.sms} ký tự. Giá, hạn và link được ghép tự động; tin vượt 160 ký tự sẽ tự rút gọn phần mô tả.`
                    : "Chỉ viết phần giới thiệu. Giá, tiền đặt trước, hạn và tổ chức đấu giá được ghép tự động từ thông báo — không ghi tên khách vay hay thông tin khoản vay."}
                </p>
              </div>
              {preview && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">Xem trước</p>
                  <div className="space-y-2">
                    {preview.subject !== undefined && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Tiêu đề: </span>
                        <span className="font-medium text-foreground">{preview.subject || "—"}</span>
                      </p>
                    )}
                    {preview.texts.map((t, i) => (
                      <pre
                        key={i}
                        className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-muted/40 px-3.5 py-3 font-sans text-[13px] leading-relaxed text-foreground"
                      >
                        {t}
                      </pre>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
