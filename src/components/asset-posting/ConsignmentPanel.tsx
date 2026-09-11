import { useState } from "react";
import { Loader2, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuoteComparison } from "./QuoteComparison";
import { AcceptQuoteDialog } from "./AcceptQuoteDialog";
import { ChosenOrgCard } from "./ChosenOrgCard";
import { OwnerContractPanel } from "./OwnerContractPanel";
import { ContractStatusStepper } from "@/components/consignment/ContractStatusStepper";
import {
  BROKER_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  type AssetBrokerRequest,
  type AssetPosting,
  type ServiceRequestStatus,
} from "@/types/asset-posting";
import { useSelectQuote, type RequestOrg, type RequestWithOrg } from "@/hooks/useAssetPosting";
import { usePostingContracts } from "@/hooks/useConsignmentContract";

const BROKER_STEPS: { key: AssetBrokerRequest["status"]; label: string }[] = [
  { key: "pending", label: "Đã gửi sàn" },
  { key: "sourcing", label: "Đang tìm tổ chức" },
  { key: "quoted", label: "Có báo giá" },
  { key: "selected", label: "Đã chọn" },
];

/** Trạng thái bị owner_select_service_quote đóng thành 'not_selected'. */
const CLOSED_ON_SELECT: ServiceRequestStatus[] = ["sent", "seen", "quoted"];

function BrokerProgress({ status }: { status: AssetBrokerRequest["status"] }) {
  const idx = BROKER_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1.5">
      {BROKER_STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 flex-col gap-1.5">
          <div className={`h-1 rounded-full ${i <= idx ? "bg-primary" : "bg-border"}`} />
          <span className={`text-[11px] ${i <= idx ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

interface ConsignmentPanelProps {
  posting: AssetPosting;
  requests: RequestWithOrg[];
  brokerRequest: AssetBrokerRequest | null;
  org: RequestOrg | null;
  onCancelBroker: () => void;
  isCancelling: boolean;
}

/**
 * Toàn bộ trạng thái ký gửi của một hồ sơ trên trang chủ tài sản: tiến trình
 * nhờ sàn, các báo giá nhận được, hợp đồng dịch vụ với tổ chức đã chốt, và các
 * hợp đồng đã huỷ trước đó.
 *
 * Tự giữ luồng chốt báo giá (xác nhận → RPC) để trang chi tiết không phải
 * chuyền state qua lại.
 */
export function ConsignmentPanel({
  posting,
  requests,
  brokerRequest,
  org,
  onCancelBroker,
  isCancelling,
}: ConsignmentPanelProps) {
  const selectQuote = useSelectQuote();
  const { data: contracts = [] } = usePostingContracts(posting.id);
  const [confirming, setConfirming] = useState<RequestWithOrg | null>(null);

  const decided = requests.some((r) => r.status === "selected");
  const activeContract = contracts.find((c) => c.status !== "cancelled") ?? null;
  const cancelledContracts = contracts.filter((c) => c.status === "cancelled");
  const quotes = requests.filter((r) => r.status === "quoted" || r.status === "selected");
  const declined = requests.filter((r) => r.status === "declined");
  const waiting = requests.filter((r) => r.status === "sent" || r.status === "seen");
  const hasReopened = quotes.some((r) => r.status === "quoted" && r.reopened_at);
  const otherOpenCount = confirming
    ? requests.filter((r) => r.id !== confirming.id && CLOSED_ON_SELECT.includes(r.status)).length
    : 0;
  const orgOf = (auctionOrgId: string) => requests.find((r) => r.auction_org_id === auctionOrgId)?.org ?? null;

  if (!brokerRequest && requests.length === 0) return null;

  const confirmSelect = () => {
    if (!confirming) return;
    // Đóng hộp thoại cả khi lỗi: hook đã refetch nên màn hình hiện đúng tổ chức
    // thật sự được chốt (vd. vừa chốt ở tab khác).
    selectQuote.mutate(
      { requestId: confirming.id, postingId: posting.id },
      { onSettled: () => setConfirming(null) },
    );
  };

  return (
    <div className="space-y-4">
      {brokerRequest && brokerRequest.status !== "cancelled" && (
        <Card className="border-primary/20">
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Sàn đang chọn tổ chức giúp bạn</p>
                  <p className="text-sm text-muted-foreground">
                    {BROKER_REQUEST_STATUS_LABELS[brokerRequest.status]}
                    {waiting.length > 0 && ` · đã gửi ${waiting.length + quotes.length} tổ chức`}
                  </p>
                </div>
              </div>
              {/* Huỷ được khi sàn chưa gửi đi đâu; đã có báo giá thì chọn hoặc để đó. */}
              {brokerRequest.status === "pending" && (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={onCancelBroker} disabled={isCancelling}>
                  {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  Huỷ
                </Button>
              )}
            </div>

            <BrokerProgress status={brokerRequest.status} />

            {brokerRequest.note && (
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                “{brokerRequest.note}”
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Đã chốt + có hợp đồng: hợp đồng là việc chính, điều khoản đã chốt nằm trong đó. */}
      {activeContract && (
        <OwnerContractPanel
          contract={activeContract}
          org={orgOf(activeContract.auction_org_id)}
          postingId={posting.id}
          startingPrice={posting.starting_price}
        />
      )}

      {quotes.length > 0 && !(decided && activeContract) && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div>
              <h2 className="font-semibold text-foreground">
                {decided ? "Tổ chức bạn đã chọn" : `${quotes.length} báo giá nhận được`}
              </h2>
              {!decided && (
                <p className="text-sm text-muted-foreground">
                  So sánh và chọn một tổ chức để ký gửi. Chọn xong, các báo giá còn lại sẽ đóng lại.
                </p>
              )}
            </div>
            {hasReopened && !decided && (
              <p className="flex items-start gap-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Một số báo giá đã mở lại sau khi hợp đồng trước bị huỷ. Báo giá có thể đã cũ — hỏi lại tổ chức
                trước khi chọn.
              </p>
            )}
            <QuoteComparison
              quotes={quotes}
              acceptableCommissionPct={posting.commission_pct}
              requestedAuctionFormat={posting.auction_format}
              startingPrice={posting.starting_price}
              onSelect={setConfirming}
              isSelecting={selectQuote.isPending}
              decided={decided}
            />
          </CardContent>
        </Card>
      )}

      {/* Chưa có báo giá nào: cho biết đang chờ ai, đừng để màn hình trống. */}
      {quotes.length === 0 && waiting.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <p className="font-semibold text-foreground">Đang chờ tổ chức phản hồi</p>
            <div className="space-y-1.5">
              {waiting.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{r.org?.name ?? "Tổ chức đấu giá"}</span>
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    {SERVICE_REQUEST_STATUS_LABELS[r.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {declined.length > 0 && !decided && (
        <Card className="border-border">
          <CardContent className="space-y-1.5 pt-5">
            <p className="text-sm font-semibold text-foreground">Tổ chức đã từ chối</p>
            {declined.map((r) => (
              <p key={r.id} className="text-sm text-muted-foreground">
                {r.org?.name ?? "Tổ chức đấu giá"}
                {r.decline_reason ? ` — ${r.decline_reason}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Yêu cầu cũ đã chốt nhưng không có hợp đồng trên sàn (tổ chức chưa có tài khoản). */}
      {decided && !activeContract && org && (
        <ChosenOrgCard org={org} request={requests.find((r) => r.status === "selected") ?? null} />
      )}

      {cancelledContracts.length > 0 && (
        <Card className="border-border">
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-semibold text-foreground">Hợp đồng đã huỷ</p>
            {cancelledContracts.map((c) => (
              <div key={c.id} className="space-y-1.5">
                <p className="text-sm text-foreground">
                  {orgOf(c.auction_org_id)?.name ?? "Tổ chức đấu giá"}
                  <span className="text-muted-foreground"> · {c.code}</span>
                </p>
                <ContractStatusStepper contract={c} viewer="owner" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AcceptQuoteDialog
        quote={confirming}
        otherOpenCount={otherOpenCount}
        isPending={selectQuote.isPending}
        onConfirm={confirmSelect}
        onOpenChange={(open) => {
          if (!open && !selectQuote.isPending) setConfirming(null);
        }}
      />
    </div>
  );
}
