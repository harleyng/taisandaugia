import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Lock, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Legend,
} from "recharts";
import { generateMockSessions } from "@/lib/mockAuctionSessions";
import {
  buildInsightModeA,
  buildInsightModeB,
  buildPaywallTeaser,
  computeAnalytics,
  sessionsWithinMonths,
  type AnalyticsResult,
  type MonthBucket,
  type RawSession,
} from "@/lib/auctionPriceAnalytics";

interface AuctionPriceHistoryProps {
  listing: any;
  isUnlocked?: boolean;
  isLoggedIn?: boolean;
  onLogin?: () => void;
  onUnlock?: () => void;
}

type RangeKey = "3M" | "6M" | "12M";
const RANGES: { key: RangeKey; label: string; months: number }[] = [
  { key: "3M", label: "3 tháng", months: 3 },
  { key: "6M", label: "6 tháng", months: 6 },
  { key: "12M", label: "12 tháng", months: 12 },
];

const REAL_ESTATE_SLUGS = new Set([
  "dat-o",
  "dat-nen",
  "dat-nong-nghiep",
  "nha-pho",
  "nha-rieng",
  "can-ho",
  "chung-cu",
  "nha-xuong",
  "shophouse",
  "biet-thu",
  "lien-ke",
]);

function isRealEstateSlug(slug?: string | null) {
  if (!slug) return false;
  if (REAL_ESTATE_SLUGS.has(slug)) return true;
  return /^(dat|nha|can-ho|chung-cu|biet-thu|shophouse|lien-ke)/.test(slug);
}

const fmtNum = (n: number) => n.toFixed(1).replace(".", ",");
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1).replace(".", ",")}%`;

const TooltipContentFactory = (assetArea: number, showTotal: boolean) => ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const b: MonthBucket | undefined = payload[0]?.payload;
  if (!b) return null;
  const totalMid = showTotal && assetArea > 0 ? b.median * assetArea : null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-1">{b.label}</p>
      <div className="space-y-0.5 text-muted-foreground">
        <p>
          Trung vị: <span className="text-foreground font-medium">{fmtNum(b.median)} tr/m²</span>
        </p>
        {totalMid !== null && (
          <p>
            Tổng giá ước tính:{" "}
            <span className="text-foreground font-medium">
              {totalMid >= 1000 ? `${(totalMid / 1000).toFixed(2)} tỷ` : `${fmtNum(totalMid)} tr`}
            </span>
          </p>
        )}
        {b.usesPercentile ? (
          <p>
            P25 / P75:{" "}
            <span className="text-foreground font-medium">
              {fmtNum(b.p25!)} – {fmtNum(b.p75!)}
            </span>
          </p>
        ) : (
          <p>
            Min / Max:{" "}
            <span className="text-foreground font-medium">
              {fmtNum(b.min)} – {fmtNum(b.max)}
            </span>
          </p>
        )}
        <p>
          Số phiên: <span className="text-foreground font-medium">{b.count}</span>
        </p>
      </div>
    </div>
  );
};

export const AuctionPriceHistory = ({
  listing,
  isUnlocked = true,
  isLoggedIn = true,
  onLogin,
  onUnlock,
}: AuctionPriceHistoryProps) => {
  const isRealEstate = isRealEstateSlug(listing.property_type_slug);

  const pricePerSqm = listing.area > 0 ? listing.price / listing.area / 1_000_000 : 0;

  const ca = listing.custom_attributes || {};
  const predMin = ca.predicted_price_min as number | undefined;
  const predMax = ca.predicted_price_max as number | undefined;
  const hasPrediction = typeof predMin === "number" && typeof predMax === "number" && listing.area > 0;
  const predictedMidPerSqm = hasPrediction ? (predMin! + predMax!) / 2 / listing.area / 1_000_000 : 0;
  const predMinPerSqm = hasPrediction ? predMin! / listing.area / 1_000_000 : 0;
  const predMaxPerSqm = hasPrediction ? predMax! / listing.area / 1_000_000 : 0;

  // Generate 12M sessions deterministically (always — for background analytics)
  const sessions12M: RawSession[] = useMemo(() => {
    if (!isRealEstate || pricePerSqm <= 0) return [];
    const seed = `${listing.id || "seed"}-${listing.property_type_slug || ""}-${listing.address?.district || ""}`;
    return generateMockSessions(seed, { anchor: pricePerSqm, months: 12, anchorArea: listing.area || 0 });
  }, [listing.id, listing.property_type_slug, listing.address?.district, pricePerSqm, isRealEstate, listing.area]);

  const analytics12M: AnalyticsResult | null = useMemo(
    () => (sessions12M.length ? computeAnalytics(sessions12M, listing.area || 0) : null),
    [sessions12M, listing.area],
  );

  // Determine which ranges have >= 5 sessions (AC2)
  const availableRanges = useMemo(() => {
    if (!analytics12M) return [] as RangeKey[];
    const out: RangeKey[] = [];
    if (analytics12M.count3M >= 5) out.push("3M");
    if (analytics12M.count6M >= 5) out.push("6M");
    if (analytics12M.count12M >= 5) out.push("12M");
    return out;
  }, [analytics12M]);

  const defaultRange: RangeKey = availableRanges.includes("6M")
    ? "6M"
    : availableRanges[0] || "12M";
  const [range, setRange] = useState<RangeKey>(defaultRange);
  const effectiveRange = availableRanges.includes(range) ? range : defaultRange;

  const months = RANGES.find((r) => r.key === effectiveRange)!.months;

  const rangeSessions = useMemo(
    () => sessionsWithinMonths(sessions12M, months),
    [sessions12M, months],
  );
  const rangeAnalytics = useMemo(
    () => (rangeSessions.length ? computeAnalytics(rangeSessions, listing.area || 0) : null),
    [rangeSessions, listing.area],
  );

  if (!isRealEstate || !analytics12M) return null;

  // Address parts for header
  const addr = listing.address || {};
  const wardOrDistrict = addr.ward || addr.district || "";
  const province = addr.province || "";
  const locationLabel = [wardOrDistrict, province].filter(Boolean).join(" - ");
  const assetTypeLabel = listing.property_types?.name || "Bất động sản";
  const title = `Lịch sử đấu giá ${assetTypeLabel}${locationLabel ? ` tại ${locationLabel}` : ""}`;

  // Hard guard — < 5 sessions in 12M → hide chart entirely (AC1, AC2)
  if (analytics12M.count12M < 5) {
    return (
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="text-lg font-bold text-foreground leading-snug">{title}</h3>
        </div>
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">Không đủ dữ liệu để phân tích xu hướng</p>
        </div>
      </Card>
    );
  }

  const chartData = rangeAnalytics?.buckets ?? [];
  const ctxN = rangeAnalytics?.countTotal ?? 0;
  const ctxY = months;

  // Insight selection — only when total sessions >= 8, has prediction, AND not skipPosition
  const allowPositionInsight = analytics12M.count12M >= 8 && hasPrediction && !analytics12M.skipPosition;
  const insight = allowPositionInsight
    ? buildInsightModeB(analytics12M, predictedMidPerSqm)
    : buildInsightModeA(analytics12M);

  const isLocked = !isUnlocked;
  const teaser = buildPaywallTeaser(analytics12M);

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-foreground leading-snug">{title}</h3>
          {analytics12M.areaMode === "area-bucket" && analytics12M.bucketRange ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Dữ liệu từ <span className="font-medium text-foreground">{ctxN} phiên đấu giá</span> tài sản{" "}
              <span className="font-medium text-foreground">
                ~{analytics12M.bucketRange[0]}–{analytics12M.bucketRange[1] === Infinity ? "∞" : analytics12M.bucketRange[1]} m²
              </span>{" "}
              trong khu vực, {ctxY} tháng gần nhất
              {analytics12M.mergedFrom && analytics12M.mergedFrom.length > 1 && (
                <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                  Đã mở rộng dải diện tích
                </Badge>
              )}
              {analytics12M.noisy && (
                <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 border-amber-300 text-amber-700">
                  Dữ liệu noisy
                </Badge>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Dữ liệu từ <span className="font-medium text-foreground">{ctxN} phiên đấu giá</span> trong khu vực ({ctxY} tháng) — không phân theo diện tích
              {analytics12M.noisy && (
                <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 border-amber-300 text-amber-700">
                  Dữ liệu noisy
                </Badge>
              )}
            </p>
          )}
          {listing.area > 0 && analytics12M.areaMode === "area-bucket" && analytics12M.bucketLabel && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Diện tích tài sản: <span className="font-medium text-foreground">{Math.round(listing.area).toLocaleString("vi-VN")} m²</span>
              {" → đối chiếu với nhóm "}
              <span className="font-medium text-foreground">{analytics12M.bucketLabel} m²</span>
            </p>
          )}
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/50">
          {RANGES.map((r) => {
            const enabled = availableRanges.includes(r.key);
            return (
              <Button
                key={r.key}
                variant={effectiveRange === r.key ? "default" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                disabled={!enabled}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Chart — blurred lightly when locked (AC8) */}
      <div className="relative">
        <div
          className={`h-[300px] w-full transition ${isLocked ? "blur-[3px] opacity-80 pointer-events-none select-none" : ""}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip content={TooltipContentFactory(listing.area || 0, analytics12M.areaMode === "area-bucket")} />
              <Legend
                verticalAlign="bottom"
                height={28}
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                payload={[
                  { value: "Giá cao (P75/Max)", type: "circle", id: "high", color: "hsl(280 65% 60%)" },
                  { value: "Giá phổ biến (Trung vị)", type: "circle", id: "mid", color: "hsl(217 91% 55%)" },
                  { value: "Giá thấp (P25/Min)", type: "circle", id: "low", color: "hsl(45 90% 55%)" },
                  hasPrediction
                    ? { value: "Giá dự đoán", type: "circle" as const, id: "pred", color: "hsl(0 75% 55%)" }
                    : { value: "Giá khởi điểm", type: "circle" as const, id: "start", color: "hsl(0 75% 55%)" },
                ]}
              />
              <Line
                type="monotone"
                dataKey="high"
                name="Giá cao"
                stroke="hsl(280 65% 60%)"
                strokeWidth={1.5}
                strokeOpacity={0.7}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="mid"
                name="Giá phổ biến"
                stroke="hsl(217 91% 55%)"
                strokeWidth={3}
                dot={{ r: 3, fill: "hsl(217 91% 55%)", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: "hsl(217 91% 55%)", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="low"
                name="Giá thấp"
                stroke="hsl(45 90% 55%)"
                strokeWidth={1.5}
                strokeOpacity={0.7}
                dot={false}
                activeDot={{ r: 3 }}
              />
              {/* Marker logic (AC3) */}
              {hasPrediction && chartData.length > 0 && (
                <ReferenceDot
                  x={chartData[chartData.length - 1].label}
                  y={predictedMidPerSqm}
                  r={6}
                  fill="hsl(0 75% 55%)"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              )}
              {!hasPrediction && pricePerSqm > 0 && chartData.length > 0 && (
                <ReferenceDot
                  x={chartData[chartData.length - 1].label}
                  y={pricePerSqm}
                  r={6}
                  fill="hsl(0 75% 55%)"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insight box (AC6) — hidden specific bullets when locked */}
      {!isLocked && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">{insight.title}</h4>
          </div>
          <ul className="space-y-1.5">
            {insight.bullets.map((b, i) => (
              <li key={i} className="text-sm text-foreground/90 leading-relaxed">
                <span>• {b.text}</span>
                {b.implication && (
                  <span className="block pl-3 text-primary font-medium mt-0.5">→ {b.implication}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Paywall preview (AC8) */}
      {isLocked && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{teaser}</p>
              <p className="text-sm text-muted-foreground/70 italic flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> Xem vị trí giá hiện tại & cơ hội tham gia
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => (isLoggedIn ? onUnlock?.() : onLogin?.())}
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            {isLoggedIn ? "Mở khoá để xem vị trí giá & cơ hội" : "Đăng nhập để xem phân tích giá"}
          </Button>
        </div>
      )}
    </Card>
  );
};
