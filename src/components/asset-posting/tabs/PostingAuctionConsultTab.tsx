import { Card, CardContent } from "@/components/ui/card";
import { PostingAuctionConsultCard } from "@/components/auction-consult/PostingAuctionConsultCard";
import type { AssetPosting } from "@/types/asset-posting";

/** Tab "Tư vấn đấu giá": yêu cầu đang chạy, đề xuất hiện hành và các phiên bản trước. */
export function PostingAuctionConsultTab({ posting: p }: { posting: AssetPosting }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Tư vấn đấu giá</h2>
          <p className="text-sm text-muted-foreground">
            Chuyên gia đề xuất phương án đấu giá trước khi lập phiên. Mỗi phương án được lưu thành một phiên bản kèm người
            tư vấn; bạn chấp nhận hoặc không sử dụng — cấu hình chính thức do tổ chức đấu giá thực hiện ở bước Lập phiên.
          </p>
        </div>
        <PostingAuctionConsultCard
          postingId={p.id}
          mode="owner"
          locked={p.status === "cancelled" || p.status === "contracted"}
          prefill={{
            startingPrice: p.pricing_mode === "self" ? p.starting_price : null,
            auctionFormat: p.auction_format,
            expectedTimeline: p.expected_timeline,
          }}
          showHistory
        />
      </CardContent>
    </Card>
  );
}
