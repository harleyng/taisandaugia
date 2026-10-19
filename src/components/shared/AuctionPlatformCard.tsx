import type { LucideIcon } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { goToAuction } from "@/lib/auctionPlatform";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  /** Đường dẫn trên sàn, vd. AUCTION_LINKS.myContracts. */
  to: string;
}

/** Thẻ dẫn sang Sàn đấu giá trực tuyến — thay chỗ của màn đấu giá đã chuyển đi (Phase 5). */
export function AuctionPlatformCard({ icon: Icon, title, description, cta, to }: Props) {
  return (
    <Card className="flex flex-col items-start gap-4 rounded-2xl p-6 sm:flex-row sm:items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button className="shrink-0" onClick={() => goToAuction(to)}>
        {cta}
        <ExternalLink className="ml-1.5 h-4 w-4" />
      </Button>
    </Card>
  );
}
