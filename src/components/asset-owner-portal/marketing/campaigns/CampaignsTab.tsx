import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { useOwnerCampaigns } from "@/hooks/useOwnerMarketingCampaigns";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerWorkspaceMembers, useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import {
  BRANCH_FILTER_ALL,
  CAMPAIGN_TABS,
  CAMPAIGN_TAB_LABEL,
  campaignTabCounts,
  filterCampaigns,
  type CampaignTab,
} from "@/lib/ownerMarketing/campaigns";
import { NEW_CAMPAIGN_HREF } from "@/lib/ownerMarketing/routes";
import { CampaignsTable } from "./CampaignsTable";

interface CampaignsTabProps {
  status: CampaignTab;
  q: string;
  branch: string;
  onFilter: (key: "trang-thai" | "tim" | "chi-nhanh", value: string) => void;
}

/**
 * Tab "Chiến dịch": soạn nội dung theo kênh từ thông tin phiên, trình duyệt, rồi xuất
 * kèm link Hồ sơ online. Tab "Chờ duyệt" tô vàng khi có việc cho người duyệt.
 */
export function CampaignsTab({ status, q, branch, onFilter }: CampaignsTabProps) {
  const navigate = useNavigate();
  const { workspaceId, can } = useOwnerWorkspace();
  const { rows, isLoading, isError, refetch } = useOwnerCampaigns();
  const { data: members } = useOwnerWorkspaceMembers(workspaceId);
  const { data: branches } = useWorkspaceBranchOptions(workspaceId);

  const counts = useMemo(() => campaignTabCounts(rows), [rows]);
  const visible = useMemo(() => filterCampaigns(rows, status, q, branch), [rows, status, q, branch]);
  const personName = useCallback(
    (userId: string | null) => {
      const m = userId ? members?.find((x) => x.userId === userId) : undefined;
      return m ? m.fullName || m.email || null : null;
    },
    [members],
  );

  const canFinalize = can("truyen-thong", "finalize");
  const createButton = can("truyen-thong", "create") && (
    <Button className="gap-1.5" onClick={() => navigate(NEW_CAMPAIGN_HREF)}>
      <Plus className="h-4 w-4" strokeWidth={1.5} />
      Tạo chiến dịch
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl bg-card shadow-card">
        <EmptyState
          icon={AlertCircle}
          tone="destructive"
          title="Không tải được danh sách chiến dịch"
          description="Vui lòng thử lại."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-card shadow-card">
        <EmptyState
          icon={Send}
          title="Chưa có chiến dịch nào"
          description="Chọn tài sản, sàn điền sẵn giá và hạn từ thông báo đấu giá; bạn viết phần mô tả, trình duyệt rồi gửi qua kênh của đơn vị kèm link Hồ sơ online."
          action={createButton || undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OwnerFilterBar
        tabs={
          <OwnerTabBar
            aria-label="Lọc chiến dịch theo trạng thái"
            value={status}
            onValueChange={(v) => onFilter("trang-thai", v)}
            items={CAMPAIGN_TABS.map((t) => ({
              value: t,
              label: CAMPAIGN_TAB_LABEL[t],
              count: counts[t],
              attention: t === "cho-duyet" && canFinalize,
            }))}
          />
        }
      >
        <OwnerSearchInput
          value={q}
          onValueChange={(v) => onFilter("tim", v)}
          placeholder="Tìm theo tên, tài sản"
          aria-label="Tìm chiến dịch theo tên hoặc tài sản"
        />
        {(branches?.length ?? 0) > 1 && (
          <OwnerFilterSelect label="Chi nhánh" value={branch} onValueChange={(v) => onFilter("chi-nhanh", v)}>
            <SelectItem value={BRANCH_FILTER_ALL}>Tất cả</SelectItem>
            {branches!.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
        )}
        {createButton}
      </OwnerFilterBar>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={Send}
            compact
            title={status === "cho-duyet" ? "Không có chiến dịch nào chờ duyệt" : "Không có chiến dịch nào khớp"}
            description={status === "cho-duyet" ? undefined : "Thử từ khoá, trạng thái hoặc chi nhánh khác."}
          />
        </div>
      ) : (
        <CampaignsTable rows={visible} personName={personName} />
      )}
    </div>
  );
}
