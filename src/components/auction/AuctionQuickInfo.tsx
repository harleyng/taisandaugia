import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Loader2, Heart, Eye, Maximize2 } from "lucide-react";
import { formatPrice, formatAreaM2 } from "@/utils/formatters";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { SessionStatusBadge } from "@/components/shared/SessionStatusBadge";

const REAL_ESTATE_SLUGS = new Set([
  "dat-o", "dat-nen", "dat-nong-nghiep", "nha-pho", "nha-rieng",
  "can-ho", "chung-cu", "nha-xuong", "shophouse", "biet-thu", "lien-ke",
]);
const isRealEstateSlug = (slug?: string | null) => {
  if (!slug) return false;
  if (REAL_ESTATE_SLUGS.has(slug)) return true;
  return /^(dat|nha|can-ho|chung-cu|biet-thu|shophouse|lien-ke)/.test(slug);
};
import { useState, useEffect } from "react";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { caNumber, caString, type AuctionListing, type ListingCustomAttributes } from "@/types/listing";

interface AuctionQuickInfoProps {
  price: number;
  area: number;
  customAttributes: ListingCustomAttributes;
  listing: AuctionListing;
  saveCount?: number;
  title?: string;
  propertyTypeName?: string;
  legalStatus?: string | null;
}


function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    const update = () => {
      const diff = Math.max(0, target - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export const AuctionQuickInfo = ({
  price,
  area,
  customAttributes: ca,
  listing,
  saveCount,
  title,
  propertyTypeName,
  legalStatus,
}: AuctionQuickInfoProps) => {
  const status = getSessionStatus(listing);
  const { openAuthDialog } = useAuthDialog();

  // For registration_open: countdown to registration deadline
  // For upcoming: no countdown (just show "sắp diễn ra" message)
  const countdownTarget =
    status === "registration_open"
      ? caString(ca.registration_deadline) || caString(ca.document_sale_end) || caString(ca.auction_time)
      : null;
  const countdown = useCountdown(countdownTarget);

  const pricePerSqm = area > 0 ? price / area : null;
  const winningPrice = caNumber(ca.winning_price ?? ca.win_price) ?? undefined;
  const growthPercent = winningPrice && price > 0 ? (((winningPrice - price) / price) * 100).toFixed(1) : null;
  const isRE = isRealEstateSlug(listing?.property_type_slug);
  const areaText = isRE ? formatAreaM2(area) : null;

  return (
    <Card className="p-5 space-y-5">
      {/* Status + save count */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <SessionStatusBadge status={status} />
          {propertyTypeName && (
            <Badge variant="secondary" className="font-medium">
              {propertyTypeName}
            </Badge>
          )}
          {legalStatus && (
            <Badge variant="outline" className="font-medium">
              {legalStatus}
            </Badge>
          )}
          {areaText && (
            <Badge variant="outline" className="font-medium inline-flex items-center gap-1">
              <Maximize2 className="w-3 h-3" />
              {areaText}
            </Badge>
          )}
        </div>
      </div>

      {title && <h1 className="text-lg md:text-xl font-bold text-foreground leading-snug">{title}</h1>}

      {/* Giá khởi điểm */}
      <div>
        <SectionLabel>Giá khởi điểm</SectionLabel>
        <p className="text-3xl font-bold text-primary mt-1">{formatPrice(price, "TOTAL")}</p>
      </div>

      <div className="h-px bg-border" />

      {/* registration_open: show countdown to registration deadline */}
      {status === "registration_open" && (
        <div className="space-y-4">
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
            <p className="text-sm font-medium text-amber-800 mb-2">Thời hạn đăng ký:</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: countdown.days, label: "ngày" },
                { value: countdown.hours, label: "giờ" },
                { value: countdown.minutes, label: "phút" },
                { value: countdown.seconds, label: "giây" },
              ].map((item) => (
                <div key={item.label} className="bg-amber-100/80 rounded-lg py-2 text-center">
                  <p className="text-2xl font-bold text-amber-900">{item.value}</p>
                  <p className="text-xs text-amber-700">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <Button
            className="w-full h-12 text-base font-semibold"
            size="lg"
            onClick={() => {
              openAuthDialog();
            }}
          >
            Đăng ký tham gia
          </Button>
        </div>
      )}

      {/* upcoming (past registration, before auction): similar to ongoing but different text */}
      {status === "upcoming" && (
        <div className="border border-[hsl(205,65%,80%)] bg-[hsl(205,65%,95%)] rounded-lg p-4 text-center space-y-2">
          <Clock className="w-6 h-6 text-[hsl(205,65%,45%)] mx-auto" />
          <p className="font-semibold text-[hsl(205,65%,30%)]">Phiên đấu giá sắp diễn ra</p>
          <p className="text-sm text-[hsl(205,65%,45%)]">Đã hết hạn đăng ký. Vui lòng chờ phiên đấu giá bắt đầu.</p>
        </div>
      )}

      {status === "ongoing" && (
        <div className="border border-[hsl(205,65%,80%)] bg-[hsl(205,65%,95%)] rounded-lg p-4 text-center space-y-2">
          <Loader2 className="w-6 h-6 text-[hsl(205,65%,45%)] animate-spin mx-auto" />
          <p className="font-semibold text-[hsl(205,65%,30%)]">Phiên đấu giá đang diễn ra</p>
          <p className="text-sm text-[hsl(205,65%,45%)]">Đang chờ cập nhật kết quả...</p>
        </div>
      )}

      {status === "ended" && winningPrice && (
        <div className="space-y-3">
          <div className="border border-border bg-muted/50 rounded-lg p-4 text-center space-y-1">
            <SectionLabel>Giá trúng đấu giá</SectionLabel>
            <p className="text-2xl font-bold text-foreground">{formatPrice(winningPrice, "TOTAL")}</p>
            {growthPercent && (
              <div className="flex items-center justify-center gap-1 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-semibold">+{growthPercent}% so với giá khởi điểm</span>
              </div>
            )}
          </div>
        </div>
      )}

      {status === "ended" && !winningPrice && (
        <div className="border border-border bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Phiên đấu giá đã kết thúc</p>
        </div>
      )}
    </Card>
  );
};
