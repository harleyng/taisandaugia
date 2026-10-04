import { ExternalLink, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrderListingImage, type MarketingOrder } from "@/hooks/useOwnerMarketingOrders";
import {
  MKT_ORDER_STATUS_TONE,
  MKT_TONE_BADGE,
  isQuoteExpired,
  ownerOrderHeadline,
  statusLabel,
  type MktOrderStatus,
} from "@/lib/ownerMarketing/orders";
import type { OrderImpact } from "@/lib/ownerMarketing/orderReport";
import { OrderHeroSide } from "./OrderHeroSide";
import { OrderStepper } from "./OrderStepper";

// Nền xanh bạc hà chéo 115° — cùng công thức với hero Tổng quan (RevenueTargetBlock): primary phủ trên success.
const HERO_BG =
  "bg-card bg-[linear-gradient(115deg,hsl(var(--primary)/0.02)_0%,hsl(var(--primary)/0.05)_55%,hsl(var(--primary)/0.08)_100%),linear-gradient(115deg,hsl(var(--success)/0.04)_0%,hsl(var(--success)/0.08)_55%,hsl(var(--success)/0.13)_100%)]";

/** Vòm + chấm tròn góc dưới phải, sau thẻ trắng. */
function HeroDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <span className="absolute bottom-[-60px] right-[-50px] h-[250px] w-[150px] rounded-t-[75px] bg-card/25" />
      <span className="absolute bottom-[-20px] right-[58px] h-[95px] w-[140px] rounded-t-[70px] bg-primary/[0.04]" />
      <span className="absolute bottom-20 right-2 h-14 w-14 rounded-full bg-card bg-[linear-gradient(hsl(var(--accent)/0.22),hsl(var(--accent)/0.22))]" />
    </div>
  );
}

function Thumb({ listingId }: { listingId: string | null }) {
  const { data: src } = useOrderListingImage(listingId);
  if (src) return <img src={src} alt="" className="h-[84px] w-28 shrink-0 rounded-[10px] object-cover" />;
  return (
    <div
      aria-hidden="true"
      className="grid h-[84px] w-28 shrink-0 place-items-center rounded-[10px] bg-[repeating-linear-gradient(135deg,hsl(var(--primary)/0.10)_0_6px,hsl(var(--primary)/0.05)_6px_12px)] text-primary/50"
    >
      <ImageIcon className="h-6 w-6" strokeWidth={1.5} />
    </div>
  );
}

interface OrderHeroProps {
  order: MarketingOrder;
  impact: OrderImpact | null | undefined;
  impactLoading: boolean;
  canShare: boolean;
}

/** Hero trang chi tiết đơn: ảnh + mã + gói + trạng thái + tài sản, câu tình trạng, thẻ trạng thái, thanh tiến độ. */
export function OrderHero({ order: o, impact, impactLoading, canShare }: OrderHeroProps) {
  const expired = isQuoteExpired(o);
  const tone = expired ? "muted" : (MKT_ORDER_STATUS_TONE[o.status as MktOrderStatus] ?? "muted");

  return (
    <section className={cn("relative flex flex-col gap-[22px] overflow-hidden rounded-2xl px-5 pb-5 pt-6 sm:px-[26px]", HERO_BG)}>
      <HeroDecor />
      <div className="relative z-[1] grid items-stretch gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-col items-start gap-[18px] sm:flex-row">
            <Thumb listingId={o.listing_id} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary">
                Giao việc cho sàn
                <span className="font-mono font-semibold normal-case tracking-normal text-muted-foreground">{o.code}</span>
              </p>
              <h1 className="mb-2 mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.015em] text-foreground">
                {o.package_name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13.5px] text-muted-foreground">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    MKT_TONE_BADGE[tone],
                  )}
                >
                  <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                  {expired ? "Báo giá hết hạn" : statusLabel(o.status)}
                </span>
                {o.listing_id ? (
                  <a
                    href={`/listings/${o.listing_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-primary hover:underline"
                  >
                    <span className="truncate">{o.listing_title}</span>
                    <ExternalLink className="h-[13px] w-[13px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="font-semibold text-foreground">{o.listing_title}</span>
                )}
              </div>
            </div>
          </div>
          <p className="mt-3.5 max-w-[520px] text-sm text-primary">{ownerOrderHeadline(o)}</p>
        </div>
        <OrderHeroSide order={o} impact={impact} impactLoading={impactLoading} canShare={canShare} />
      </div>
      {o.status !== "cancelled" && (
        <div className="relative z-[1]">
          <OrderStepper order={o} />
        </div>
      )}
    </section>
  );
}
