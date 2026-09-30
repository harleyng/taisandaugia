import type { AssetPosting } from "@/types/asset-posting";
import { PostingSpecsCard } from "./PostingSpecsCard";
import { PostingLegalStatusCard } from "./PostingLegalStatusCard";
import { PostingMediaCard } from "./PostingMediaCard";
import { PostingAuctionNeedsCard } from "./PostingAuctionNeedsCard";
import { PostingEnhanceCard } from "./PostingEnhanceCard";
import { PostingCraftMapCard } from "./PostingCraftMapCard";

/** Tab "Thông tin tài sản": nội dung đã số hoá bên trái, nhu cầu đấu giá + dịch vụ bên phải (dính khi cuộn). */
export function PostingOverviewTab({ posting, locked }: { posting: AssetPosting; locked: boolean }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="flex min-w-0 flex-col gap-4">
        <PostingSpecsCard posting={posting} />
        <PostingLegalStatusCard posting={posting} />
        <PostingMediaCard posting={posting} />
      </div>
      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6">
        <PostingAuctionNeedsCard posting={posting} />
        <PostingEnhanceCard posting={posting} locked={locked} />
        <PostingCraftMapCard posting={posting} />
      </aside>
    </div>
  );
}
