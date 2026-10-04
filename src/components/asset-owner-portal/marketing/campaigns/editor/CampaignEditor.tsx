import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCampaignFactsPreview, useSaveCampaignDraft, useSubmitCampaign } from "@/hooks/useOwnerMarketingCampaigns";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useShareableAssets } from "@/hooks/useShareLinks";
import { assetKey } from "@/lib/shareLinks/assets";
import {
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_NAME_MIN,
  CAMPAIGN_NOTES_MAX,
  EMPTY_DRAFTS,
  editorProgress,
  type CampaignChannel,
  type CampaignDrafts,
  type CampaignRow,
  type EditorSection,
} from "@/lib/ownerMarketing/campaigns";
import { smsSenderShort, suggestDrafts } from "@/lib/ownerMarketing/composer";
import { ownerCampaignHref } from "@/lib/ownerMarketing/routes";
import { CampaignAssetsSection } from "./CampaignAssetsSection";
import { CampaignChannelsSection } from "./CampaignChannelsSection";
import { CampaignContentSection } from "./CampaignContentSection";
import { CampaignSummaryPanel } from "./CampaignSummaryPanel";
import { EditorSectionCard } from "./EditorSectionCard";

interface CampaignEditorProps {
  /** null = tạo mới. */
  campaign: CampaignRow | null;
  /** Tin chọn sẵn khi mở từ chỗ khác (?tai-san=). */
  initialListingIds?: string[];
  /** Hồ sơ số hoá chọn sẵn (?ho-so=). */
  initialPostingIds?: string[];
}

const Req = () => <span className="text-destructive">*</span>;

const isBlank = (d: CampaignDrafts, c: CampaignChannel) =>
  c === "email" ? !d.email.subject.trim() && !d.email.body.trim() : !d[c].body.trim();

/**
 * Trình soạn chiến dịch (bố cục như AdminCampaignEditor): 4 thẻ mục + cột tóm tắt dính.
 * Dữ kiện phiên chỉ HIỂN THỊ (server dựng snapshot khi lưu / gửi duyệt) — form không có
 * ô nào cho giá, hạn, tổ chức.
 */
export function CampaignEditor({ campaign, initialListingIds = [], initialPostingIds = [] }: CampaignEditorProps) {
  const navigate = useNavigate();
  const { workspace, canIn } = useOwnerWorkspace();
  const save = useSaveCampaignDraft();
  const submit = useSubmitCampaign();

  const [name, setName] = useState(campaign?.name ?? "");
  const [notes, setNotes] = useState(campaign?.notes ?? "");
  const [assetKeys, setAssetKeys] = useState<string[]>(
    () =>
      campaign?.assetKeys ?? [
        ...initialListingIds.map((id) => assetKey("listing", id)),
        ...initialPostingIds.map((id) => assetKey("posting", id)),
      ],
  );
  const [channels, setChannels] = useState<CampaignChannel[]>(campaign?.channels ?? ["zalo", "sms"]);
  const [drafts, setDrafts] = useState<CampaignDrafts>(campaign?.drafts ?? EMPTY_DRAFTS);

  const assets = useShareableAssets(true);
  const action = campaign ? "update" : "create";
  const options = useMemo(
    () => assets.assets.filter((o) => canIn("truyen-thong", action, o.branchId) || assetKeys.includes(o.key)),
    [assets.assets, canIn, action, assetKeys],
  );
  const facts = useCampaignFactsPreview(assetKeys);
  const senderShort = useMemo(() => smsSenderShort(workspace), [workspace]);

  // Kênh còn trống ⇒ điền gợi ý khi dữ kiện về hoặc khi thêm kênh. Không phụ thuộc
  // drafts: người dùng xoá trắng một ô thì không bị điền lại.
  useEffect(() => {
    if (!facts.data?.assets.length) return;
    const suggestion = suggestDrafts(facts.data);
    setDrafts((prev) => {
      let next = prev;
      for (const c of channels) if (isBlank(prev, c)) next = { ...next, [c]: suggestion[c] };
      return next;
    });
  }, [facts.data, channels]);

  const { done, progress } = editorProgress({ name, assetKeys, channels, drafts });

  const refs: Record<EditorSection, RefObject<HTMLElement>> = {
    info: useRef<HTMLElement>(null),
    assets: useRef<HTMLElement>(null),
    channels: useRef<HTMLElement>(null),
    content: useRef<HTMLElement>(null),
  };
  const [flash, setFlash] = useState<EditorSection | null>(null);
  const jump = (s: EditorSection) => {
    refs[s].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlash(s);
    window.setTimeout(() => setFlash(null), 1200);
  };

  const busy = save.isPending || submit.isPending;

  const persist = async (): Promise<string | null> => {
    if (!done.info) {
      toast.error(`Tên chiến dịch cần từ ${CAMPAIGN_NAME_MIN} ký tự`);
      jump("info");
      return null;
    }
    if (!done.assets) {
      toast.error("Chọn ít nhất một tài sản");
      jump("assets");
      return null;
    }
    try {
      return await save.mutateAsync({ id: campaign?.id ?? null, name, notes, assetKeys, channels, drafts });
    } catch {
      return null; // toast ở hook
    }
  };

  const handleSave = async () => {
    const id = await persist();
    if (!id) return;
    toast.success("Đã lưu nháp");
    navigate(ownerCampaignHref(id));
  };

  const handleSubmit = async () => {
    const missing = (Object.keys(done) as EditorSection[]).find((s) => !done[s]);
    if (missing) {
      toast.error("Còn mục chưa hoàn thiện");
      jump(missing);
      return;
    }
    const id = await persist();
    if (!id) return;
    try {
      await submit.mutateAsync(id);
    } catch {
      // Lưu được nhưng chưa gửi duyệt — vẫn đưa về trang chi tiết để gửi lại.
    }
    navigate(ownerCampaignHref(id));
  };

  return (
    <div className="grid gap-[22px] lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <EditorSectionCard ref={refs.info} index={1} title="Thông tin" done={done.info} flash={flash === "info"}>
          <div className="space-y-1.5">
            <Label htmlFor="mkt-campaign-name">
              Tên chiến dịch <Req />
            </Label>
            <Input
              id="mkt-campaign-name"
              maxLength={CAMPAIGN_NAME_MAX}
              placeholder="VD: Đẩy kho bãi Quảng Ninh — tháng 10"
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Chỉ người trong đơn vị thấy tên này; cũng dùng làm nhãn link Hồ sơ online.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mkt-campaign-notes">Ghi chú cho người duyệt</Label>
            <Textarea
              id="mkt-campaign-notes"
              rows={2}
              maxLength={CAMPAIGN_NOTES_MAX}
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </EditorSectionCard>

        <EditorSectionCard
          ref={refs.assets}
          index={2}
          title="Tài sản"
          description="Hồ sơ số hoá đã duyệt và tin đang đăng trên sàn của đơn vị"
          done={done.assets}
          flash={flash === "assets"}
        >
          <CampaignAssetsSection
            options={options}
            isLoading={assets.isLoading}
            isError={assets.isError}
            selected={assetKeys}
            onChange={setAssetKeys}
            disabled={busy}
          />
        </EditorSectionCard>

        <EditorSectionCard ref={refs.channels} index={3} title="Kênh" done={done.channels} flash={flash === "channels"}>
          <CampaignChannelsSection selected={channels} onChange={setChannels} disabled={busy} />
        </EditorSectionCard>

        <EditorSectionCard
          ref={refs.content}
          index={4}
          title="Nội dung"
          description="Bạn viết phần mô tả; giá, hạn và tổ chức đấu giá lấy từ thông báo đấu giá"
          done={done.content}
          flash={flash === "content"}
        >
          <CampaignContentSection
            channels={channels}
            drafts={drafts}
            onChange={setDrafts}
            facts={facts.data}
            factsLoading={assetKeys.length > 0 && facts.isLoading}
            factsError={facts.isError}
            senderShort={senderShort}
            disabled={busy}
          />
        </EditorSectionCard>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="outline" className="gap-1.5" disabled={busy} onClick={handleSave}>
            {save.isPending && !submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={1.5} />}
            Lưu nháp
          </Button>
          <Button className="gap-1.5" disabled={busy} onClick={handleSubmit}>
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.5} />}
            Gửi duyệt
          </Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <CampaignSummaryPanel
          done={done}
          progress={progress}
          onJump={jump}
          rejectedReason={campaign?.status === "rejected" ? campaign.rejectedReason : null}
        />
      </aside>
    </div>
  );
}
