import { Glasses, MapPin } from "lucide-react";
import { villageLabel, type PublicCraftVillage } from "@/lib/craftVillages";
import { cn } from "@/lib/utils";

interface CraftVillageListProps {
  villages: PublicCraftVillage[];
  selectedId: string | null;
  onSelect: (village: PublicCraftVillage) => void;
}

/** Danh sách cạnh bản đồ — bấm một dòng giống bấm ảnh trên bản đồ. */
export function CraftVillageList({ villages, selectedId, onSelect }: CraftVillageListProps) {
  if (villages.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-muted-foreground">Không có làng nghề phù hợp.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {villages.map((v) => {
        const selected = v.posting_id === selectedId;
        return (
          <li key={v.posting_id}>
            <button
              type="button"
              onClick={() => onSelect(v)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
                selected ? "bg-primary/10" : "hover:bg-muted",
              )}
            >
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-background bg-muted shadow">
                {v.image_urls[0] && <img src={v.image_urls[0]} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{villageLabel(v)}</span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {[v.product, v.province].filter(Boolean).join(" · ")}
                </span>
              </span>
              {v.vr_url && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <Glasses className="h-3 w-3" /> VR
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
