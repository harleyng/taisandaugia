import { useNavigate } from "react-router-dom";
import { ArrowRight, Glasses } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicCraftVillages } from "@/hooks/useCraftVillages";
import { villageLabel } from "@/lib/craftVillages";

/**
 * Trang chủ: dải ảnh sản phẩm tròn của các làng nghề ⇒ /lang-nghe. KHÔNG import leaflet
 * (Index nạp eager) — bản đồ chỉ tải khi vào trang /lang-nghe.
 */
export function CraftVillagesTeaser() {
  const navigate = useNavigate();
  const { data: villages = [], isLoading } = usePublicCraftVillages();

  if (!isLoading && villages.length === 0) return null;

  return (
    <section className="container px-4 py-6 md:py-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="mb-1 text-lg font-medium text-foreground md:text-2xl">Khám phá làng nghề Việt Nam</h2>
          <p className="text-xs text-muted-foreground md:text-sm">Bấm vào ảnh để tham quan làng bằng VR tour 360°</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="hidden text-sm text-muted-foreground hover:text-foreground sm:flex"
          onClick={() => navigate("/lang-nghe")}
        >
          Xem bản đồ làng nghề
          <ArrowRight className="ml-1 h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      <div className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-2">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex w-24 shrink-0 flex-col items-center gap-2">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))
          : villages.slice(0, 16).map((v) => (
              <button
                key={v.posting_id}
                type="button"
                onClick={() => navigate(`/lang-nghe?ho-so=${v.posting_id}`)}
                className="group flex w-24 shrink-0 flex-col items-center gap-2 text-center"
              >
                <span className="relative block h-20 w-20 overflow-hidden rounded-full border-[3px] border-background bg-muted shadow-md ring-2 ring-primary/30 transition-transform group-hover:scale-105">
                  {v.image_urls[0] && (
                    <img src={v.image_urls[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  {v.vr_url && (
                    <span className="absolute inset-x-0 bottom-0 flex justify-center bg-foreground/60 py-0.5 text-background">
                      <Glasses className="h-3.5 w-3.5" aria-label="Có VR tour" />
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-xs font-medium text-foreground">{villageLabel(v)}</span>
              </button>
            ))}
      </div>

      <Button variant="outline" className="mt-3 w-full sm:hidden" onClick={() => navigate("/lang-nghe")}>
        Xem bản đồ làng nghề
      </Button>
    </section>
  );
}
