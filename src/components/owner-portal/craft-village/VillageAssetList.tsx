import { useNavigate } from "react-router-dom";
import { Glasses, ImageOff, LayoutGrid, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { useSetCraftAssetVisibility } from "@/hooks/useCraftVillages";
import type { CraftVillageAsset } from "@/lib/craftVillages";
import { cn } from "@/lib/utils";

interface Props {
  assets: CraftVillageAsset[];
  coverId: string | null;
  onCoverChange: (postingId: string) => void;
  /** Đổi ảnh bìa là thông tin chung của làng (chi-nhanh:update). */
  canEditCover: boolean;
  /** Bật/tắt từng hồ sơ là thao tác trên hồ sơ (so-hoa:update). */
  canEditAssets: boolean;
}

function statusNote(a: CraftVillageAsset): string | null {
  if (a.reviewStatus !== "approved") return a.isPublished ? "Chờ duyệt lại — tạm ẩn" : "Chưa duyệt";
  return null;
}

/**
 * Hồ sơ số hoá của Trạm trong trang làng: bật "Hiện trong trang làng" (lưu ngay) và chọn hồ sơ
 * làm ảnh bìa (lưu cùng thông tin chung). Hồ sơ phải được duyệt mới bật được.
 */
export function VillageAssetList({ assets, coverId, onCoverChange, canEditCover, canEditAssets }: Props) {
  const navigate = useNavigate();
  const toggle = useSetCraftAssetVisibility();
  const visibleCount = assets.filter((a) => a.visible).length;

  return (
    <SectionCard title="Sản phẩm trưng bày" icon={LayoutGrid} count={visibleCount}>
      {assets.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Trạm chưa có hồ sơ số hoá. Số hoá sản phẩm ở mục Số hoá rồi quay lại bật hiện trong trang làng.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {assets.map((a) => {
            const approved = a.reviewStatus === "approved";
            const isCover = a.postingId === coverId;
            const note = statusNote(a);
            return (
              <li key={a.postingId} className="flex items-center gap-3 py-3">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {a.image ? (
                    <img src={a.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="grid h-full w-full place-items-center">
                      <ImageOff className="h-5 w-5 text-muted-foreground" />
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/chu-tai-san/dang-tai-san/${a.postingId}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium text-foreground hover:text-primary">
                    {a.title?.trim() || "Hồ sơ chưa đặt tên"}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {a.code && <span className="tabular-nums">{a.code}</span>}
                    {a.hasVr && (
                      <span className="inline-flex items-center gap-0.5 text-primary">
                        <Glasses className="h-3 w-3" /> VR
                      </span>
                    )}
                    {note && <span className="text-warning">{note}</span>}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onCoverChange(a.postingId)}
                  disabled={!canEditCover || !a.isPublished}
                  title={a.isPublished ? "Dùng ảnh đầu của hồ sơ này làm ảnh bìa làng" : "Bật hiện hồ sơ trước khi chọn làm ảnh bìa"}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    isCover ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Star className={cn("h-3.5 w-3.5", isCover && "fill-accent text-accent")} />
                  {isCover ? "Ảnh bìa" : "Đặt bìa"}
                </button>
                <Switch
                  checked={a.isPublished}
                  aria-label={`Hiện “${a.title ?? a.code ?? "hồ sơ"}” trong trang làng`}
                  onCheckedChange={(published) => toggle.mutate({ postingId: a.postingId, published })}
                  disabled={!canEditAssets || toggle.isPending || (!approved && !a.isPublished)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
