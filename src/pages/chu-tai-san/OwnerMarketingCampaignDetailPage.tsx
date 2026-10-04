import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, FileText, History, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CampaignAuditTab } from "@/components/asset-owner-portal/marketing/campaigns/detail/CampaignAuditTab";
import { CampaignContentTab } from "@/components/asset-owner-portal/marketing/campaigns/detail/CampaignContentTab";
import {
  CampaignDetailHeader,
  type CampaignPermissions,
} from "@/components/asset-owner-portal/marketing/campaigns/detail/CampaignDetailHeader";
import { CampaignPerformanceTab } from "@/components/asset-owner-portal/marketing/campaigns/detail/CampaignPerformanceTab";
import { DeleteCampaignDialog } from "@/components/asset-owner-portal/marketing/campaigns/detail/DeleteCampaignDialog";
import { MarkSentDialog } from "@/components/asset-owner-portal/marketing/campaigns/detail/MarkSentDialog";
import { ReviewCampaignDialog } from "@/components/asset-owner-portal/marketing/campaigns/detail/ReviewCampaignDialog";
import { MarketingCrumb } from "@/components/asset-owner-portal/marketing/campaigns/MarketingCrumb";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { useCampaignAudit, useOwnerCampaign } from "@/hooks/useOwnerMarketingCampaigns";
import { useOwnerShareLinks } from "@/hooks/useShareLinks";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerWorkspaceMembers } from "@/hooks/useOwnerWorkspaceMembers";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { hasTrackingLinks, isEditableStatus, isSelfReview, type CampaignChannel } from "@/lib/ownerMarketing/campaigns";
import { smsSenderShort } from "@/lib/ownerMarketing/composer";
import { OWNER_CAMPAIGNS_HREF } from "@/lib/ownerMarketing/routes";

const TABS = [
  { value: "noi-dung", label: "Nội dung", icon: FileText },
  { value: "lich-su", label: "Lịch sử duyệt", icon: History },
  { value: "hieu-qua", label: "Hiệu quả", icon: BarChart3 },
] as const;
const DEFAULTS = { tab: "noi-dung" };
const ALLOWED = { tab: TABS.map((t) => t.value) } as const;

/**
 * Chi tiết chiến dịch — /chu-tai-san/truyen-thong/chien-dich/:id. Một nút chính theo
 * bước duyệt hai người; tab Nội dung · Lịch sử duyệt · Hiệu quả.
 */
const OwnerMarketingCampaignDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspaceId, workspace, isLoading: wsLoading, canIn, userId } = useOwnerWorkspace();
  const { data: campaign, isLoading, isError, refetch } = useOwnerCampaign(id);
  const approved = !!campaign && hasTrackingLinks(campaign.status);
  const shareLinks = useOwnerShareLinks(id, approved);
  const links = { data: shareLinks.data?.links, isLoading: shareLinks.isLoading };
  const audit = useCampaignAudit(id);
  const { data: members } = useOwnerWorkspaceMembers(workspaceId);
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);

  const [review, setReview] = useState<"approve" | "reject" | null>(null);
  const [marking, setMarking] = useState<CampaignChannel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const personName = useCallback(
    (uid: string | null) => {
      const m = uid ? members?.find((x) => x.userId === uid) : undefined;
      return m ? m.fullName || m.email || null : null;
    },
    [members],
  );

  const perms = useMemo((): CampaignPermissions | null => {
    if (!campaign) return null;
    const b = campaign.branchId;
    return {
      edit:
        isEditableStatus(campaign.status) &&
        (canIn("truyen-thong", "update", b) || (campaign.createdBy === userId && canIn("truyen-thong", "create", b))),
      remove: campaign.status === "draft" && !campaign.submittedAt && canIn("truyen-thong", "delete", b),
      review: canIn("truyen-thong", "finalize", b),
      selfReview: isSelfReview(campaign, userId, members?.length ?? 2),
    };
  }, [campaign, canIn, userId, members]);

  if (wsLoading || isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !campaign || !perms) {
    return (
      <div className="space-y-5">
        <MarketingCrumb trail={[{ label: "Chiến dịch", to: OWNER_CAMPAIGNS_HREF }]} />
        <EmptyState
          icon={Send}
          tone={isError ? "destructive" : "muted"}
          title={isError ? "Chưa tải được chiến dịch." : "Không tìm thấy chiến dịch"}
          description={isError ? undefined : "Chiến dịch có thể đã bị xoá, hoặc thuộc đơn vị khác với đơn vị bạn đang chọn."}
          action={
            isError ? (
              <Button variant="outline" onClick={() => refetch()}>
                Thử lại
              </Button>
            ) : (
              <Button onClick={() => navigate(OWNER_CAMPAIGNS_HREF)}>Về danh sách chiến dịch</Button>
            )
          }
        />
      </div>
    );
  }

  const canShare = canIn("truyen-thong", "share", campaign.branchId);
  const senderName = workspace?.primary_name ?? "Đơn vị";

  return (
    <div className="space-y-5">
      <MarketingCrumb trail={[{ label: "Chiến dịch", to: OWNER_CAMPAIGNS_HREF }, { label: campaign.name }]} />
      <CampaignDetailHeader
        campaign={campaign}
        perms={perms}
        personName={personName}
        onReview={setReview}
        onDelete={() => setDeleting(true)}
      />

      <Tabs value={f.tab} onValueChange={(v) => setFilter("tab", v)} className="space-y-5">
        <OwnerTabsList aria-label="Mục của chiến dịch">
          {TABS.map((t) => (
            <OwnerTabsTrigger key={t.value} value={t.value} icon={t.icon}>
              {t.label}
            </OwnerTabsTrigger>
          ))}
        </OwnerTabsList>
        <TabsContent value="noi-dung" className="mt-0">
          <CampaignContentTab
            campaign={campaign}
            links={links.data}
            linksLoading={links.isLoading}
            canShare={canShare}
            senderName={senderName}
            senderShort={smsSenderShort(workspace)}
            onMarkSent={setMarking}
          />
        </TabsContent>
        <TabsContent value="lich-su" className="mt-0">
          <CampaignAuditTab entries={audit.data} isLoading={audit.isLoading} isError={audit.isError} personName={personName} />
        </TabsContent>
        <TabsContent value="hieu-qua" className="mt-0">
          <CampaignPerformanceTab campaignId={campaign.id} approved={approved} links={links.data} isLoading={links.isLoading} />
        </TabsContent>
      </Tabs>

      <ReviewCampaignDialog campaign={campaign} mode={review} onOpenChange={(v) => !v && setReview(null)} />
      <MarkSentDialog campaignId={campaign.id} channel={marking} onOpenChange={(v) => !v && setMarking(null)} />
      <DeleteCampaignDialog campaign={deleting ? campaign : null} onOpenChange={setDeleting} />
    </div>
  );
};

export default OwnerMarketingCampaignDetailPage;
