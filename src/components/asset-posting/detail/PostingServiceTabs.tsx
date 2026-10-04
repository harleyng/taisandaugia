import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { PostingAuthenticationSection } from "@/components/authentication/PostingAuthenticationSection";
import { usePostingAuthenticationOrders, usePostingAuthenticationState } from "@/hooks/useAuthenticationOrders";
import { usePostingLegalConsultations } from "@/hooks/useLegalConsultations";
import { usePostingValuationOrders } from "@/hooks/useValuationOrders";
import type { AssetPosting } from "@/types/asset-posting";
import { PostingServiceTab } from "../service/PostingServiceTab";
import { PostingAuctionPlatformCard } from "./PostingAuctionPlatformCard";
import { PostingAuctionTab } from "./PostingAuctionTab";
import { PostingLegalTab } from "./PostingLegalTab";
import { PostingValuationTab } from "./PostingValuationTab";

interface TabProps {
  posting: AssetPosting;
  locked: boolean;
}

/** Tab Pháp lý — đối tác riêng hoặc tư vấn pháp lý của sàn. */
export function PostingLegalServiceTab({ posting, locked }: TabProps) {
  const { data: consults = [] } = usePostingLegalConsultations(posting.id);
  return (
    <PostingServiceTab
      posting={posting}
      kind="legal"
      hasPlatformActivity={consults.length > 0}
      platform={<PostingLegalTab posting={posting} locked={locked} />}
    />
  );
}

interface AuctionTabProps extends TabProps {
  sentCount: number;
  quotedCount: number;
  viaBroker: boolean;
  orgName: string | null;
  onOpenConsignment?: () => void;
}

/** Tab Đấu giá — tìm tổ chức qua sàn + tư vấn đấu giá (không có lựa chọn "Đối tác riêng"). */
export function PostingAuctionServiceTab({ posting, locked, ...consignment }: AuctionTabProps) {
  return (
    <div className="space-y-4">
      <PostingAuctionPlatformCard {...consignment} />
      <PostingAuctionTab posting={posting} locked={locked} />
    </div>
  );
}

/** Tab Thẩm định giá — đối tác riêng hoặc đơn thẩm định giá qua sàn. */
export function PostingValuationServiceTab({ posting, locked }: TabProps) {
  const { data: orders = [] } = usePostingValuationOrders(posting.id);
  return (
    <PostingServiceTab
      posting={posting}
      kind="appraisal"
      hasPlatformActivity={orders.length > 0}
      platform={<PostingValuationTab posting={posting} locked={locked} />}
    />
  );
}

/** Tab Giám định — đối tác riêng hoặc giám định qua sàn (bắt buộc qua sàn thì khoá đối tác riêng). */
export function PostingAuthenticationServiceTab({ posting, locked }: TabProps) {
  const { data: orders = [] } = usePostingAuthenticationOrders(posting.id);
  const { data: state } = usePostingAuthenticationState(posting.id);
  const required = (state?.reasons ?? []).length > 0;
  return (
    <PostingServiceTab
      posting={posting}
      kind="authentication"
      hasPlatformActivity={orders.length > 0}
      externalLockedReason={required ? "Loại tài sản này bắt buộc chứng thư giám định qua sàn." : null}
      platform={
        <SectionCard title="Giám định qua sàn">
          <PostingAuthenticationSection
            postingId={posting.id}
            reviewStatus={posting.review_status}
            mode="owner"
            locked={locked}
          />
        </SectionCard>
      }
    />
  );
}
