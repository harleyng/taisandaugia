import { ArrowLeft, Glasses, ImageOff, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CraftAssetView } from "@/components/craft-villages/CraftAssetView";
import { villageLabel, type PublicCraftVillage } from "@/lib/craftVillages";

interface CraftVillageDialogProps {
  village: PublicCraftVillage | null;
  /** Hồ sơ đang xem; null = lưới sản phẩm của làng. */
  assetId: string | null;
  onSelectAsset: (postingId: string | null) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Trang làng trên bản đồ: tên, tỉnh, sản phẩm chính, giới thiệu, rồi các hồ sơ làng đang hiện.
 * Làng chỉ có một hồ sơ ⇒ mở thẳng hồ sơ đó; nhiều hồ sơ ⇒ lưới thẻ, bấm để xem ảnh / VR.
 */
export function CraftVillageDialog({ village: v, assetId, onSelectAsset, onOpenChange }: CraftVillageDialogProps) {
  const name = v ? villageLabel(v) : "";
  const single = v?.assets.length === 1;
  const asset = v ? (single ? v.assets[0] : v.assets.find((a) => a.posting_id === assetId) ?? null) : null;

  return (
    <Dialog open={!!v} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        {v && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-xl">{name}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {v.product && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{v.product}</Badge>}
                  {v.province && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {v.province}
                    </span>
                  )}
                  {v.assets.length > 1 && <span className="text-muted-foreground">· {v.assets.length} sản phẩm</span>}
                </div>
              </DialogDescription>
            </DialogHeader>

            {v.intro && !asset && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{v.intro}</p>
            )}

            {asset ? (
              <div className="space-y-3">
                {!single && (
                  <button
                    type="button"
                    onClick={() => onSelectAsset(null)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" /> Các sản phẩm của làng
                  </button>
                )}
                <CraftAssetView asset={asset} villageName={name} />
                {single && !asset.vr_url && (
                  <p className="text-sm text-muted-foreground">VR tour của làng nghề đang được cập nhật.</p>
                )}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {v.assets.map((a) => (
                  <li key={a.posting_id}>
                    <button
                      type="button"
                      onClick={() => onSelectAsset(a.posting_id)}
                      className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-shadow hover:shadow-md"
                    >
                      <span className="relative block aspect-[4/3] bg-muted">
                        {a.image_urls[0] ? (
                          <img src={a.image_urls[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <span className="grid h-full w-full place-items-center">
                            <ImageOff className="h-6 w-6 text-muted-foreground" />
                          </span>
                        )}
                        {a.vr_url && (
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <Glasses className="h-3 w-3" /> VR
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 p-2.5 text-sm font-medium text-foreground group-hover:text-primary">
                        {a.title?.trim() || name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
