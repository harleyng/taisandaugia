import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MKT_PACKAGE_META, type MktOrderPackage } from "@/lib/ownerMarketing/orders";
import type { Coverage } from "@/lib/ownerSubscription/coverage";
import type { MarketingPackage } from "@/hooks/useOwnerMarketingOrders";
import artBanner from "@/assets/marketing-art/mkt-banner.svg";
import artFeatured from "@/assets/marketing-art/mkt-featured.svg";
import artFull from "@/assets/marketing-art/mkt-full.svg";

type CardTone = "warning" | "info" | "success";

// Theo design "Chọn Gói - Giao Việc Cho Sàn" (979d4c55): mỗi gói một sắc thái + một hình minh hoạ.
const PACKAGE_LOOK: Record<MktOrderPackage, { tone: CardTone; art: string }> = {
  mkt_featured_owner: { tone: "warning", art: artFeatured },
  mkt_social_owner: { tone: "info", art: artBanner },
  mkt_banner_owner: { tone: "info", art: artBanner },
  mkt_full_owner: { tone: "success", art: artFull },
};

// Xanh dương của thẻ Banner = token có sẵn --tier-info (không thêm màu mới).
const TONE_CLASS: Record<CardTone, { card: string; badge: string; check: string }> = {
  warning: {
    card: "border-warning/30 from-warning/[0.07]",
    badge: "bg-warning",
    check: "text-warning",
  },
  info: {
    card: "border-[hsl(var(--tier-info)/0.25)] from-[hsl(var(--tier-info)/0.06)]",
    badge: "bg-[hsl(var(--tier-info))]",
    check: "text-[hsl(var(--tier-info))]",
  },
  success: {
    card: "border-success/25 from-success/[0.06]",
    badge: "bg-success",
    check: "text-success",
  },
};

interface MarketingPackageCardProps {
  pkg: MarketingPackage;
  /** Số thứ tự hiện ở ô góc trái (1, 2, 3…). */
  index: number;
  /** Hạn mức gói dịch vụ của Trạm cho gói này (null = gói không dùng hạn mức). */
  coverage: Coverage | null;
  coverageText: string;
  onChoose: () => void;
}

/** Thẻ một gói trong hộp "Chọn gói": số thứ tự, minh hoạ, bạn nhận được gì, giá, nút chọn. */
export function MarketingPackageCard({ pkg, index, coverage, coverageText, onChoose }: MarketingPackageCardProps) {
  const meta = MKT_PACKAGE_META[pkg.key];
  const look = PACKAGE_LOOK[pkg.key];
  const tone = TONE_CLASS[look.tone];
  const free = pkg.pricing === "credits" && coverage?.kind === "covered";

  const credit = (
    <>
      {pkg.creditCost.toLocaleString("en-US")}{" "}
      <small className={cn("text-sm font-normal", free ? "text-inherit" : "text-muted-foreground")}>credit</small>
    </>
  );

  let note: string;
  if (pkg.pricing === "quote") note = "Sàn báo giá theo yêu cầu";
  else if (free)
    note =
      coverage.remaining === null
        ? "Gói dịch vụ của Trạm - không giới hạn"
        : `Gói dịch vụ của Trạm - còn ${coverage.remaining} lượt`;
  else note = coverageText || "Trả khi đặt";

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b to-card p-6", tone.card)}>
      <div className="relative flex min-h-[136px] flex-col items-start justify-between">
        <span
          aria-hidden="true"
          className={cn(
            "relative z-[1] inline-grid h-9 w-9 place-items-center rounded-lg font-semibold text-white",
            tone.badge,
          )}
        >
          {index}
        </span>
        <img
          src={look.art}
          alt=""
          className="pointer-events-none absolute -right-3 -top-2 bottom-2 h-auto w-[156px] object-contain"
        />
        <h3 className="relative z-[1] pt-3 text-lg font-semibold leading-snug text-foreground">{pkg.name}</h3>
      </div>

      <p className="mt-2 text-pretty text-sm leading-normal text-muted-foreground">{meta.summary}</p>

      <ul className="mb-2 mt-6 flex flex-col gap-2 text-sm text-foreground">
        {meta.includes.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true" className={tone.check}>
              ✓
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-3 pt-5">
        <div>
          {pkg.pricing === "quote" ? (
            <p className="text-lg font-semibold text-success">Báo giá</p>
          ) : free ? (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-lg font-semibold text-success">Miễn phí</span>
              <span className="text-sm text-muted-foreground/70 line-through tabular-nums">{credit}</span>
            </p>
          ) : (
            <p className="text-lg font-semibold tabular-nums text-warning">{credit}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
        </div>
        <Button className="h-10 w-full" onClick={onChoose} aria-label={`Chọn gói ${pkg.name}`}>
          Chọn gói này →
        </Button>
      </div>
    </article>
  );
}
