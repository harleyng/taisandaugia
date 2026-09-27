import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import {
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  type AssetPosting,
  type AuctionFormat,
  type ExpectedTimeline,
} from "@/types/asset-posting";
import { KvList } from "./detailParts";

/** "Nhu cầu đấu giá" ở cột phải: giá khởi điểm mong muốn + hình thức, thù lao, thời gian. */
export function PostingAuctionNeedsCard({ posting: p }: { posting: AssetPosting }) {
  const price = p.starting_price;
  return (
    <SectionCard title="Nhu cầu đấu giá">
      <div>
        <p className="text-[12.5px] text-muted-foreground">Giá khởi điểm mong muốn</p>
        <p
          className={cn(
            "mb-3.5 mt-0.5 font-bold tracking-tight tabular-nums",
            price ? "text-[26px] text-foreground" : "text-lg text-foreground/70",
          )}
        >
          {price ? formatMoneyShort(price) : "Nhờ định giá"}
        </p>
        <KvList
          rows={[
            { k: "Hình thức", v: AUCTION_FORMAT_LABELS[p.auction_format as AuctionFormat] ?? "—" },
            { k: "Thù lao chấp nhận", v: p.commission_pct != null ? `≤ ${p.commission_pct}%` : "—" },
            {
              k: "Thời gian kỳ vọng",
              v: p.expected_timeline ? EXPECTED_TIMELINE_LABELS[p.expected_timeline as ExpectedTimeline] : "—",
            },
          ]}
        />
      </div>
    </SectionCard>
  );
}
