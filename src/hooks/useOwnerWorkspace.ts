import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import {
  canWriteClaim as canWriteClaimFor,
  canWritePosting as canWritePostingFor,
  isOwnerWsRole,
  ownerWsCan,
  type OwnerWsAccess,
  type OwnerWsAction,
  type OwnerWsRole,
  type PostingOwnership,
} from "@/lib/ownerWorkspace/roles";
import {
  PERSONAL_TENANT,
  pickTenant,
  readSelectedWorkspace,
  subscribeSelectedWorkspace,
  writeSelectedWorkspace,
} from "@/lib/ownerWorkspace/selection";
import type { AssetOwnerWorkspace } from "@/types/asset-owner";

export interface OwnerWorkspaceMembership {
  /** NULL khi vào qua liên kết trụ sở (không có dòng thành viên). */
  memberId: string | null;
  workspaceId: string;
  role: OwnerWsRole;
  /** NULL = toàn bộ không gian. */
  branchScope: string[] | null;
  joinedAt: string | null;
  workspace: AssetOwnerWorkspace;
  /** "hq" = Trạm chi nhánh đã chấp nhận liên kết với Trạm mình làm Trưởng đơn vị — chỉ đọc. */
  accessVia: OwnerWsAccess;
}

const NO_MEMBERSHIPS: OwnerWorkspaceMembership[] = [];

/**
 * Các không gian chủ tài sản mà người dùng là thành viên ĐANG HOẠT ĐỘNG, rồi tới
 * các Trạm chi nhánh đã liên kết với nơi mình là Trưởng đơn vị (Phase 14 — chỉ
 * đọc, role "viewer", xếp sau). Là thành viên trực tiếp của chính chi nhánh đó thì
 * dòng thành viên thắng. Lọc user_id là bắt buộc: policy đọc của bảng thành viên
 * trả cả dòng của đồng nghiệp trong cùng không gian.
 */
export function useOwnerWorkspaceMemberships() {
  const { userId, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: qk.ownerWorkspace.memberships(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<OwnerWorkspaceMembership[]> => {
      const { data, error } = await supabase
        .from("asset_owner_workspace_members")
        .select(
          "id, workspace_id, role, branch_scope, joined_at, workspace:asset_owner_workspaces!asset_owner_workspace_members_workspace_id_fkey(*)",
        )
        .eq("user_id", userId!)
        .eq("status", "active");
      if (error) throw error;
      const direct: OwnerWorkspaceMembership[] = (data ?? []).flatMap((row) => {
        if (!row.workspace || !isOwnerWsRole(row.role)) return [];
        return [
          {
            memberId: row.id,
            workspaceId: row.workspace_id,
            role: row.role,
            branchScope: row.branch_scope,
            joinedAt: row.joined_at,
            workspace: row.workspace as AssetOwnerWorkspace,
            accessVia: "member" as const,
          },
        ];
      });

      const ownerOf = direct.filter((m) => m.role === "owner").map((m) => m.workspaceId);
      if (ownerOf.length === 0) return direct;
      const { data: children, error: childError } = await supabase
        .from("asset_owner_workspaces")
        .select("*")
        .in("parent_workspace_id", ownerOf)
        .order("primary_name");
      if (childError) throw childError;
      const directIds = new Set(direct.map((m) => m.workspaceId));
      const linked: OwnerWorkspaceMembership[] = (children ?? [])
        .filter((w) => !directIds.has(w.id))
        .map((w): OwnerWorkspaceMembership => ({
          memberId: null,
          workspaceId: w.id,
          role: "viewer",
          branchScope: null,
          joinedAt: w.parent_linked_at,
          workspace: w as AssetOwnerWorkspace,
          accessVia: "hq",
        }));
      return [...direct, ...linked];
    },
  });

  return {
    userId,
    memberships: query.data ?? NO_MEMBERSHIPS,
    isLoading: authLoading || (!!userId && query.isLoading),
    isError: query.isError,
  };
}

interface PersonalTenant {
  has: boolean;
  /** Họ tên trên KYC cá nhân đã duyệt — null khi tenant chỉ có vì còn hồ sơ cá nhân. */
  name: string | null;
}

/**
 * Người dùng có tenant "Cá nhân" không (Phase 4): KYC cá nhân đã duyệt, HOẶC còn
 * hồ sơ số hoá cá nhân (workspace_id NULL) — không thì những hồ sơ đó không có
 * tenant nào hiện ra. Lọc user_id là bắt buộc: admin đọc được mọi hồ sơ.
 */
function usePersonalTenant(userId: string | null) {
  return useQuery({
    queryKey: qk.ownerWorkspace.personalTenant(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PersonalTenant> => {
      const [kyc, postings] = await Promise.all([
        supabase.from("asset_owner_kyc").select("full_name").eq("user_id", userId!).eq("status", "approved").limit(1),
        supabase.from("asset_postings").select("id").eq("user_id", userId!).is("workspace_id", null).limit(1),
      ]);
      if (kyc.error) throw kyc.error;
      if (postings.error) throw postings.error;
      const approved = kyc.data?.[0];
      return {
        has: !!approved || (postings.data?.length ?? 0) > 0,
        name: approved?.full_name?.trim() || null,
      };
    },
  });
}

/**
 * TENANT hiện tại của người dùng — một không gian (kèm vai trò) hoặc "Cá nhân" —
 * nguồn duy nhất thay cho mọi `.eq("owner_user_id", uid)` cũ, nên thành viên được
 * mời cũng vào được cổng. Ở tenant Cá nhân `workspaceId` là null, nên các trang
 * chỉ có nghĩa với không gian giữ nguyên hành vi của chủ tài sản cá nhân.
 * `can` / `canWriteClaim` / `canWritePosting` chỉ để ẩn nút; RLS mới là cổng thật.
 */
export function useOwnerWorkspace() {
  const { userId, memberships, isLoading: membershipsLoading, isError } = useOwnerWorkspaceMemberships();
  const personal = usePersonalTenant(userId);
  const hasPersonalTenant = personal.data?.has ?? false;
  // Phải chờ cả tenant Cá nhân: nếu không, lựa chọn "Cá nhân" đã lưu tạm rơi về
  // một không gian rồi lật lại ⇒ layout dựng lại trang con (wizard mất dữ liệu).
  const isLoading = membershipsLoading || (!!userId && personal.isLoading);

  const stored = useSyncExternalStore(
    subscribeSelectedWorkspace,
    () => readSelectedWorkspace(userId),
    (): string | null => null,
  );
  const tenant = useMemo(
    () => pickTenant(memberships, hasPersonalTenant, stored),
    [memberships, hasPersonalTenant, stored],
  );
  const current = tenant?.kind === "workspace" ? tenant.membership : null;
  const isPersonal = tenant?.kind === "personal";
  const tenantKey = isPersonal ? PERSONAL_TENANT : current?.workspaceId ?? null;

  const role = current?.role ?? null;
  const branchScope = current?.branchScope ?? null;

  const can = useCallback((action: OwnerWsAction) => ownerWsCan(role, action), [role]);
  const canWriteClaim = useCallback(
    (branchIdOfClaim: string | null) => canWriteClaimFor({ role, branchScope }, branchIdOfClaim),
    [role, branchScope],
  );
  /** workspaceId hoặc PERSONAL_TENANT. */
  const selectWorkspace = useCallback(
    (tenantId: string) => {
      if (userId) writeSelectedWorkspace(userId, tenantId);
    },
    [userId],
  );
  // Quyền trên MỘT hồ sơ theo vai trò ở CHÍNH không gian của hồ sơ — trang chi
  // tiết mở từ link (vd. trả về từ thanh toán) không nhất thiết thuộc tenant đang chọn.
  const canWritePosting = useCallback(
    (posting: PostingOwnership) => {
      const m = posting.workspace_id ? memberships.find((x) => x.workspaceId === posting.workspace_id) : null;
      return canWritePostingFor(posting, userId, m ? { role: m.role, branchScope: m.branchScope } : null);
    },
    [memberships, userId],
  );
  // Tạo hồ sơ mới trong tenant hiện tại. Cán bộ bị giới hạn vẫn tạo được — wizard
  // bắt chọn chi nhánh trong phạm vi.
  const canCreatePosting = isPersonal || ownerWsCan(role, "write");

  return {
    userId,
    workspaceId: current?.workspaceId ?? null,
    workspace: current?.workspace ?? null,
    memberId: current?.memberId ?? null,
    role,
    /** null ở tenant Cá nhân. */
    accessVia: current?.accessVia ?? null,
    branchScope,
    memberships,
    isLoading,
    isError,
    can,
    canWriteClaim,
    selectWorkspace,
    // Phase 4 — tenant
    isPersonal,
    hasPersonalTenant,
    /** Họ tên KYC cá nhân đã duyệt (tên hiển thị của tenant Cá nhân), null nếu chưa có. */
    personalName: personal.data?.name ?? null,
    tenantKey,
    canWritePosting,
    canCreatePosting,
  };
}

/**
 * Ai được Xác nhận / Từ chối claim nào — bản sao owner_ws_claim_write_ok.
 * Chỉ Cán bộ bị giới hạn chi nhánh mới cần tra chi nhánh của claim
 * (asset_owner_id → workspace_branches.id); các vai trò khác không tải gì thêm.
 */
export function useClaimWriteAccess() {
  const { workspaceId, role, branchScope, can, canWriteClaim } = useOwnerWorkspace();
  const scoped = role === "staff" && branchScope != null;

  const { data: branchByOwner } = useQuery({
    queryKey: [...qk.ownerWorkspace.all(workspaceId), "branch-by-asset-owner"],
    enabled: !!workspaceId && scoped,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_branches")
        .select("id, asset_owner_id")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      return new Map(
        (data ?? []).flatMap((b) => (b.asset_owner_id ? [[b.asset_owner_id, b.id] as const] : [])),
      );
    },
  });

  const canWriteClaimOf = useCallback(
    (claim: { asset_owner_id: string | null }) =>
      canWriteClaim(claim.asset_owner_id ? branchByOwner?.get(claim.asset_owner_id) ?? null : null),
    [canWriteClaim, branchByOwner],
  );

  return {
    canWriteClaim: canWriteClaimOf,
    // "Xác nhận tất cả" cập nhật mọi claim chờ — người bị giới hạn phạm vi thì không.
    canConfirmAll: can("write") && !scoped,
  };
}
