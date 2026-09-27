import { useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import type { KgStatus } from "@/lib/consignment/ownerConsignmentView";
import { isLiveServiceRequest, type AssetBrokerRequest, type AssetPosting } from "@/types/asset-posting";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";
import { EmptyServiceCard } from "@/components/asset-posting/detail/detailParts";
import { usePostingCanConsign, usePostingCanSendToOrgs } from "@/components/asset-posting/postingAccess";
import { QuoteCompareCard } from "./QuoteCompareCard";
import { OrgRequestRows } from "./OrgRequestRows";
import { SuggestOrgsCard } from "./SuggestOrgsCard";
import { BrokerStatusCard } from "./BrokerStatusCard";
import { ChosenQuoteCard } from "./ChosenQuoteCard";
import { FindOrgsDialog } from "./FindOrgsDialog";

const OPEN_BROKER: readonly AssetBrokerRequest["status"][] = ["pending", "sourcing", "quoted"];
const DECIDED = ["selected", "accepted"];

interface KgStageBodyProps {
  status: KgStatus;
  posting: AssetPosting;
  requests: RequestWithOrg[];
  broker: AssetBrokerRequest | null;
  recordOf: (orgId: string) => string | null;
  isPicking: boolean;
  onPick: (quote: RequestWithOrg) => void;
  isCancellingBroker: boolean;
  onCancelBroker: () => void;
}

/** Cột chính của chi tiết ký gửi — mỗi giai đoạn một bộ thẻ (theo thiết kế). */
export function KgStageBody({
  status,
  posting: p,
  requests,
  broker,
  recordOf,
  isPicking,
  onPick,
  isCancellingBroker,
  onCancelBroker,
}: KgStageBodyProps) {
  const [findingMore, setFindingMore] = useState(false);
  // Quyền ký gửi (gửi tổ chức, nhờ sàn, chọn báo giá) — từ PostingAccessProvider của trang.
  const canConsign = usePostingCanConsign();
  // Gửi thêm tổ chức / gửi lần đầu = ky-gui:create; chọn báo giá / huỷ = ky-gui:update.
  const canSend = usePostingCanSendToOrgs();

  const sentOrgIds = new Set(requests.map((r) => r.auction_org_id));
  const liveCount = requests.filter((r) => isLiveServiceRequest(r.status)).length;
  const brokerOpen = !!broker && OPEN_BROKER.includes(broker.status);
  const quotes = requests.filter((r) => r.status === "quoted");
  const others = requests.filter((r) => r.status !== "quoted" && !DECIDED.includes(r.status));
  const waiting = requests.filter((r) => r.status === "sent" || r.status === "seen");
  const selected = requests.find((r) => DECIDED.includes(r.status)) ?? null;
  const sendable = p.status === "active" && p.review_status === "approved";

  // Gửi thêm khi đang chờ / đã có báo giá — thiết kế không vẽ, nhưng bỏ đi là mất
  // đường lấy thêm báo giá cho tới khi mọi tổ chức trả lời.
  const left = MAX_RFQ_ORGS - liveCount;
  const topUp =
    canSend && sendable && !brokerOpen && !selected && left > 0 ? (
      <button
        type="button"
        onClick={() => setFindingMore(true)}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Gửi thêm tổ chức · còn {left} suất
      </button>
    ) : undefined;

  const send = canSend && sendable ? (
    <SuggestOrgsCard
      posting={p}
      sentOrgIds={sentOrgIds}
      activeCount={liveCount}
      allowBroker={liveCount === 0 && !brokerOpen}
    />
  ) : (
    <EmptyServiceCard
      title="Chưa gửi được cho tổ chức"
      description={
        sendable
          ? "Bạn chỉ có quyền xem hồ sơ này. Người phụ trách ký gửi của đơn vị sẽ gửi hồ sơ cho tổ chức đấu giá."
          : "Hồ sơ cần được sàn duyệt trước khi gửi cho tổ chức đấu giá."
      }
    />
  );

  const earliestDeadline = waiting.map((r) => r.respond_by).sort()[0];

  let body: ReactNode = null;
  switch (status.stage) {
    case "cho_chon":
      body = (
        <>
          <QuoteCompareCard posting={p} quotes={quotes} canPick={canConsign} isPicking={isPicking} onPick={onPick} />
          <OrgRequestRows title="Tổ chức khác" requests={others} recordOf={recordOf} footer={topUp} />
        </>
      );
      break;
    case "cho_bao_gia":
      body = (
        <OrgRequestRows
          title={`Đang chờ ${waiting.length} tổ chức phản hồi`}
          aux={earliestDeadline ? `Hạn phản hồi ${format(parseISO(earliestDeadline), "dd/MM/yyyy")}` : undefined}
          requests={others}
          recordOf={recordOf}
          footer={topUp}
        />
      );
      break;
    case "chua_gui":
      body = send;
      break;
    case "het_to_chuc":
      body = (
        <>
          {send}
          <OrgRequestRows title="Tổ chức đã từ chối" requests={others} recordOf={recordOf} />
        </>
      );
      break;
    case "nho_san":
      body = broker && (
        <BrokerStatusCard
          broker={broker}
          contactedCount={requests.filter((r) => r.broker_request_id === broker.id).length}
          canCancel={canConsign}
          isCancelling={isCancellingBroker}
          onCancel={onCancelBroker}
        />
      );
      break;
    case "da_chon":
      body = (
        <>
          {selected && <ChosenQuoteCard posting={p} selected={selected} record={recordOf(selected.auction_org_id)} />}
          <OrgRequestRows title="Báo giá khác đã đóng" requests={others} recordOf={recordOf} />
        </>
      );
      break;
  }

  return (
    <>
      {body}
      <FindOrgsDialog
        open={findingMore}
        onOpenChange={setFindingMore}
        posting={p}
        sentOrgIds={sentOrgIds}
        activeCount={liveCount}
      />
    </>
  );
}
