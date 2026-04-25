import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sparkles,
  Lock,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  Database,
  CalendarDays,
  Lightbulb,
  ClipboardList,
  Check,
  Info,
  ArrowRight,
} from "lucide-react";
import { formatPrice } from "@/utils/formatters";
import { generateMockSessions } from "@/lib/mockAuctionSessions";
import { computeAnalytics, pickBucket } from "@/lib/auctionPriceAnalytics";

interface AuctionPricePredictionProps {
  listing: any;
  isUnlocked: boolean;
  onUnlock: () => void;
}

// Deterministic hash from id → 0..1
const hashFromId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h % 1000) / 1000;
};

const confidenceLabel = (c: number): string => (c >= 70 ? "Cao" : c >= 55 ? "Trung bình" : "Thấp");

const formatVnDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

interface TrendBadge {
  icon: typeof TrendingUp;
  text: string;
  classes: string;
}

const trendBadge = (trend3M: number): TrendBadge => {
  if (trend3M > 0.02) {
    return {
      icon: TrendingUp,
      text: "Xu hướng giá: Tăng trong 3 tháng qua",
      classes: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
  }
  if (trend3M < -0.02) {
    return {
      icon: TrendingDown,
      text: "Xu hướng giá: Giảm trong 3 tháng qua",
      classes: "bg-rose-50 text-rose-700 border border-rose-200",
    };
  }
  return {
    icon: Minus,
    text: "Xu hướng giá: Ổn định trong 3 tháng qua",
    classes: "bg-muted text-muted-foreground border border-border",
  };
};

export const AuctionPricePrediction = ({ listing, isUnlocked, onUnlock }: AuctionPricePredictionProps) => {
  const ca = listing.custom_attributes || {};
  const seed = hashFromId(listing.id);

  // Predicted range
  const minMultiplier = 1.1 + seed * 0.05;
  const maxMultiplier = 1.22 + seed * 0.08;
  const predMin = ca.predicted_price_min ?? Math.round(listing.price * minMultiplier);
  const predMax = ca.predicted_price_max ?? Math.round(listing.price * maxMultiplier);
  const minPct = Math.round((minMultiplier - 1) * 100);
  const maxPct = Math.round((maxMultiplier - 1) * 100);

  // Confidence — capped at 80% per spec (no demand signal)
  const rawConfidence = ca.confidence_score ?? Math.round(60 + seed * 25);
  const confidence = Math.min(80, rawConfidence);
  const cLabel = confidenceLabel(confidence);

  // Similar sessions (90 days)
  const similarSessions = Math.max(5, Math.round(8 + seed * 12));

  // Date range — last 90 days
  const now = new Date();
  const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Trend from analytics (mock-driven, but consistent with history block)
  const trend3M = useMemo(() => {
    const pricePerSqm = listing.area > 0 ? listing.price / listing.area / 1_000_000 : 0;
    if (pricePerSqm <= 0) return 0;
    const seedStr = `${listing.id || "seed"}-${listing.property_type_slug || ""}-${listing.address?.district || ""}`;
    const sessions = generateMockSessions(seedStr, {
      anchor: pricePerSqm,
      months: 12,
      anchorArea: listing.area || 0,
    });
    if (!sessions.length) return 0;
    const a = computeAnalytics(sessions, listing.area || 0);
    return a.trend3M || 0;
  }, [listing.id, listing.price, listing.area, listing.property_type_slug, listing.address?.district]);

  const tBadge = trendBadge(trend3M);
  const TrendIcon = tBadge.icon;

  // Explainability values
  const districtName = listing.address?.district || listing.address?.city || "khu vực";
  const bucket = pickBucket(listing.area || 0);
  const bucketText = bucket
    ? bucket.max === Infinity
      ? `>${bucket.min} m²`
      : `~${bucket.min}–${bucket.max} m²`
    : "tương đương";

  const InfoTip = ({ content, className = "h-3 w-3" }: { content: string; className?: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          aria-label="Thông tin"
        >
          <Info className={className} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={150}>
    <Card className="p-5 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            Dự đoán giá trúng
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              Beta
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ước tính dựa trên dữ liệu đấu giá tương tự trong quá khứ
          </p>
        </div>
        <InfoTip
          className="h-4 w-4 shrink-0"
          content="Kết quả được tính từ các phiên đấu giá tương tự, kết hợp với xu hướng giá và mức độ biến động trong khu vực."
        />
      </div>

      {/* Locked: paywall preview (UI giống Lịch sử giá) */}
      {!isUnlocked && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Khoảng giá trúng ước tính, độ tin cậy & dữ liệu hỗ trợ
              </p>
              <p className="text-sm text-muted-foreground/70 italic flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> Mở khoá để xem dự đoán giá trúng & phân tích chi tiết
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onUnlock} className="w-full sm:w-auto gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Mở khóa dự đoán
          </Button>
        </div>
      )}

      {/* Unlocked: full content */}
      {isUnlocked && (
        <>
          {/* Section 1: Range + Delta */}
          <div className="rounded-xl border border-border bg-card p-4 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Range */}
              <div className="md:border-r md:border-border md:pr-6">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  Giá trúng ước tính
                  <InfoTip content="Khoảng giá ước tính mà tài sản có thể kết thúc, dựa trên các phiên đấu giá tương tự trong khu vực và xu hướng gần đây." />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-primary leading-tight">
                  {formatPrice(predMin, "TOTAL")} – {formatPrice(predMax, "TOTAL")}
                </div>
                <div className="mt-3">
                  <div className="relative h-1.5 rounded-full bg-primary/20">
                    <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-primary/60" />
                    <div className="absolute -top-1 left-0 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background" />
                    <div className="absolute -top-1 right-0 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background" />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                    <span>{formatPrice(predMin, "TOTAL")}</span>
                    <span>{formatPrice(predMax, "TOTAL")}</span>
                  </div>
                </div>
              </div>

              {/* Delta + trend */}
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  So với giá khởi điểm
                  <InfoTip content="Mức chênh lệch giữa giá khởi điểm và giá trúng trong các phiên tương tự. Giúp ước lượng mức tăng thường xảy ra." />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-emerald-600 leading-tight">
                  +{minPct}% đến +{maxPct}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">(khoảng tăng dự kiến)</div>
                <div
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${tBadge.classes}`}
                >
                  <TrendIcon className="h-3.5 w-3.5" />
                  {tBadge.text}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Three info cards */}
          <div className="rounded-xl border border-border bg-card p-4 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Confidence */}
              <div className="md:border-r md:border-border md:pr-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </span>
                  Độ tin cậy dữ liệu
                  <Info className="h-3 w-3" aria-hidden />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary leading-none">{confidence}%</span>
                </div>
                <Badge variant="secondary" className="mt-2 text-[11px]">
                  {cLabel}
                </Badge>
                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                  Độ tin cậy dựa trên số lượng dữ liệu tương tự và mức độ ổn định của giá.
                </p>
              </div>

              {/* Supporting info */}
              <div className="md:border-r md:border-border md:pr-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Database className="h-4 w-4 text-emerald-600" />
                  </span>
                  Thông tin hỗ trợ
                  <Info className="h-3 w-3" aria-hidden />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-emerald-600 leading-none">{similarSessions}</span>
                  <span className="text-sm text-muted-foreground">phiên</span>
                </div>
                <div className="text-sm text-foreground mt-1">trong 90 ngày</div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                  Dữ liệu từ các tài sản tương tự về đặc điểm và vị trí.
                </p>
              </div>

              {/* Time range */}
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center">
                    <CalendarDays className="h-4 w-4 text-violet-600" />
                  </span>
                  Khoảng thời gian
                  <Info className="h-3 w-3" aria-hidden />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-violet-600 leading-none">90</span>
                  <span className="text-sm text-muted-foreground">ngày</span>
                </div>
                <div className="text-sm text-foreground mt-1">gần nhất</div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                  Từ ngày {formatVnDate(start)} đến {formatVnDate(now)}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Neutral recommendation */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 mb-3">
            <div className="flex items-start gap-3">
              <span className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Lightbulb className="h-4 w-4 text-amber-600" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-1 text-sm font-semibold text-amber-900 mb-1">
                  Khuyến nghị
                  <Info className="h-3 w-3" aria-hidden />
                </div>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  Giá ước tính dựa trên dữ liệu đấu giá gần đây với các tài sản tương tự.{" "}
                  <span className="font-semibold">Giá thực tế có thể thay đổi tùy theo diễn biến phiên đấu giá</span> và
                  các yếu tố thị trường khác tại thời điểm đấu giá.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Explainability */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 mb-3">
            <div className="flex items-start gap-3">
              <span className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <ClipboardList className="h-4 w-4 text-sky-600" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-1 text-sm font-semibold text-sky-900 mb-2">
                  Dựa trên dữ liệu
                  <Info className="h-3 w-3" aria-hidden />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {[
                    "Các tài sản tương tự về loại và đặc điểm",
                    `Cùng khu vực (${districtName})`,
                    `Diện tích tương đương (${bucketText})`,
                    "Dữ liệu đấu giá thành công",
                  ].map((t) => (
                    <div key={t} className="flex items-start gap-1.5 text-xs text-sky-900">
                      <Check className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer footer */}
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground mt-2">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Lưu ý: Đây là ước tính tham khảo, không phải cam kết kết quả. Vui lòng cân nhắc kỹ trước khi tham gia đấu
              giá.
            </span>
          </div>
        </>
      )}
    </Card>
    </TooltipProvider>
  );
};
