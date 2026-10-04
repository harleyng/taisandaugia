import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Loader2 } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { AuthenticationOutcomeNotice } from "@/components/authentication/AuthenticationOutcomeNotice";
import { usePostingDetail } from "@/hooks/useAssetPosting";
import { useOwnerConsignmentSummary, usePostingContracts } from "@/hooks/useConsignmentContract";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { ownerConsignmentPath } from "@/lib/consignment/ownerConsignment";
import { digitizeStatusOf, type DigitizeStage } from "@/lib/asset-posting/digitizeStatus";
import { ownerPostingWizardPath } from "@/lib/asset-posting/paths";
import { PostingAccessProvider } from "./postingAccess";
import { postingCompletionPct } from "./wizardSchema";
import { PostingDetailHeader } from "./detail/PostingDetailHeader";
import { ExportPostingPdfButton } from "./detail/ExportPostingPdfButton";
import { PostingFlowStrip } from "./detail/PostingFlowStrip";
import { PostingOverviewTab } from "./detail/PostingOverviewTab";
import { PostingOnlineTab } from "./detail/PostingOnlineTab";
import { useLegalPendingCount } from "./detail/useLegalPendingCount";
import {
  PostingAuctionServiceTab,
  PostingAuthenticationServiceTab,
  PostingLegalServiceTab,
  PostingValuationServiceTab,
} from "./detail/PostingServiceTabs";

type PostingTab = "thong-tin" | "ho-so-online" | "phap-ly" | "dau-gia" | "tham-dinh" | "giam-dinh";

const TABS: { value: PostingTab; label: string }[] = [
  { value: "thong-tin", label: "Thông tin tài sản" },
  { value: "ho-so-online", label: "Hồ sơ online" },
  { value: "dau-gia", label: "Đấu giá" },
  { value: "phap-ly", label: "Pháp lý" },
  { value: "tham-dinh", label: "Thẩm định giá" },
  { value: "giam-dinh", label: "Giám định" },
];

/** Link cũ: tab "Tư vấn đấu giá" nay là "Đấu giá"; tab "Hồ sơ" (điểm tin cậy) đã bỏ. */
const LEGACY_TAB: Record<string, PostingTab> = { "tu-van-dau-gia": "dau-gia", "ho-so": "thong-tin" };

/** Còn sửa được bằng wizard: trước khi gửi cho bất kỳ tổ chức nào (sửa sau đó là đổi nội dung đã được báo giá). */
const EDITABLE: readonly DigitizeStage[] = ["draft", "review", "rejected", "ready"];

/** Có trang ký gửi để mở (menu ⋯). */
const HAS_CONSIGNMENT: readonly DigitizeStage[] = ["ready", "quoting", "resend", "choose", "contract", "signed"];

interface AssetPostingDetailProps {
  postingId: string;
  onBack: () => void;
}

/**
 * Chi tiết một hồ sơ số hoá (thiết kế "So Hoa Tai San - Danh sach & Chi tiet"): đầu
 * trang + dải tiến trình 4 bước với MỘT việc tiếp theo, rồi 6 tab: Thông tin · Hồ sơ online · Đấu giá ·
 * Pháp lý · Thẩm định giá · Giám định (3 dịch vụ chọn "Đối tác riêng" hoặc "Dịch vụ của sàn"; Đấu giá
 * chỉ qua sàn).
 *
 * Báo giá và hợp đồng dịch vụ nằm ở menu "Ký gửi đấu giá" — nút ở dải tiến trình dẫn
 * sang; link cũ `?tab=bao-gia` chuyển thẳng tới đó. Tab nằm trên `?tab=` để gửi link
 * một tab và tải lại trang đều về đúng chỗ.
 */
export function AssetPostingDetail({ postingId, onBack }: AssetPostingDetailProps) {
  const navigate = useNavigate();
  const { data, isLoading } = usePostingDetail(postingId);
  const { data: contracts = [] } = usePostingContracts(postingId);
  const { data: summary } = useOwnerConsignmentSummary();
  const { postingAccess } = useOwnerWorkspace();
  const posting = data?.posting ?? null;
  const { data: branches } = useWorkspaceBranchOptions(posting?.branch_id ? posting.workspace_id : null);
  const legalPending = useLegalPendingCount(postingId);
  const [searchParams, setSearchParams] = useSearchParams();

  const rawParam = searchParams.get("tab");
  const param = (rawParam && LEGACY_TAB[rawParam]) ?? rawParam;
  const tab: PostingTab = TABS.some((t) => t.value === param) ? (param as PostingTab) : "thong-tin";
  // replace: đổi tab không nên đẻ thêm một bước back cho mỗi lần bấm.
  const setTab = (v: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === "thong-tin") next.delete("tab");
        else next.set("tab", v);
        return next;
      },
      { replace: true },
    );

  if (rawParam === "bao-gia") return <Navigate to={ownerConsignmentPath(postingId)} replace />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const crumbs = (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      <button type="button" onClick={onBack} className="shrink-0 text-foreground/70 hover:text-foreground hover:underline">
        Số hoá tài sản
      </button>
      <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate font-medium text-foreground" aria-current="page">
        {posting?.title ?? "Không tìm thấy"}
      </span>
    </nav>
  );

  if (!data || !posting) {
    return (
      <div className="space-y-4">
        {crumbs}
        <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ tài sản.</p>
      </div>
    );
  }

  const { requests, brokerRequest, org } = data;
  // Theo vai trò ở CHÍNH không gian của hồ sơ — không theo tenant đang chọn.
  const access = postingAccess(posting);
  const canWrite = access.edit;
  const status = digitizeStatusOf({
    postingStatus: posting.status,
    reviewStatus: posting.review_status,
    requestStatuses: requests.map((r) => r.status),
    brokerStatus: brokerRequest?.status ?? null,
    contractStatuses: contracts.map((c) => c.status),
    ownerAction: summary?.byPosting[posting.id]?.owner_action ?? null,
  });
  const locked = posting.status === "cancelled" || posting.status === "contracted" || status.stage === "signed";
  const branch = posting.branch_id ? (branches?.find((b) => b.id === posting.branch_id)?.label ?? null) : null;
  const openWizard = () => navigate(ownerPostingWizardPath(posting.id));
  const openConsignment = () => navigate(ownerConsignmentPath(posting.id));

  return (
    <PostingAccessProvider value={access}>
      <div className="space-y-4">
        {crumbs}

        <PostingDetailHeader
          posting={posting}
          branch={branch}
          onEdit={canWrite && EDITABLE.includes(status.stage) ? openWizard : undefined}
          onOpenConsignment={HAS_CONSIGNMENT.includes(status.stage) ? openConsignment : undefined}
          actions={<ExportPostingPdfButton postingId={posting.id} />}
        >
          <PostingFlowStrip
            status={status}
            canWrite={canWrite}
            onOpenWizard={openWizard}
            onOpenConsignment={openConsignment}
            facts={{
              pct: postingCompletionPct(posting),
              sentCount: requests.length,
              quotedCount: requests.filter((r) => r.status === "quoted" || r.status === "selected").length,
              pendingCount: requests.filter((r) => r.status === "sent" || r.status === "seen").length,
              orgName: org?.name ?? null,
              contractStatus: contracts.find((c) => c.status !== "cancelled")?.status ?? null,
              rejectionReason: posting.rejection_reason,
              personal: !posting.workspace_id,
            }}
          />
        </PostingDetailHeader>

        <AuthenticationOutcomeNotice postingId={posting.id} />

        <Tabs value={tab} onValueChange={setTab} className="pt-2">
          <OwnerTabsList aria-label="Nội dung hồ sơ" className="mb-[18px]">
            {TABS.map((t) => (
              <OwnerTabsTrigger
                key={t.value}
                value={t.value}
                count={t.value === "phap-ly" && legalPending > 0 ? legalPending : undefined}
                attention={t.value === "phap-ly"}
              >
                {t.label}
              </OwnerTabsTrigger>
            ))}
          </OwnerTabsList>

          <TabsContent value="thong-tin" className="mt-0">
            <PostingOverviewTab posting={posting} locked={locked} />
          </TabsContent>
          <TabsContent value="ho-so-online" className="mt-0">
            <PostingOnlineTab posting={posting} />
          </TabsContent>
          <TabsContent value="phap-ly" className="mt-0">
            <PostingLegalServiceTab posting={posting} locked={locked} />
          </TabsContent>
          <TabsContent value="dau-gia" className="mt-0">
            <PostingAuctionServiceTab
              posting={posting}
              locked={locked}
              sentCount={requests.length}
              quotedCount={requests.filter((r) => r.status === "quoted" || r.status === "selected").length}
              viaBroker={!!brokerRequest}
              orgName={org?.name ?? null}
              onOpenConsignment={HAS_CONSIGNMENT.includes(status.stage) ? openConsignment : undefined}
            />
          </TabsContent>
          <TabsContent value="tham-dinh" className="mt-0">
            <PostingValuationServiceTab posting={posting} locked={locked} />
          </TabsContent>
          <TabsContent value="giam-dinh" className="mt-0">
            <PostingAuthenticationServiceTab posting={posting} locked={locked} />
          </TabsContent>
        </Tabs>
      </div>
    </PostingAccessProvider>
  );
}
