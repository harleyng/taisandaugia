import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Megaphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { ShareLinksSummaryTab } from "@/components/asset-owner-portal/marketing/share-links/ShareLinksSummaryTab";
import { MarketingOrdersTab } from "@/components/asset-owner-portal/marketing/orders/MarketingOrdersTab";
import { CampaignsTab } from "@/components/asset-owner-portal/marketing/campaigns/CampaignsTab";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { MKT_CHANNELS } from "@/lib/ownerMarketing/links";
import { BRANCH_FILTER_ALL, CAMPAIGN_TABS, type CampaignTab } from "@/lib/ownerMarketing/campaigns";
import { FILTER_ALL, KIND_FILTERS, SOURCE_FILTERS, STATE_FILTERS } from "@/lib/shareLinks/filters";
import {
  OWNER_AD_PERFORMANCE_HREF,
  OWNER_MARKETING_DATA_FLOW_HREF,
  OWNER_MARKETING_TABS,
  type OwnerMarketingTab,
} from "@/lib/ownerMarketing/routes";

// Không có thanh tab trong trang: chọn mục bằng 3 mục con của "Truyền thông" ở sidebar
// (?tab=). Tiêu đề trang = tên mục đang mở.
const SUBTITLES: Record<OwnerMarketingTab, string> = {
  "chien-dich": "Soạn nội dung quảng bá, duyệt rồi gửi qua kênh riêng của đơn vị.",
  "giao-viec": "Đặt sàn làm hộ việc quảng bá tài sản và theo dõi tiến độ từng đơn.",
  "link-theo-doi": "Mọi link Hồ sơ online của đơn vị — gửi riêng, từ chiến dịch, của hồ sơ số hoá lẫn tin trên sàn.",
};

const DEFAULTS = {
  tab: "chien-dich",
  // Tab Link theo dõi (tổng hợp link Hồ sơ online).
  q: "",
  kenh: FILTER_ALL,
  nguon: FILTER_ALL,
  loai: FILTER_ALL,
  "tinh-trang": FILTER_ALL,
  "tai-san": "",
  // Tab Chiến dịch có bộ lọc riêng — không dùng chung ô tìm với tab Link theo dõi.
  "trang-thai": "tat-ca",
  tim: "",
  "chi-nhanh": BRANCH_FILTER_ALL,
};
const ALLOWED = {
  tab: OWNER_MARKETING_TABS.map((t) => t.value),
  kenh: [FILTER_ALL, ...MKT_CHANNELS],
  nguon: SOURCE_FILTERS.map((o) => o.value),
  loai: KIND_FILTERS.map((o) => o.value),
  "tinh-trang": STATE_FILTERS.map((o) => o.value),
  "trang-thai": CAMPAIGN_TABS,
} as const;

/**
 * /chu-tai-san/truyen-thong — đưa tài sản tới đúng người mua và đo kênh nào mang
 * khách về (docs/owner-marketing-plan.md). Mặc định chạy ở "chế độ xuất": đơn vị gửi
 * qua kênh RIÊNG, sàn chỉ đếm lượt mở ẩn danh.
 */
export default function OwnerMarketingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { workspaceId, isLoading } = useOwnerWorkspace();
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);

  // Link cũ tới tab "Hiệu quả" (đã tách sang "Hiệu quả quảng cáo" ở nhóm Phân tích) — giữ kỳ / tài sản.
  if (params.get("tab") === "hieu-qua") {
    const next = new URLSearchParams(params);
    next.delete("tab");
    const qs = next.toString();
    return <Navigate to={`${OWNER_AD_PERFORMANCE_HREF}${qs ? `?${qs}` : ""}`} replace />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <OwnerNoWorkspaceState icon={Megaphone}>
        <EmptyState
          icon={Megaphone}
          title="Chưa có không gian làm việc"
          description="Truyền thông dành cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const tab = f.tab as OwnerMarketingTab;
  const title = OWNER_MARKETING_TABS.find((t) => t.value === tab)?.label ?? "Truyền thông";

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title={title}
        subtitle={SUBTITLES[tab]}
        actions={
          <Button variant="outline" onClick={() => navigate(OWNER_MARKETING_DATA_FLOW_HREF)}>
            <ShieldCheck className="mr-2 h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Dữ liệu đi đâu
          </Button>
        }
      />

      {tab === "chien-dich" && (
        <CampaignsTab
          status={f["trang-thai"] as CampaignTab}
          q={f.tim}
          branch={f["chi-nhanh"]}
          onFilter={setFilter}
        />
      )}
      {tab === "giao-viec" && <MarketingOrdersTab />}
      {tab === "link-theo-doi" && (
        <ShareLinksSummaryTab
          filters={{
            q: f.q,
            channel: f.kenh,
            source: f.nguon,
            kind: f.loai,
            state: f["tinh-trang"],
            branch: f["chi-nhanh"],
            asset: f["tai-san"],
          }}
          onFilter={setFilter}
        />
      )}
    </div>
  );
}
