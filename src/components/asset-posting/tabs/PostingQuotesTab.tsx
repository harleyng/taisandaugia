import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SendToOrgsCard } from "../SendToOrgsCard";
import { ConsignmentPanel } from "../ConsignmentPanel";
import { REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import type { AssetBrokerRequest, AssetPosting } from "@/types/asset-posting";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import type { RequestOrg, RequestWithOrg } from "@/hooks/useAssetPosting";

interface PostingQuotesTabProps {
  posting: AssetPosting;
  requests: RequestWithOrg[];
  brokerRequest: AssetBrokerRequest | null;
  org: RequestOrg | null;
  onCancelBroker: () => void;
  isCancelling: boolean;
}

/**
 * Tab "Báo giá" — toàn bộ luồng ký gửi: gửi hồ sơ cho tổ chức, tiến trình nhờ
 * sàn, báo giá nhận được và hợp đồng dịch vụ.
 *
 * Hai card con tự ẩn theo trạng thái của hồ sơ, nên tab có thể rỗng hoàn toàn.
 * Chỉ một trường hợp rỗng thật sự: hồ sơ chưa được duyệt (mọi trường hợp còn
 * lại đều đã có yêu cầu ⇒ ConsignmentPanel hiện) — nên chỉ cần một câu giải
 * thích, không cần chép lại luật ẩn/hiện của SendToOrgsCard.
 */
export function PostingQuotesTab({
  posting,
  requests,
  brokerRequest,
  org,
  onCancelBroker,
  isCancelling,
}: PostingQuotesTabProps) {
  const notStarted = requests.length === 0 && !brokerRequest;
  const notSendable = posting.status !== "active" || posting.review_status !== "approved";

  return (
    <div className="space-y-4">
      <SendToOrgsCard posting={posting} requests={requests} brokerRequest={brokerRequest} />

      <ConsignmentPanel
        posting={posting}
        requests={requests}
        brokerRequest={brokerRequest}
        org={org}
        onCancelBroker={onCancelBroker}
        isCancelling={isCancelling}
      />

      {notStarted && notSendable && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="font-semibold text-foreground">Chưa gửi cho tổ chức nào</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Hồ sơ đang ở trạng thái “{REVIEW_STATUS_LABELS[posting.review_status]}”. Sau khi được duyệt, bạn có
              thể gửi hồ sơ cho tối đa {MAX_RFQ_ORGS} tổ chức đấu giá để nhận báo giá và so sánh.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
