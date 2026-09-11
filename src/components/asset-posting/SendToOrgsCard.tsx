import { useState } from "react";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChooseOrgAndRequest } from "./ChooseOrgAndRequest";
import { postingToBriefInput, postingToMatchCriteria } from "./wizardSchema";
import {
  isLiveServiceRequest,
  type AssetBrokerRequest,
  type AssetPosting,
} from "@/types/asset-posting";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";

interface SendToOrgsCardProps {
  posting: AssetPosting;
  requests: RequestWithOrg[];
  brokerRequest: AssetBrokerRequest | null;
}

/**
 * Luồng riêng: gửi (thêm) hồ sơ cho tổ chức đấu giá — chỉ khi đã số hoá VÀ đã
 * được duyệt.
 *
 * Card KHÔNG đóng lại sau lần gửi đầu: chủ tài sản gửi tới nhiều tổ chức để so
 * sánh báo giá, và nếu các tổ chức đầu đều từ chối thì đóng card lại là đưa hồ
 * sơ vào ngõ cụt. Chỉ ẩn khi đã chốt một tổ chức (server cũng chặn chèn yêu cầu
 * vào hồ sơ đã chốt), khi sàn đang gửi hộ, hoặc khi đã đủ trần MAX_RFQ_ORGS.
 */
export function SendToOrgsCard({ posting: p, requests, brokerRequest }: SendToOrgsCardProps) {
  const [choosingOrg, setChoosingOrg] = useState(false);

  // Chặn theo tổ chức ĐÃ GỬI (UNIQUE ở DB, kể cả dòng đã từ chối) nhưng đếm
  // trần theo tổ chức còn đang giữ hồ sơ — nếu không, 5 lời từ chối là hết
  // đường gửi tiếp.
  const sentOrgIds = new Set(requests.map((r) => r.auction_org_id));
  const activeCount = requests.filter((r) => isLiveServiceRequest(r.status)).length;
  const decided = requests.some((r) => r.status === "selected");
  const openBroker = !!brokerRequest && brokerRequest.status !== "cancelled";
  const topUp = requests.length > 0;

  if (p.status !== "active" || p.review_status !== "approved") return null;
  if (decided || openBroker || activeCount >= MAX_RFQ_ORGS) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-5 space-y-4">
        {choosingOrg ? (
          <ChooseOrgAndRequest
            postingId={p.id}
            criteria={postingToMatchCriteria(p)}
            briefInput={postingToBriefInput(p)}
            alreadySentIds={sentOrgIds}
            activeCount={activeCount}
            onSent={() => setChoosingOrg(false)}
            onSkip={() => setChoosingOrg(false)}
            skipLabel="Đóng"
          />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {topUp ? "Gửi thêm tổ chức đấu giá" : "Gửi cho tổ chức đấu giá"}
              </p>
              <p className="text-sm text-muted-foreground">
                {topUp
                  ? `Muốn thêm báo giá để so sánh? Chọn thêm tối đa ${MAX_RFQ_ORGS - activeCount} tổ chức nữa.`
                  : `Hồ sơ đã số hoá. Chọn tới ${MAX_RFQ_ORGS} tổ chức đấu giá phù hợp để gửi yêu cầu báo giá.`}
              </p>
            </div>
            <Button onClick={() => setChoosingOrg(true)} className="gap-2 shrink-0">
              <Send className="h-4 w-4" />
              {topUp ? "Gửi thêm tổ chức" : "Gửi cho tổ chức đấu giá"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
