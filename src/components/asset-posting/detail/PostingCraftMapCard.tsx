import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, Glasses, ImageOff, Loader2, MapPinned, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { useCraftMapState, useSetCraftAssetVisibility } from "@/hooks/useCraftVillages";
import type { AssetPosting } from "@/types/asset-posting";

function Note({ tone, icon: Icon, children }: { tone: "ok" | "warn" | "muted"; icon: typeof CheckCircle2; children: React.ReactNode }) {
  const color = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : "text-muted-foreground";
  return (
    <p className={`flex items-start gap-1.5 text-xs ${color}`}>
      <Icon className="mt-px h-3.5 w-3.5 shrink-0" /> <span>{children}</span>
    </p>
  );
}

/**
 * "Hiện trong trang làng nghề" — chỉ hiện với hồ sơ của Trạm loại Làng nghề. Vị trí, sản phẩm chính,
 * giới thiệu là thông tin chung của LÀNG (trang Hồ sơ làng nghề); ở đây chỉ bật/tắt từng hồ sơ.
 * Hồ sơ hiện công khai khi chủ bật VÀ hồ sơ đã duyệt VÀ làng đã công khai.
 */
export function PostingCraftMapCard({ posting: p }: { posting: AssetPosting }) {
  const navigate = useNavigate();
  const { data: state, isLoading } = useCraftMapState(p.id);
  const save = useSetCraftAssetVisibility();

  if (isLoading) return <Skeleton className="h-32 rounded-2xl" />;
  if (!state?.eligible) return null;

  const approved = state.reviewStatus === "approved";
  const villageLive = !!state.village?.isPublished;
  const live = state.isPublished && approved && villageLive;

  return (
    <SectionCard title="Bản đồ làng nghề" icon={MapPinned}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <label htmlFor="craft-asset-visible" className="text-[13.5px] font-semibold text-foreground">
            Hiện trong trang làng nghề
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Tiêu đề, mô tả, ảnh và VR tour hiện công khai. Địa chỉ chi tiết, pháp lý và giá không hiện.
            </span>
          </label>
          <div className="flex items-center gap-2">
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Switch
              id="craft-asset-visible"
              checked={state.isPublished}
              onCheckedChange={(published) => save.mutate({ postingId: p.id, published })}
              disabled={!state.canEdit || save.isPending || (!approved && !state.isPublished)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {live && (
            <Note tone="ok" icon={CheckCircle2}>
              Đang hiện trên bản đồ làng nghề{state.village?.isCover ? " — là ảnh bìa của làng" : ""}.
            </Note>
          )}
          {!approved && (
            <Note tone="warn" icon={AlertTriangle}>
              {state.isPublished
                ? "Hồ sơ đang chờ duyệt lại — tạm ẩn khỏi trang làng, tự hiện lại khi được duyệt."
                : "Hồ sơ cần được sàn duyệt trước khi hiện trong trang làng."}
            </Note>
          )}
          {!villageLive && (
            <Note tone="warn" icon={Store}>
              {state.village
                ? "Làng chưa công khai — bật ở trang Hồ sơ làng nghề để hiện trên bản đồ."
                : "Chưa thiết lập Hồ sơ làng nghề (vị trí, sản phẩm chính) — làng chưa lên bản đồ."}
            </Note>
          )}
          {!state.hasVr && (
            <Note tone="muted" icon={Glasses}>
              Chưa có VR tour — hồ sơ chỉ hiện ảnh. Đặt VR ở mục “Tăng sức hút hồ sơ”.
            </Note>
          )}
          {!state.hasImage && <Note tone="muted" icon={ImageOff}>Hồ sơ chưa có ảnh.</Note>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/chu-tai-san/lang-nghe")}>
            Hồ sơ làng nghề
          </Button>
          {live && (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/lang-nghe?ho-so=${p.id}`)}>
              Xem trên bản đồ <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
