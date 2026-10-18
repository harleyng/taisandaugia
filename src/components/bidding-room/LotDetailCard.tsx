import { useState } from "react";
import { Package } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { useLotDetail, type LotDetail, type LotDoc } from "@/hooks/useLotDetail";
import type { AuctionSessionItem } from "@/types/auction-session";

/** "Chi tiết tài sản" dưới khung trả giá + ngăn kéo "Xem chi tiết →" (design `#detail` / `.drawer`). */

interface Props {
  lot: AuctionSessionItem;
  lotCount: number;
}

const openDoc = (d: LotDoc) => window.open(d.url, "_blank", "noopener,noreferrer");

export function LotDetailCard({ lot, lotCount }: Props) {
  const detail = useLotDetail(lot);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[14px] bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3.5">
        <h2 className="text-[15px] font-bold text-foreground">Chi tiết tài sản</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[13px] font-semibold text-primary hover:text-primary-hover hover:underline"
        >
          Xem chi tiết →
        </button>
      </div>

      <div className="grid gap-5 px-5 pb-5 pt-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Gallery lot={lot} images={detail.images} />
        <div>
          {detail.loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              {detail.description && (
                <p className="mb-1.5 line-clamp-3 max-w-[70ch] whitespace-pre-line text-[13.5px] text-muted-foreground">
                  {detail.description}
                </p>
              )}
              <Specs rows={detail.specs.slice(0, 6)} />
              {detail.docs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] font-medium">
                  <span className="w-full text-xs font-medium text-muted-foreground">Tài liệu ({detail.docs.length})</span>
                  {detail.docs.map((d) => (
                    <button key={d.url} type="button" onClick={() => openDoc(d)} className="text-primary hover:text-primary-hover">
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <LotDetailSheet lot={lot} lotCount={lotCount} detail={detail} open={open} onOpenChange={setOpen} />
    </section>
  );
}

function LotDetailSheet({
  lot,
  lotCount,
  detail,
  open,
  onOpenChange,
}: Props & { detail: LotDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px] [&>button.absolute]:hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-[18px]">
          <div>
            <SheetDescription className="text-xs font-semibold">
              Tài sản {lot.lot_no} / {lotCount}
            </SheetDescription>
            <SheetTitle className="mt-0.5 text-[17px] leading-snug">{lot.title}</SheetTitle>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 shrink-0 rounded-lg border border-border bg-card px-4 font-semibold hover:bg-muted"
          >
            Đóng
          </button>
        </div>
        <div className="overflow-auto px-5 pb-7 pt-[18px]">
          <Gallery lot={lot} images={detail.images} />
          {detail.description && (
            <>
              <h4 className="mb-2 mt-5 text-[13px] font-bold">Mô tả</h4>
              <p className="max-w-[70ch] whitespace-pre-line text-[13.5px] text-muted-foreground">{detail.description}</p>
            </>
          )}
          <h4 className="mb-2 mt-5 text-[13px] font-bold">Thông tin tài sản</h4>
          <Specs
            rows={[
              ["Giá khởi điểm", formatMoneyFull(lot.starting_price)],
              ["Bước giá", formatMoneyFull(lot.bid_step)],
              ["Tiền đặt trước", formatMoneyFull(lot.deposit_amount)],
              ...detail.specs,
            ]}
          />
          {detail.docs.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 text-[13px] font-bold">Tài liệu ({detail.docs.length})</h4>
              <ul className="flex flex-col gap-1.5">
                {detail.docs.map((d) => (
                  <li
                    key={d.url}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-[13px]"
                  >
                    <span className="min-w-0 truncate">{d.name}</span>
                    <button type="button" onClick={() => openDoc(d)} className="font-semibold text-primary hover:text-primary-hover">
                      Xem
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Specs({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return null;
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-border py-[9px] text-[13px]">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-semibold text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Ảnh chính 4:3 + hàng ảnh nhỏ (chỉ khi có hơn một ảnh). */
function Gallery({ lot, images }: { lot: AuctionSessionItem; images: string[] }) {
  const [main, setMain] = useState(0);
  const src = images[main] ?? images[0];
  const thumbs = images.length > 1 ? images.slice(0, 3) : [];
  const more = images.length - thumbs.length;

  return (
    <div className="grid gap-2">
      <Photo src={src} alt={lot.title} className="aspect-[4/3]" />
      {thumbs.length > 0 && (
        <div className="flex gap-2">
          {thumbs.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setMain(i)}
              className={cn("relative flex-1 overflow-hidden rounded-[10px]", i === main && "ring-2 ring-primary")}
            >
              <Photo src={t} alt="" className="aspect-[4/3]" />
              {i === thumbs.length - 1 && more > 0 && (
                <span className="absolute inset-0 grid place-items-center bg-foreground/50 text-xs font-semibold text-background">
                  +{more} ảnh
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Photo({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-[10px] text-muted-foreground",
          "bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_8px,hsl(var(--border))_8px_16px)]",
          className,
        )}
      >
        <Package className="h-8 w-8" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={cn("w-full rounded-[10px] object-cover", className)} />;
}
