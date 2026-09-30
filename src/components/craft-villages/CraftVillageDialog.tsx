import { useEffect, useState } from "react";
import { Glasses, ImageOff, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VrTourViewer } from "@/components/vr-tour/VrTourViewer";
import { villageLabel, type PublicCraftVillage } from "@/lib/craftVillages";
import { cn } from "@/lib/utils";

interface CraftVillageDialogProps {
  village: PublicCraftVillage | null;
  onOpenChange: (open: boolean) => void;
}

/** Bấm ảnh làng nghề trên bản đồ ⇒ mở VR tour (tab đầu); không có VR thì xem ảnh sản phẩm. */
export function CraftVillageDialog({ village, onOpenChange }: CraftVillageDialogProps) {
  const [photo, setPhoto] = useState(0);
  useEffect(() => setPhoto(0), [village?.posting_id]);

  const v = village;
  const images = v?.image_urls ?? [];
  const name = v ? villageLabel(v) : "";

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
                </div>
              </DialogDescription>
            </DialogHeader>

            <Tabs key={v.posting_id} defaultValue={v.vr_url ? "vr" : "anh"}>
              <TabsList>
                {v.vr_url && (
                  <TabsTrigger value="vr" className="gap-1.5">
                    <Glasses className="h-4 w-4" /> VR tour
                  </TabsTrigger>
                )}
                <TabsTrigger value="anh">Ảnh sản phẩm</TabsTrigger>
              </TabsList>

              {v.vr_url && (
                <TabsContent value="vr">
                  <VrTourViewer url={v.vr_url} title={name} />
                </TabsContent>
              )}

              <TabsContent value="anh" className="space-y-2">
                <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {images[photo] ? (
                    <img src={images[photo]} alt={`${name} — ảnh ${photo + 1}`} className="h-full w-full object-contain" />
                  ) : (
                    <ImageOff className="h-10 w-10 text-muted-foreground" />
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
            </Tabs>

            {!v.vr_url && (
              <p className="text-sm text-muted-foreground">VR tour của làng nghề đang được cập nhật.</p>
            )}

            {(v.title || v.description) && (
              <div className="space-y-1.5 rounded-xl bg-muted/50 p-4">
                {v.title && <h3 className="font-semibold text-foreground">{v.title}</h3>}
                {v.description && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{v.description}</p>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
