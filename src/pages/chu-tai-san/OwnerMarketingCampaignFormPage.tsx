import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignEditor } from "@/components/asset-owner-portal/marketing/campaigns/editor/CampaignEditor";
import { MarketingCrumb } from "@/components/asset-owner-portal/marketing/campaigns/MarketingCrumb";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { useOwnerCampaign } from "@/hooks/useOwnerMarketingCampaigns";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { isEditableStatus } from "@/lib/ownerMarketing/campaigns";
import { OWNER_CAMPAIGNS_HREF, OWNER_MARKETING_HREF, ownerCampaignHref } from "@/lib/ownerMarketing/routes";

/**
 * "Tạo chiến dịch" — /chu-tai-san/truyen-thong/chien-dich/moi(?tai-san=<listing id>)(?ho-so=<posting id>)
 * "Sửa chiến dịch" — /chu-tai-san/truyen-thong/chien-dich/:id/sua
 * Trang lo tải + chặn cửa; form ở CampaignEditor. RPC owner_mkt_save_draft là cổng thật.
 */
const OwnerMarketingCampaignFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { workspaceId, isLoading: wsLoading, can, canIn, userId } = useOwnerWorkspace();
  const { data: campaign, isLoading, isError, refetch } = useOwnerCampaign(id);

  if (wsLoading || (id && isLoading)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-[22px] lg:grid-cols-[minmax(0,1fr)_300px]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!workspaceId) return <Navigate to={OWNER_MARKETING_HREF} replace />;

  if (id && (isError || !campaign)) {
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

  // Không có quyền / trạng thái không sửa được ⇒ về trang xem (server cũng chặn).
  const allowed = campaign
    ? isEditableStatus(campaign.status) &&
      (canIn("truyen-thong", "update", campaign.branchId) ||
        (campaign.createdBy === userId && canIn("truyen-thong", "create", campaign.branchId)))
    : can("truyen-thong", "create");
  if (!allowed) return <Navigate to={campaign ? ownerCampaignHref(campaign.id) : OWNER_CAMPAIGNS_HREF} replace />;

  const preset = params.getAll("tai-san").filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const presetPostings = params.getAll("ho-so").filter((x) => /^[0-9a-f-]{36}$/i.test(x));

  return (
    <div className="space-y-5">
      <MarketingCrumb
        trail={[
          { label: "Chiến dịch", to: OWNER_CAMPAIGNS_HREF },
          ...(campaign ? [{ label: campaign.name, to: ownerCampaignHref(campaign.id) }] : []),
        ]}
      />
      <OwnerPageHeader
        title={campaign ? "Sửa chiến dịch" : "Tạo chiến dịch"}
        subtitle="Soạn nội dung cho kênh của đơn vị; giá và hạn lấy từ thông báo đấu giá, không sửa được."
      />
      <CampaignEditor
        key={campaign?.id ?? "new"}
        campaign={campaign ?? null}
        initialListingIds={preset}
        initialPostingIds={presetPostings}
      />
    </div>
  );
};

export default OwnerMarketingCampaignFormPage;
