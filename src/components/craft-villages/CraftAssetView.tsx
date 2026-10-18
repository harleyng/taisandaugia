import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Glasses, ImageOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VrTourViewer } from "@/components/vr-tour/VrTourViewer";
import type { PublicCraftAsset } from "@/lib/craftVillages";
import { cn } from "@/lib/utils";

interface CraftAssetViewProps {
  asset: PublicCraftAsset;
  /** Tên làng — đặt tiêu đề VR + alt ảnh. */
  villageName: string;
}

/** Một hồ sơ trong trang làng: ảnh sản phẩm (tab đầu), VR tour nếu có, rồi tiêu đề + mô tả. */
export function CraftAssetView({ asset, villageName }: CraftAssetViewProps) {
  const [photo, setPhoto] = useState(0);
  const [tab, setTab] = useState("anh");
  useEffect(() => {
    setPhoto(0);
    setTab("anh");
  }, [asset.posting_id]);

  const images = asset.image_urls;
  const name = asset.title?.trim() || villageName;
  const step = (delta: number) => setPhoto((i) => (i + delta + images.length) % images.length);

  // ← → chuyển ảnh khi đang ở tab ảnh (trừ khi đang đứng trên thanh tab — Radix dùng phím mũi tên để đổi tab).
  const onKeyDown = (e: KeyboardEvent) => {
    if (tab !== "anh" || images.length < 2) return;
    if ((e.target as HTMLElement).closest('[role="tablist"]')) return;
    if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="space-y-4" onKeyDown={onKeyDown}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="anh">Ảnh sản phẩm</TabsTrigger>
          {asset.vr_url && (
            <TabsTrigger value="vr" className="gap-1.5">
              <Glasses className="h-4 w-4" /> VR tour
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="anh" className="space-y-2">
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-muted">
            {images[photo] ? (
              <img src={images[photo]} alt={`${name} — ảnh ${photo + 1}`} className="h-full w-full object-contain" />
            ) : (
              <ImageOff className="h-10 w-10 text-muted-foreground" />
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Ảnh trước"
                  className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Ảnh sau"
                  className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground shadow-sm">
                  {photo + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Xem ảnh ${i + 1}`}
                  className={cn(
                    "h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                    i === photo ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
                  )}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {asset.vr_url && (
          <TabsContent value="vr">
            <VrTourViewer url={asset.vr_url} title={villageName} />
          </TabsContent>
        )}
      </Tabs>

      {(asset.title || asset.description) && (
        <div className="space-y-1.5 rounded-xl bg-muted/50 p-4">
          {asset.title && <h3 className="font-semibold text-foreground">{asset.title}</h3>}
          {asset.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{asset.description}</p>
          )}
        </div>
      )}
    </div>
  );
}
