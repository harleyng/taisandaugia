import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostingAccessProvider } from "./postingAccess";
import { EmptyServiceCard } from "./detail/detailParts";
import { KgDetailHeader } from "@/components/consignment/owner/detail/KgDetailHeader";
import { KgStageBody } from "@/components/consignment/owner/detail/KgStageBody";
import { AskCard } from "@/components/consignment/owner/detail/AskCard";
import { ActivityCard } from "@/components/consignment/owner/detail/ActivityCard";
import { PickQuoteDialog } from "@/components/consignment/owner/detail/PickQuoteDialog";
import {
  useCancelBrokerRequest,
  usePostingDetail,
  useSelectQuote,
  type RequestWithOrg,
} from "@/hooks/useAssetPosting";
import { useOwnerConsignmentSummary, usePostingContracts } from "@/hooks/useConsignmentContract";
import { trackRecordLabel, useOrgTrackRecords } from "@/hooks/useConsignmentOwnerView";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import { REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import { ownerPostingPath, ownerPostingWizardPath } from "@/lib/asset-posting/paths";
import { consignmentStageOf } from "@/lib/consignment/ownerConsignment";
import { ownerConsignmentContractPath } from "@/lib/contracts/paths";
import { isConsignmentOwnerAction } from "@/lib/consignment/postingBadge";
import { kgActivityLog, kgStageOf, kgStatusOf } from "@/lib/consignment/ownerConsignmentView";
import { isLiveServiceRequest, type ServiceRequestStatus } from "@/types/asset-posting";

interface ConsignmentDetailProps {
  postingId: string;
  onBack: () => void;
}

/** Trạng thái bị owner_select_service_quote đóng thành 'not_selected'. */
const CLOSED_ON_SELECT: ServiceRequestStatus[] = ["sent", "seen", "quoted"];
const OPEN_BROKER = ["pending", "sourcing", "quoted"];

const earliest = (values: (string | null | undefined)[]) =>
  values.filter((v): v is string => !!v).sort()[0] ?? null;
const latest = (values: (string | null | undefined)[]) => {
  const sorted = values.filter((v): v is string => !!v).sort();
  return sorted[sorted.length - 1] ?? null;
};
const dm = (iso: string | null) => (iso ? format(new Date(iso), "dd/MM") : null);

/**
 * Chi tiết ký gửi của MỘT hồ sơ (thiết kế "Ky Gui Dau Gia - Danh sach & Chi
 * tiet"): đầu trang + thanh 3 bước, cột chính theo giai đoạn (gửi tổ chức / chờ /
 * nhờ sàn / so sánh báo giá / đã chọn), cột phải là yêu cầu của chủ tài sản + nhật
 * ký. Thông tin tài sản đầy đủ nằm ở hồ sơ số hoá.
 */
export function ConsignmentDetail({ postingId, onBack }: ConsignmentDetailProps) {
  const navigate = useNavigate();
  const { data, isLoading } = usePostingDetail(postingId);
  const { data: contracts = [] } = usePostingContracts(postingId);
  const { data: summary } = useOwnerConsignmentSummary();
  const { postingAccess } = useOwnerWorkspace();
  const selectQuote = useSelectQuote();
  const cancelBroker = useCancelBrokerRequest();
  const [confirming, setConfirming] = useState<RequestWithOrg | null>(null);
  const { data: records } = useOrgTrackRecords(data?.requests.map((r) => r.auction_org_id) ?? []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const backLink = (
    <Button variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground" onClick={onBack}>
      <ArrowLeft className="h-4 w-4" /> Ký gửi đấu giá
    </Button>
  );

  if (!data) {
    return (
      <div className="space-y-5">
        {backLink}
        <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ tài sản.</p>
      </div>
    );
  }

  const { posting: p, requests, brokerRequest: broker } = data;
  const brokerOpen = !!broker && OPEN_BROKER.includes(broker.status);
  const stage = consignmentStageOf({
    postingStatus: p.status,
    reviewStatus: p.review_status,
    requestStatuses: requests.map((r) => r.status),
    brokerStatus: broker?.status ?? null,
    contractStatuses: contracts.map((c) => c.status),
  });

  // Chưa thuộc luồng ký gửi (nháp / chờ duyệt mà chưa gửi ai): việc còn ở phần số hoá.
  if (!stage) {
    return (
      <div className="space-y-5">
        {backLink}
        <EmptyServiceCard
          title="Chưa gửi cho tổ chức nào"
          description={
            p.status === "draft"
              ? "Hồ sơ còn là bản nháp. Hoàn tất số hoá và chờ duyệt để gửi cho tổ chức đấu giá."
              : `Hồ sơ đang ở trạng thái “${REVIEW_STATUS_LABELS[p.review_status]}”. Sau khi được duyệt, bạn có thể gửi hồ sơ cho tối đa ${MAX_RFQ_ORGS} tổ chức đấu giá để nhận báo giá và so sánh.`
          }
          action={
            <Button variant="outline" size="sm" onClick={() => navigate(ownerPostingPath(p.id))}>
              Mở hồ sơ số hoá
            </Button>
          }
        />
      </div>
    );
  }

  const rawAction = summary?.byPosting[p.id]?.owner_action;
  const status = kgStatusOf(kgStageOf(stage, brokerOpen), isConsignmentOwnerAction(rawAction) ? rawAction : null);
  // Theo vai trò ở CHÍNH không gian của hồ sơ — không theo tenant đang chọn.
  const access = postingAccess(p);
  const canWrite = access.edit;
  const selected = requests.find((r) => r.status === "selected" || r.status === "accepted") ?? null;
  const liveCount = requests.filter((r) => isLiveServiceRequest(r.status)).length;
  // Hợp đồng dịch vụ đấu giá nằm ở menu "Hợp đồng" (thao tác xác nhận / huỷ ở đó).
  const activeContract = contracts.find((c) => c.status !== "cancelled") ?? null;
  const recordOf = (orgId: string) => trackRecordLabel(records?.get(orgId));

  const stepDates = [
    dm(earliest([...requests.map((r) => r.created_at), broker?.created_at])),
    dm(earliest(requests.map((r) => r.quoted_at))),
    dm(selected?.updated_at ?? null),
  ];
  const updatedAt =
    latest([
      p.updated_at,
      ...requests.map((r) => r.updated_at),
      broker?.updated_at,
      ...contracts.map((c) => c.updated_at),
    ]) ?? p.updated_at;

  const log = kgActivityLog({
    submittedAt: p.submitted_at,
    approvedAt: p.review_status === "approved" ? p.reviewed_at : null,
    broker,
    contracts,
    requests: requests.map((r) => ({ ...r, orgName: r.org?.name ?? null })),
  });

  const otherOpenCount = confirming
    ? requests.filter((r) => r.id !== confirming.id && CLOSED_ON_SELECT.includes(r.status)).length
    : 0;

  const confirmPick = () => {
    if (!confirming) return;
    // Đóng hộp thoại cả khi lỗi: hook đã refetch nên màn hình hiện đúng tổ chức
    // thật sự được chốt (vd. vừa chốt ở tab khác).
    selectQuote.mutate({ requestId: confirming.id, postingId: p.id }, { onSettled: () => setConfirming(null) });
  };

  return (
    <PostingAccessProvider value={access}>
      <div>
        <KgDetailHeader
          posting={p}
          status={status}
          stepDates={stepDates}
          updatedAt={updatedAt}
          onBack={onBack}
          onOpenDigitized={() => navigate(ownerPostingPath(p.id))}
          onViewContract={activeContract ? () => navigate(ownerConsignmentContractPath(activeContract.id)) : undefined}
        />

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="flex min-w-0 flex-col gap-4">
            <KgStageBody
              status={status}
              posting={p}
              requests={requests}
              broker={broker}
              recordOf={recordOf}
              isPicking={selectQuote.isPending}
              onPick={setConfirming}
              isCancellingBroker={cancelBroker.isPending}
              onCancelBroker={() => broker && cancelBroker.mutate({ brokerRequestId: broker.id, postingId: p.id })}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6">
            <AskCard
              posting={p}
              sentLine={brokerOpen ? "Sàn chọn giúp" : `${liveCount}/${MAX_RFQ_ORGS} tổ chức`}
              onEdit={canWrite && stage === "chua_gui" ? () => navigate(ownerPostingWizardPath(p.id)) : undefined}
            />
            <ActivityCard entries={log} />
          </div>
        </div>

        <PickQuoteDialog
          quote={confirming}
          otherOpenCount={otherOpenCount}
          isPending={selectQuote.isPending}
          onConfirm={confirmPick}
          onClose={() => setConfirming(null)}
        />
      </div>
    </PostingAccessProvider>
  );
}
