import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAssetOwnerKYC } from "@/hooks/useAssetOwnerKYC";
import { useAssetOwnerOrgKYC } from "@/hooks/useAssetOwnerOrgKYC";
import { useOwnerWorkspace, useOwnerWorkspaceMemberships, type OwnerWorkspaceMembership } from "@/hooks/useOwnerWorkspace";
import { ownerWsAccessLabel } from "@/lib/ownerWorkspace/roles";
import { PERSONAL_TENANT } from "@/lib/ownerWorkspace/selection";
import { kycTileStatus, mySpacesState, spaceInitials, type KycTile } from "@/lib/ownerWorkspace/mySpaces";

/** Thẻ một không gian vào được Trạm điều hành (Trạm tổ chức hoặc "Tài sản cá nhân"). */
export interface MyOwnerSpace {
  /** workspaceId, hoặc PERSONAL_TENANT. */
  tenantId: string;
  initials: string;
  name: string;
  /** Vai trò ở Trạm / họ tên chủ tài sản cá nhân. */
  subtitle: string;
  /** Trạm do chính người dùng mở (hồ sơ tổ chức của họ được duyệt). */
  isMine: boolean;
  /** Tài sản sàn tìm thấy đang chờ xác nhận. */
  pendingClaims: number;
}

const NO_COUNTS: Record<string, number> = {};

/**
 * Số tài sản chờ xác nhận ở từng Trạm người dùng vào được — một truy vấn cho mọi
 * Trạm. Dùng chung cho thẻ không gian và huy hiệu menu "Tài sản của tôi".
 */
function usePendingClaimCounts(memberships: OwnerWorkspaceMembership[]) {
  const ids = useMemo(() => memberships.map((m) => m.workspaceId).sort(), [memberships]);
  const query = useQuery({
    queryKey: ["my-owner-spaces", "pending-claim-counts", ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select("workspace_id")
        .in("workspace_id", ids)
        .eq("status", "pending_confirmation");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.workspace_id] = (counts[row.workspace_id] ?? 0) + 1;
      return counts;
    },
  });
  return query.data ?? NO_COUNTS;
}

/** Tổng tài sản chờ xác nhận — huy hiệu cạnh menu "Tài sản của tôi". */
export function useMyOwnerSpacesPendingTotal(): number {
  const { memberships } = useOwnerWorkspaceMemberships();
  const counts = usePendingClaimCounts(memberships);
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

export function useMyOwnerSpaces() {
  const { userId, memberships, hasPersonalTenant, personalName, isLoading: wsLoading, selectWorkspace } =
    useOwnerWorkspace();
  const { kyc, isLoading: indLoading } = useAssetOwnerKYC(userId);
  const { orgKyc, isLoading: orgLoading } = useAssetOwnerOrgKYC(userId);
  const counts = usePendingClaimCounts(memberships);

  const spaces = useMemo((): MyOwnerSpace[] => {
    const rank = (m: OwnerWorkspaceMembership) =>
      m.workspace.owner_user_id === userId ? 0 : m.accessVia === "member" ? 1 : 2;
    const workspaces = [...memberships]
      .sort((a, b) => rank(a) - rank(b) || a.workspace.primary_name.localeCompare(b.workspace.primary_name, "vi"))
      .map((m) => ({
        tenantId: m.workspaceId,
        initials: spaceInitials(m.workspace.primary_name, m.workspace.abbreviations),
        name: m.workspace.primary_name,
        subtitle: ownerWsAccessLabel(m.roleName, m.accessVia),
        isMine: m.workspace.owner_user_id === userId,
        pendingClaims: counts[m.workspaceId] ?? 0,
      }));
    if (!hasPersonalTenant) return workspaces;
    return [
      ...workspaces,
      {
        tenantId: PERSONAL_TENANT,
        initials: "CN",
        name: "Tài sản cá nhân",
        subtitle: personalName ?? kyc?.full_name?.trim() ?? "Chủ tài sản cá nhân",
        isMine: false,
        pendingClaims: 0,
      },
    ];
  }, [memberships, counts, hasPersonalTenant, personalName, kyc?.full_name, userId]);

  const kycTiles = useMemo((): KycTile[] => {
    const tiles: KycTile[] = [];
    const ind = kyc ? kycTileStatus(kyc.status) : null;
    if (kyc && ind) {
      tiles.push({
        key: `ind-${kyc.id}`,
        kind: "individual",
        name: kyc.full_name?.trim() || "Chủ tài sản cá nhân",
        status: ind,
        rejectionReason: kyc.rejection_reason,
      });
    }
    const org = orgKyc ? kycTileStatus(orgKyc.status) : null;
    if (orgKyc && org) {
      tiles.push({
        key: `org-${orgKyc.id}`,
        kind: "organization",
        name: orgKyc.org_name?.trim() || "Tổ chức",
        status: org,
        rejectionReason: orgKyc.rejection_reason,
      });
    }
    return tiles;
  }, [kyc, orgKyc]);

  return {
    spaces,
    kycTiles,
    state: mySpacesState(spaces.length, kycTiles),
    isLoading: !!userId && (wsLoading || indLoading || orgLoading),
    selectWorkspace,
  };
}
