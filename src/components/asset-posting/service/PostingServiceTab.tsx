import { useEffect, useState, type ReactNode } from "react";
import { Info, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { useDossierItems, useSyncDossierItems } from "@/hooks/useDossierItems";
import { dossierDraftDefaults, type DraftSource } from "@/lib/dossier/draft";
import type { DossierKind } from "@/lib/dossier/types";
import type { AssetPosting } from "@/types/asset-posting";
import { usePostingCanWrite } from "../postingAccess";
import { PartnerScopeProvider } from "../partners/PartnerScope";
import { OwnPartnerForm } from "./OwnPartnerForm";
import { ServiceSourceChoice, type ServiceSource } from "./ServiceSourceChoice";

const TITLE: Record<DossierKind, string> = {
  legal: "Pháp lý",
  auction: "Tổ chức đấu giá",
  appraisal: "Thẩm định giá",
  authentication: "Giám định",
};

const PARTNER_TITLE: Record<DossierKind, string> = {
  legal: "Ý kiến pháp lý của đối tác",
  auction: "Tổ chức đấu giá của bạn",
  appraisal: "Kết quả thẩm định giá của đối tác",
  authentication: "Kết quả giám định của đối tác",
};

interface PostingServiceTabProps {
  posting: AssetPosting;
  kind: DossierKind;
  /** Nội dung nhánh "Dịch vụ của sàn" (tư vấn pháp lý / ký gửi + tư vấn đấu giá / thẩm định giá / giám định). */
  platform: ReactNode;
  /** Đã có yêu cầu dịch vụ của sàn ⇒ chưa lưu lựa chọn thì mở sẵn nhánh sàn; đổi sang đối tác riêng thì nhắc. */
  hasPlatformActivity: boolean;
  /** Lý do khoá "Đối tác riêng" (vd. bắt buộc giám định qua sàn). */
  externalLockedReason?: string | null;
}

/**
 * Khung chung của 4 tab dịch vụ (Pháp lý · Đấu giá · Thẩm định giá · Giám định): chọn "Đối tác riêng" hay
 * "Dịch vụ của sàn". Đổi sang sàn lưu ngay; đối tác riêng lưu khi bấm Lưu trong form.
 * Sửa được cả sau khi ký hợp đồng (vd. cập nhật chứng thư) — trừ hồ sơ đã huỷ.
 */
export function PostingServiceTab({ posting, kind, platform, hasPlatformActivity, externalLockedReason }: PostingServiceTabProps) {
  const canWrite = usePostingCanWrite() && posting.status !== "cancelled";
  const { data: items = [], isLoading } = useDossierItems(posting.id);
  const sync = useSyncDossierItems();
  const row = items.find((r) => r.kind === kind);
  const savedSource: DraftSource =
    row?.source === "external_partner" || row?.source === "marketplace"
      ? row.source
      : hasPlatformActivity || externalLockedReason
        ? "marketplace"
        : "";
  const [source, setSource] = useState<DraftSource>(savedSource);
  useEffect(() => setSource(savedSource), [savedSource]);

  const choose = (v: ServiceSource) => {
    setSource(v);
    // Sàn: ghi nguồn ngay (không có trường nào để nhập). Đối tác riêng: chờ form đủ rồi Lưu.
    if (v === "marketplace" && row?.source !== "marketplace") {
      sync.mutate({
        postingId: posting.id,
        draft: { ...dossierDraftDefaults, [kind]: { ...dossierDraftDefaults[kind], source: "marketplace" } },
        kinds: [kind],
        silent: true,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
      </div>
    );
  }

  return (
    <PartnerScopeProvider workspaceId={posting.workspace_id}>
      <div className="space-y-4">
        <SectionCard title={TITLE[kind]}>
          <div className="space-y-3">
            <ServiceSourceChoice
              kind={kind}
              value={source}
              onChange={choose}
              externalLockedReason={externalLockedReason}
              disabled={!canWrite || sync.isPending}
            />
            {source === "external_partner" && hasPlatformActivity && (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                Yêu cầu dịch vụ của sàn đã gửi vẫn tiếp tục — chọn lại “Dịch vụ của sàn” để theo dõi.
              </p>
            )}
            {!source && (
              <p className="text-xs text-muted-foreground">Chưa chọn — bạn có thể quyết định bất cứ lúc nào.</p>
            )}
          </div>
        </SectionCard>

        {source === "external_partner" && (
          <SectionCard title={PARTNER_TITLE[kind]}>
            <OwnPartnerForm kind={kind} postingId={posting.id} items={items} readOnly={!canWrite} />
          </SectionCard>
        )}
        {source === "marketplace" && platform}
      </div>
    </PartnerScopeProvider>
  );
}
