import { Lightbulb } from "lucide-react";
import { PostingAuctionConsultCard } from "@/components/auction-consult/PostingAuctionConsultCard";
import { Group } from "../fields";
import type { WizardValues } from "../wizardSchema";

interface AuctionConsultGroupProps {
  f: WizardValues;
  postingId: string | null;
  ensurePostingId: () => Promise<string | null>;
}

/**
 * Khối "Tư vấn đấu giá" ở bước 4, ngay sau giá & hình thức — tuỳ chọn, không chặn "Tiếp tục"
 * / "Hoàn tất" (BR-CNS-04: đề xuất chỉ là gợi ý). Gửi yêu cầu tự lưu nháp như Giám định.
 */
export function AuctionConsultGroup({ f, postingId, ensurePostingId }: AuctionConsultGroupProps) {
  return (
    <Group
      icon={<Lightbulb className="h-4 w-4" />}
      title="Tư vấn đấu giá"
      desc="Chuyên gia đề xuất hình thức, giá khởi điểm / giá bảo lưu, bước giá, thời lượng và tiền đặt trước trước khi lập phiên"
    >
      <PostingAuctionConsultCard
        postingId={postingId}
        mode="owner"
        resolvePostingId={ensurePostingId}
        prefill={{
          startingPrice: f.pricingMode === "self" ? Number(f.startingPrice) || null : null,
          auctionFormat: f.auctionFormat || null,
          expectedTimeline: f.expectedTimeline || null,
        }}
      />
    </Group>
  );
}
