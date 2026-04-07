import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Hourglass, ImageOff, TrendingUp, ShieldCheck, Clock, Heart } from "lucide-react";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { formatPrice, formatDate } from "@/utils/formatters";

export type AuctionSessionStatus = "registration_open" | "upcoming" | "ongoing" | "ended";

export interface AuctionCardProps {
  id: string;
  imageUrl: string | null;
  title: string;
  address: string;
  startingPrice: number;
  priceUnit?: "TOTAL" | "PER_SQM" | "PER_MONTH";
  stepPrice?: number;
  depositAmount?: number;
  auctionDate?: string;
  registrationDeadline?: string;
  sessionStatus: AuctionSessionStatus;
  categorySlug: string;
  subCategorySlug?: string;
  viewMode?: "grid" | "list";
  variant?: "default" | "featured";
  countdown?: string | null;
  orgName?: string;
  winPrice?: number;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
}

const STATUS_CONFIG: Record<AuctionSessionStatus, { label: string; className: string }> = {
  registration_open: { label: "Mở đăng ký", className: "bg-[hsl(142,60%,40%)] text-white" },
  upcoming: { label: "Sắp diễn ra", className: "bg-[hsl(25,95%,53%)] text-white" },
  ongoing: { label: "Đang diễn ra", className: "bg-[hsl(205,65%,45%)] text-white animate-pulse" },
  ended: { label: "Đã kết thúc", className: "bg-muted-foreground text-white" },
};

function getCategoryLabel(categorySlug: string, subCategorySlug?: string, fullPath = false) {
  for (const cat of ASSET_CATEGORIES) {
    if (cat.slug === categorySlug) {
      if (fullPath && subCategorySlug) {
        const sub = cat.children.find((c) => c.slug === subCategorySlug);
        if (sub) return `${cat.name} > ${sub.name}`;
      }
      return cat.name;
    }
    for (const child of cat.children) {
      if (child.slug === categorySlug || child.slug === subCategorySlug) {
        return cat.name;
      }
    }
  }
  return categorySlug;
}

function getOrgInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
}

export function AuctionCard({
  id, imageUrl, title, address, startingPrice, priceUnit = "TOTAL",
  stepPrice, depositAmount, auctionDate, registrationDeadline, sessionStatus, categorySlug,
  subCategorySlug, viewMode = "grid", variant = "default",
  countdown, orgName, winPrice, isSaved, onToggleSave,
}: AuctionCardProps) {
  const status = STATUS_CONFIG[sessionStatus];

  const formattedDate = auctionDate
    ? new Date(auctionDate).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Chưa xác định";

  // ── LIST VIEW ──
  if (viewMode === "list") {
    return (
      <Link
        to={`/auctions/${id}`}
        className="flex gap-4 bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
      >
        <div className="relative w-56 h-40 shrink-0">
          <img
            src={imageUrl || "/placeholder.svg"}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <Badge className={`absolute top-2 left-2 text-xs ${status.className}`}>
            {status.label}
          </Badge>
        </div>
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{address}</p>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-primary font-bold text-lg">
                {formatPrice(startingPrice, priceUnit)}
              </p>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                {stepPrice != null && <span>Bước giá: {formatPrice(stepPrice, "TOTAL")}</span>}
                {depositAmount != null && <span>Đặt trước: {formatPrice(depositAmount, "TOTAL")}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formattedDate}
              </div>
              <Badge variant="outline" className="mt-1 text-xs">
                {getCategoryLabel(categorySlug, subCategorySlug)}
              </Badge>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ── FEATURED VARIANT (homepage) ──
  if (variant === "featured") {
    const orgInitials = orgName ? getOrgInitials(orgName) : "";

    return (
      <Link
        to={`/auctions/${id}`}
        className="flex flex-col bg-white/95 backdrop-blur-sm rounded-xl overflow-hidden hover:shadow-lg hover:shadow-black/20 transition-all group"
      >
        <div className="relative overflow-hidden h-[220px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <ImageOff className="w-10 h-10 text-muted-foreground/40" />
            </div>
          )}
          <Badge className={`absolute top-3 left-3 text-xs ${status.className}`}>
            {status.label}
          </Badge>
          {onToggleSave && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(e); }}
              className={`absolute top-3 ${countdown ? 'right-[calc(0.75rem+80px)]' : 'right-3'} p-1.5 rounded-full transition-colors ${isSaved ? "bg-primary text-primary-foreground" : "bg-background/80 text-muted-foreground hover:text-foreground backdrop-blur-sm"}`}
              title={isSaved ? "Bỏ quan tâm" : "Quan tâm"}
            >
              <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
            </button>
          )}
          {countdown && (
            <Badge className="absolute top-3 right-3 bg-slate-800/80 hover:bg-slate-800/80 text-white border-0 text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
              <Hourglass className="h-3 w-3" strokeWidth={1.5} />
              Còn {countdown}
            </Badge>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-sm md:text-base text-foreground leading-snug mb-1">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {getCategoryLabel(categorySlug, subCategorySlug)} {address && `• ${address}`}
          </p>
           <div className="mb-2">
             <span className="text-lg md:text-xl font-bold text-primary">
               {formatPrice(startingPrice, priceUnit)}
             </span>
             <span className="text-xs text-muted-foreground ml-1.5">khởi điểm</span>
           </div>

          <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              {orgName && (
                <>
                  <img
                    src={`https://ui-avatars.com/api/?name=${orgInitials}&background=1e40af&color=fff&size=48&bold=true`}
                    alt={orgName}
                    className="h-6 w-6 rounded-full flex-shrink-0"
                  />
                  <span className="text-xs font-medium text-foreground">{orgName}</span>
                </>
              )}
            </div>
            <span className="inline-flex items-center justify-center h-8 text-xs px-3 rounded-md border border-border font-medium">
              CHI TIẾT
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // ── DEFAULT VARIANT (listings page) ──
  const orgInitialsDefault = orgName ? getOrgInitials(orgName) : "";
  const increasePercent = winPrice && startingPrice > 0
    ? `+${Math.round(((winPrice - startingPrice) / startingPrice) * 100)}%`
    : null;

  return (
    <Link
      to={`/auctions/${id}`}
      className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-shadow group flex flex-col"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <ImageOff className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}
        <Badge className={`absolute top-2 left-2 text-xs ${status.className}`}>
          {status.label}
        </Badge>
        {onToggleSave && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(e); }}
            className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${isSaved ? "bg-primary text-primary-foreground" : "bg-background/80 text-muted-foreground hover:text-foreground backdrop-blur-sm"}`}
            title={isSaved ? "Bỏ quan tâm" : "Quan tâm"}
          >
            <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
      <div className="p-3 md:p-4 flex flex-col flex-1">
        <h3 className="font-bold text-sm md:text-base text-foreground leading-snug mb-0.5 line-clamp-1 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {getCategoryLabel(categorySlug, subCategorySlug)} {address && `• ${address}`}
        </p>

        {/* Price block */}
        <div className="mt-auto">
          <div className="mb-2">
            {sessionStatus === "ended" && winPrice ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Khởi điểm {formatPrice(startingPrice, priceUnit)}
                </p>
                <p className="text-sm md:text-base font-bold text-primary">
                  Trúng {formatPrice(winPrice, "TOTAL")}{" "}
                  {increasePercent && (
                    <span className="text-xs font-semibold text-[hsl(142,60%,35%)]">
                      ({increasePercent})
                    </span>
                  )}
                </p>
              </>
            ) : (
              <>
                <span className="text-lg font-bold text-primary">
                  {formatPrice(startingPrice, priceUnit)}
                </span>
                <span className="text-xs text-muted-foreground ml-1.5">khởi điểm</span>
              </>
            )}
          </div>


          {orgName && (
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <img
                src={`https://ui-avatars.com/api/?name=${orgInitialsDefault}&background=1e40af&color=fff&size=48&bold=true`}
                alt={orgName}
                className="h-6 w-6 rounded-full flex-shrink-0"
              />
              <span className="text-xs font-medium text-foreground">{orgName}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
