import { useState } from "react";
import { Gavel, Globe, MapPin, Tag, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import { formatShortDateTime, sessionListBadge } from "@/lib/auctionSessions/listBadge";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { PublicSessionDetail } from "@/types/auction-session";

const BADGE = {
  soon: ["Sắp mở bán hồ sơ", "bg-muted text-foreground"],
  open: ["Đang nhận hồ sơ", "bg-primary text-primary-foreground"],
  upcoming: ["Sắp diễn ra", "bg-primary text-primary-foreground"],
  live: ["Đang diễn ra", "bg-destructive/10 text-destructive"],
  done: ["Đã kết thúc", "bg-success/10 text-success"],
  cancelled: ["Đã huỷ", "bg-destructive text-destructive-foreground"],
} as const;

function Tile({ src, lotNo, className, children }: { src: string; lotNo: number; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("group relative overflow-hidden bg-muted", className)}>
      <img src={src} alt={`Tài sản ${lotNo}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <span className="absolute left-3 top-3 flex h-[26px] items-center rounded-full bg-foreground/70 px-2.5 text-xs font-semibold text-background backdrop-blur-sm">
        Tài sản {lotNo}
      </span>
      {children}
    </div>
  );
}

function Fact({ icon: Icon, label, value, full }: { icon: typeof Tag; label: string; value: string; full?: boolean }) {
  return (
    <div className={cn("grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-0.5", full && "col-span-full")}>
      <Icon className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <b className={cn("col-span-2 block text-foreground", full ? "text-sm font-medium" : "text-[15px] font-semibold")}>
        {value}
      </b>
    </div>
  );
}

/** Ảnh tài sản + nhãn trạng thái + tên phiên + dữ kiện chính (design `.hero`). */
export function SessionHero({ session }: { session: PublicSessionDetail }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const lots = session.auction_session_items ?? [];
  const images = lots.filter((l) => l.image_url).map((l) => ({ src: l.image_url as string, lotNo: l.lot_no }));
  const shown = images.slice(0, 3);
  const priced = lots.filter((l) => l.starting_price != null);
  const totalStart = priced.reduce((sum, l) => sum + (l.starting_price ?? 0), 0);
  const offline = session.auction_format === "truc_tiep";
  const venue = [session.venue, session.province].filter(Boolean).join(", ");

  const tone = sessionListBadge(session).tone;
  const [label, badgeCls] = tone === "done" && session.finalized_at ? (["Đã chốt kết quả", BADGE.done[1]] as const) : BADGE[tone];

  const more =
    images.length > 1 ? (
      <button
        type="button"
        onClick={() => setGalleryOpen(true)}
        className="absolute bottom-3 right-3 h-8 rounded-lg bg-background px-3 text-[13px] font-medium text-foreground shadow-sm"
      >
        Xem {images.length} ảnh
      </button>
    ) : null;

  return (
    <section className="overflow-hidden rounded-2xl bg-card">
      <div className="mx-2 mt-2 overflow-hidden rounded-xl">
        {shown.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center bg-muted text-muted-foreground lg:h-[400px]">
            <Gavel className="h-12 w-12" />
          </div>
        ) : (
          <div
            className={cn(
              "grid h-[220px] gap-2 md:h-[400px]",
              shown.length > 1 && "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:grid-rows-2",
            )}
          >
            {shown.map((img, i) => (
              <Tile
                key={img.lotNo}
                src={img.src}
                lotNo={img.lotNo}
                className={cn(
                  i === 0 && shown.length > 1 && "md:row-span-2",
                  i === 1 && shown.length === 2 && "md:row-span-2",
                  i > 0 && "hidden md:block",
                )}
              >
                {(i === shown.length - 1 || i === 0) && <span className={cn(i === 0 && shown.length > 1 && "md:hidden")}>{more}</span>}
              </Tile>
            ))}
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex h-[22px] items-center rounded-full px-2.5 text-xs font-semibold", badgeCls)}>
            {label}
          </span>
          {session.code && <span className="font-mono text-xs text-muted-foreground">{session.code}</span>}
          {session.published_at && (
            <span className="text-xs text-muted-foreground">· Công bố {formatShortDateTime(session.published_at)}</span>
          )}
        </div>
        <h1 className="mt-3 text-pretty text-[26px] font-bold leading-tight tracking-tight text-foreground md:text-[30px]">
          {session.title}
        </h1>
        {session.description && (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{session.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 pb-6 md:grid-cols-3">
        <Fact icon={offline ? MapPin : Globe} label="Hình thức" value={AUCTION_FORMAT_LABELS[session.auction_format] ?? "Trực tuyến"} />
        <Fact icon={Tag} label="Tổng giá khởi điểm" value={priced.length ? `${formatMoneyShort(totalStart)}` : "—"} />
        <Fact icon={Users} label="Số tài sản" value={`${lots.length} tài sản`} />
        {offline && venue && <Fact icon={MapPin} label="Địa điểm tổ chức" value={venue} full />}
      </div>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ảnh tài sản ({images.length})</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {images.map((img) => (
              <Tile key={img.lotNo} src={img.src} lotNo={img.lotNo} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
