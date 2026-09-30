import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, Glasses, ImageOff, Loader2, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { useCraftMapState, useSetCraftMapPublication } from "@/hooks/useCraftVillages";
import { categoryName } from "@/lib/ownerAssets";
import type { AssetPosting } from "@/types/asset-posting";
import type { LatLng } from "@/components/craft-villages/CraftLocationPicker";
import { Field } from "../fields";

// Leaflet chỉ tải khi hồ sơ thuộc không gian làng nghề (thẻ mới hiện).
const CraftLocationPicker = lazy(() => import("@/components/craft-villages/CraftLocationPicker"));

function Note({ tone, icon: Icon, children }: { tone: "ok" | "warn" | "muted"; icon: typeof CheckCircle2; children: React.ReactNode }) {
  const color = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : "text-muted-foreground";
  return (
    <p className={`flex items-start gap-1.5 text-xs ${color}`}>
      <Icon className="mt-px h-3.5 w-3.5 shrink-0" /> <span>{children}</span>
    </p>
  );
}

/**
 * "Công khai lên bản đồ làng nghề" — chỉ hiện với hồ sơ của không gian loại Làng nghề.
 * Lên /lang-nghe khi chủ bật VÀ hồ sơ đã được duyệt; sửa hồ sơ ⇒ về chờ duyệt ⇒ tạm ẩn.
 */
export function PostingCraftMapCard({ posting: p }: { posting: AssetPosting }) {
  const navigate = useNavigate();
  const { data: state, isLoading } = useCraftMapState(p.id);
  const save = useSetCraftMapPublication();

  const [product, setProduct] = useState("");
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [published, setPublished] = useState(false);

  const pub = state?.eligible ? state.publication : null;
  useEffect(() => {
    if (!state?.eligible) return;
    setProduct(pub?.product ?? categoryName(p.child_slug) ?? "");
    setLoc(pub ? { lat: pub.latitude, lng: pub.longitude } : null);
    setPublished(pub?.is_published ?? false);
  }, [state, pub, p.child_slug]);

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (!state?.eligible) return null;

  const approved = state.reviewStatus === "approved";
  const readOnly = !state.canEdit;
  const live = !!pub?.is_published && approved;
  const dirty =
    !pub ||
    pub.product !== product.trim() ||
    pub.is_published !== published ||
    pub.latitude !== loc?.lat ||
    pub.longitude !== loc?.lng;
  const canSave = !readOnly && !!loc && product.trim().length > 0 && (!published || approved) && dirty && !save.isPending;

  const submit = () => {
    if (!loc) return;
    save.mutate({ postingId: p.id, published, latitude: loc.lat, longitude: loc.lng, product: product.trim() });
  };

  return (
    <SectionCard title="Bản đồ làng nghề" icon={MapPinned}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <label htmlFor="craft-map-publish" className="text-[13.5px] font-semibold text-foreground">
            Công khai lên bản đồ làng nghề
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Tiêu đề, mô tả, ảnh và VR tour hiện công khai. Địa chỉ chi tiết, pháp lý và giá không hiện.
            </span>
          </label>
          <Switch
            id="craft-map-publish"
            checked={published}
            onCheckedChange={setPublished}
            disabled={readOnly || (!approved && !published)}
          />
        </div>

        <div className="space-y-1.5">
          {live && <Note tone="ok" icon={CheckCircle2}>Đang hiển thị trên bản đồ làng nghề.</Note>}
          {!approved && (
            <Note tone="warn" icon={AlertTriangle}>
              {pub?.is_published
                ? "Hồ sơ đang chờ duyệt lại — tạm ẩn khỏi bản đồ, tự hiện lại khi được duyệt."
                : "Hồ sơ cần được sàn duyệt trước khi công khai."}
            </Note>
          )}
          {!state.hasVr && (
            <Note tone="muted" icon={Glasses}>
              Chưa có VR tour — bản đồ chỉ hiện ảnh. Đặt VR ở mục “Tăng sức hút hồ sơ”.
            </Note>
          )}
          {!state.hasImage && (
            <Note tone="muted" icon={ImageOff}>Hồ sơ chưa có ảnh — ghim trên bản đồ chỉ hiện chữ cái đầu.</Note>
          )}
        </div>

        <Field label="Sản phẩm chính" req>
          <Input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            maxLength={80}
            placeholder="VD: Gốm sứ, Lụa tơ tằm"
            disabled={readOnly}
          />
        </Field>

        <Field label="Vị trí làng nghề" req help="Bấm lên bản đồ hoặc kéo ghim tới đúng vị trí làng.">
          <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
            <CraftLocationPicker value={loc} onChange={setLoc} disabled={readOnly} className="h-52 w-full" />
          </Suspense>
        </Field>
        {loc && (
          <p className="-mt-2 text-xs tabular-nums text-muted-foreground">
            {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <Button size="sm" onClick={submit} disabled={!canSave}>
              {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Lưu
            </Button>
          )}
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
