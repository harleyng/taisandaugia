import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ExternalLink, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { VillageAssetList } from "@/components/owner-portal/craft-village/VillageAssetList";
import { VillageProfileForm, type VillageFormValue } from "@/components/owner-portal/craft-village/VillageProfileForm";
import { useCraftVillageProfile, useSaveCraftVillageProfile } from "@/hooks/useCraftVillages";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import type { CraftVillageAsset, CraftVillageProfile } from "@/lib/craftVillages";

const EMPTY: VillageFormValue = { product: "", province: "", intro: "", loc: null, published: false };

function toForm(p: CraftVillageProfile | null): VillageFormValue {
  if (!p) return EMPTY;
  return {
    product: p.product,
    province: p.province ?? "",
    intro: p.intro ?? "",
    loc: { lat: p.latitude, lng: p.longitude },
    published: p.isPublished,
  };
}

/** Bìa mặc định khi chưa chọn: hồ sơ đang bật hiện đầu tiên (danh sách server xếp mới trước). */
function defaultCover(assets: CraftVillageAsset[]): string | null {
  return assets.find((a) => a.isPublished)?.postingId ?? null;
}

/**
 * Hồ sơ làng nghề — /chu-tai-san/lang-nghe, chỉ cho Trạm loại Làng nghề. Thông tin chung của LÀNG
 * (vị trí, tỉnh, sản phẩm chính, giới thiệu, ảnh bìa, công khai) + bật hiện từng hồ sơ số hoá.
 * Bản đồ /lang-nghe hiện mỗi làng một ghim, bấm vào thấy các hồ sơ đang hiện.
 */
const OwnerCraftVillagePage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, isLoading: wsLoading } = useOwnerWorkspace();
  const { data: state, isLoading } = useCraftVillageProfile(workspaceId);
  const save = useSaveCraftVillageProfile();

  const village = state?.eligible ? state : null;
  const profile = village?.profile ?? null;
  const assets = useMemo(() => village?.assets ?? [], [village?.assets]);

  const [form, setForm] = useState<VillageFormValue>(EMPTY);
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    setForm(toForm(profile));
    setCover(profile?.coverPostingId ?? null);
  }, [profile]);

  if (wsLoading || (workspaceId && isLoading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId || !workspace) {
    return (
      <OwnerNoWorkspaceState icon={Store}>
        <EmptyState
          icon={Store}
          title="Chưa có không gian làm việc"
          description="Hồ sơ làng nghề dành cho chủ tài sản là tổ chức loại Làng nghề đã xác thực."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san?moi=1")}>Đăng ký làng nghề</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  if (!village) {
    return (
      <EmptyState
        icon={Store}
        title="Trạm này không phải làng nghề"
        description="Chỉ tổ chức loại “Làng nghề / HTX làng nghề” mới có trang làng trên bản đồ làng nghề."
        action={<Button variant="outline" onClick={() => navigate("/tro-thanh-chu-tai-san?moi=1")}>Đăng ký làng nghề</Button>}
      />
    );
  }

  const readOnly = !village.canEdit;
  const effectiveCover = cover ?? defaultCover(assets);
  const hasVisible = assets.some((a) => a.visible);
  const live = !!profile?.isPublished && hasVisible;
  const dirty =
    !profile ||
    profile.product !== form.product.trim() ||
    (profile.province ?? "") !== form.province.trim() ||
    (profile.intro ?? "") !== form.intro.trim() ||
    profile.isPublished !== form.published ||
    profile.latitude !== form.loc?.lat ||
    profile.longitude !== form.loc?.lng ||
    profile.coverPostingId !== effectiveCover;
  const canSave = !readOnly && !!form.loc && form.product.trim().length > 0 && dirty && !save.isPending;

  const submit = () => {
    if (!form.loc) return;
    save.mutate({
      workspaceId,
      published: form.published,
      latitude: form.loc.lat,
      longitude: form.loc.lng,
      province: form.province.trim() || null,
      product: form.product.trim(),
      intro: form.intro.trim() || null,
      coverPostingId: effectiveCover,
    });
  };

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Hồ sơ làng nghề"
        subtitle={village.villageName}
        actions={
          live && (
            <Button variant="outline" onClick={() => navigate(`/lang-nghe?lang=${workspaceId}`)}>
              Xem trên bản đồ <ExternalLink className="ml-1.5 h-4 w-4" />
            </Button>
          )
        }
      />

      {live ? (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> Làng đang hiện trên bản đồ làng nghề.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {!profile
            ? "Đặt vị trí và sản phẩm chính để làng lên bản đồ làng nghề."
            : !profile.isPublished
              ? "Làng chưa công khai — bật “Công khai làng” rồi bấm Lưu."
              : "Làng đã công khai nhưng chưa có hồ sơ nào đang hiện — bật ít nhất một hồ sơ đã duyệt bên dưới."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <VillageProfileForm value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} readOnly={readOnly} />
        </div>
        <div>
          <VillageAssetList
            assets={assets}
            coverId={effectiveCover}
            onCoverChange={setCover}
            canEditCover={!readOnly}
            canEditAssets={village.canEditAssets}
          />
        </div>
      </div>

      {!readOnly && (
        <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
          {dirty && <span className="text-xs text-muted-foreground">Có thay đổi chưa lưu</span>}
          <Button onClick={submit} disabled={!canSave}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </div>
      )}
    </div>
  );
};

export default OwnerCraftVillagePage;
