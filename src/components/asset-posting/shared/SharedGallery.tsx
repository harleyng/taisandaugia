import { useEffect, useState } from "react";
import { ImageOff, Images, Play } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Slide = { kind: "image" | "video"; url: string };

/** Bố cục khảm theo số ô hiện (1–5): ô đầu lớn bên trái, các ô sau xếp bên phải. */
const GRID: Record<number, { grid: string; tiles: string[] }> = {
  1: { grid: "sm:grid-cols-1 sm:grid-rows-[408px]", tiles: [""] },
  2: { grid: "sm:grid-cols-[2fr_1fr]", tiles: ["sm:row-span-2", "sm:row-span-2"] },
  3: { grid: "sm:grid-cols-[2fr_1fr]", tiles: ["sm:row-span-2", "", ""] },
  4: { grid: "sm:grid-cols-[2fr_1fr_1fr]", tiles: ["sm:row-span-2", "sm:col-span-2", "", ""] },
  5: { grid: "sm:grid-cols-[2fr_1fr_1fr]", tiles: ["sm:row-span-2", "", "", "", ""] },
};

function Media({ slide, alt, eager, inLightbox }: { slide: Slide; alt: string; eager?: boolean; inLightbox?: boolean }) {
  if (slide.kind === "image") {
    return (
      <img
        src={slide.url}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        className={cn("h-full w-full", inLightbox ? "object-contain" : "object-cover")}
      />
    );
  }
  return inLightbox ? (
    <video src={slide.url} controls playsInline preload="metadata" className="h-full w-full bg-foreground object-contain" />
  ) : (
    <>
      <video src={slide.url} muted playsInline preload="metadata" className="h-full w-full bg-foreground object-cover" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-foreground/70 text-background">
          <Play className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
      </span>
    </>
  );
}

/**
 * Ảnh hồ sơ dạng khảm (1 ảnh lớn + 4 ảnh nhỏ); điện thoại chỉ hiện ảnh bìa. Bấm ảnh hoặc
 * "Xem N ảnh" mở trình xem toàn màn hình, vuốt ngang qua mọi ảnh rồi tới video.
 */
export function SharedGallery({ images, videos, title }: { images: string[]; videos: string[]; title: string }) {
  const slides: Slide[] = [
    ...images.map((url) => ({ kind: "image" as const, url })),
    ...videos.map((url) => ({ kind: "video" as const, url })),
  ];
  const [open, setOpen] = useState<number | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (slides.length === 0) {
    return (
      <div className="grid h-[260px] w-full place-items-center rounded-[14px] bg-card text-muted-foreground shadow-card sm:h-[408px] sm:rounded-2xl">
        <ImageOff className="h-10 w-10" strokeWidth={1.5} aria-label="Hồ sơ chưa có ảnh" />
      </div>
    );
  }

  const shown = slides.slice(0, 5);
  const layout = GRID[shown.length];
  const altOf = (i: number) => (i === 0 ? title : `${title} — ảnh ${i + 1}`);
  const moreLabel =
    videos.length > 0 && images.length > 0
      ? `Xem ${images.length} ảnh · ${videos.length} video`
      : videos.length > 0
        ? `Xem ${videos.length} video`
        : `Xem ${images.length} ảnh`;

  return (
    <div className="relative">
      <div
        className={cn(
          "grid grid-cols-1 grid-rows-[260px] gap-2 overflow-hidden rounded-[14px] sm:grid-rows-[200px_200px] sm:rounded-[18px]",
          layout.grid,
        )}
      >
        {shown.map((s, i) => (
          <button
            key={s.url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Mở ${altOf(i)}`}
            className={cn("relative min-h-0 min-w-0 overflow-hidden bg-muted", i > 0 && "hidden sm:block", layout.tiles[i])}
          >
            <Media slide={s} alt={altOf(i)} eager={i === 0} />
          </button>
        ))}
      </div>
      {slides.length > 1 && (
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="absolute bottom-3.5 right-3.5 inline-flex h-[34px] items-center gap-1.5 rounded-full bg-foreground/70 px-3 text-[13px] font-medium text-background backdrop-blur-sm transition-colors hover:bg-foreground/85"
        >
          <Images className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
          {moreLabel}
        </button>
      )}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-5xl gap-3 p-3 sm:p-4">
          <DialogTitle className="sr-only">Hình ảnh tài sản</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
          {open !== null && (
            <div className="relative">
              <Carousel setApi={setApi} opts={{ loop: slides.length > 1, startIndex: open }} aria-label="Hình ảnh tài sản">
                <CarouselContent className="ml-0">
                  {slides.map((s, i) => (
                    <CarouselItem key={s.url} className="pl-0">
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted sm:aspect-[16/10]">
                        <Media slide={s} alt={altOf(i)} inLightbox />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {slides.length > 1 && (
                  <>
                    <CarouselPrevious className="left-3 hidden sm:inline-flex" />
                    <CarouselNext className="right-3 hidden sm:inline-flex" />
                  </>
                )}
              </Carousel>
              {slides.length > 1 && (
                <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-medium tabular-nums text-background">
                  {index + 1} / {slides.length}
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
