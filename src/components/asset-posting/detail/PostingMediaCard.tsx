import { useState } from "react";
import { ImageOff, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { AssetPosting } from "@/types/asset-posting";
import { CardAux } from "./detailParts";
import { PostingMediaDialog } from "./PostingMediaDialog";

const MAX_TILES = 5;

/** "Hình ảnh & video": lưới 5 ô (ảnh chính cao 2 hàng), ô cuối hiện +N; bấm để xem đủ. */
export function PostingMediaCard({ posting: p }: { posting: AssetPosting }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const images = p.image_urls ?? [];
  const videos = p.video_urls ?? [];
  const tiles = images.slice(0, MAX_TILES);
  const more = images.length - tiles.length;
  const aux = [`${images.length} ảnh`, videos.length ? `${videos.length} video` : null].filter(Boolean).join(" · ");

  return (
    <SectionCard title="Hình ảnh & video" actions={<CardAux>{aux}</CardAux>}>
      {images.length === 0 ? (
        <EmptyState compact icon={ImageOff} tone="muted" title="Hồ sơ chưa có ảnh." />
      ) : (
        <div
          className={cn(
            "grid gap-2",
            tiles.length === 1 && "h-[228px] grid-cols-1",
            tiles.length === 2 && "grid-cols-[2fr_1fr] grid-rows-[110px_110px]",
            tiles.length === 3 && "grid-cols-[2fr_1fr] grid-rows-[110px_110px]",
            tiles.length >= 4 && "grid-cols-[2fr_1fr_1fr] grid-rows-[110px_110px]",
          )}
        >
          {tiles.map((url, i) => {
            const last = i === tiles.length - 1;
            return (
              <button
                key={url}
                type="button"
                onClick={() => setOpenAt(i)}
                aria-label={last && more > 0 ? `Xem tất cả ${images.length} ảnh` : `Xem ảnh ${i + 1}`}
                className={cn(
                  "relative overflow-hidden rounded-[9px] bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === 0 && tiles.length > 1 && "row-span-2",
                  tiles.length === 2 && i === 1 && "row-span-2",
                  tiles.length === 4 && i === 3 && "col-span-2",
                )}
              >
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                {last && more > 0 && (
                  <span className="absolute inset-0 grid place-items-center bg-foreground/55 text-[15px] font-semibold text-background">
                    +{more}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {videos.length > 0 && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpenAt(images.length)}>
          <PlayCircle className="h-4 w-4" />
          Xem {videos.length} video
        </Button>
      )}

      <PostingMediaDialog
        images={images}
        videos={videos}
        focusIndex={openAt}
        onClose={() => setOpenAt(null)}
      />
    </SectionCard>
  );
}
