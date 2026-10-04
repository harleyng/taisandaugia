import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useMyOwnerSpaces } from "@/hooks/useMyOwnerSpaces";
import { MY_SPACES_SUBTITLE } from "@/lib/ownerWorkspace/mySpaces";
import { AddSpaceTile, KycStatusTile, SpaceTile } from "@/components/profile/my-assets/SpaceTiles";
import { MyAssetsEmptyState } from "@/components/profile/my-assets/MyAssetsEmptyState";

const ONBOARDING_PATH = "/tro-thanh-chu-tai-san";

/**
 * "Tài sản của tôi" (design 979d4c55 "Tai San Cua Toi - Cong Nguoi Dung"): lưới các
 * không gian Chủ tài sản để vào Trạm điều hành, kèm thẻ hồ sơ xác thực chưa duyệt;
 * chưa có gì thì là màn giới thiệu Trạm điều hành.
 */
export const MyAssetsTab = () => {
  const navigate = useNavigate();
  const { spaces, kycTiles, state, isLoading, selectWorkspace } = useMyOwnerSpaces();

  const goToOnboarding = () => navigate(ONBOARDING_PATH);
  const openSpace = (tenantId: string) => {
    selectWorkspace(tenantId);
    navigate("/chu-tai-san/dashboard");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.015em] text-foreground">Tài sản của tôi</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{MY_SPACES_SUBTITLE[state]}</p>
      </div>

      {state === "none" ? (
        <MyAssetsEmptyState onStart={goToOnboarding} />
      ) : (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
          {spaces.map((space) => (
            <SpaceTile key={space.tenantId} space={space} onOpen={() => openSpace(space.tenantId)} />
          ))}
          {kycTiles.map((tile) => (
            <KycStatusTile key={tile.key} tile={tile} onOpen={goToOnboarding} />
          ))}
          <AddSpaceTile onClick={goToOnboarding} />
        </section>
      )}
    </div>
  );
};
