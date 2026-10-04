import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import {
  canWriteClaim as canWriteClaimFor,
  canWritePosting as canWritePostingFor,
  HQ_ACCESS_LABEL,
  ownerAccessCtx,
  ownerCan,
  ownerCanIn,
  ownerIsScoped,
  type OwnerWsAccess,
  type OwnerWsAccessCtx,
  type PostingOwnership,
} from "@/lib/ownerWorkspace/roles";
import {
  HQ_VIEW_MATRIX,
  ownerMatrixFromRows,
  ownerMatrixHasWrite,
  type OwnerAction,
  type OwnerModule,
} from "@/lib/ownerWorkspace/permissions";
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
  /** NULL khi vào qua liên kết trụ sở. */
  roleId: string | null;
  /** Tên vai trò để hiển thị ("Trụ sở · chỉ xem" khi vào qua liên kết). */
  roleName: string;
  /** Vai trò hệ thống Trưởng đơn vị (owner_ws_roles.is_system). */
  isOwner: boolean;
  /** Vai trò có ít nhất một quyền khác "Xem" — dùng xếp thứ tự tenant. */
  hasWrite: boolean;
  /** Quyền hiệu lực ở Trạm này: OWNER đầy đủ, trụ sở chỉ xem. */
  access: OwnerWsAccessCtx;
  /** NULL = toàn bộ không gian. */
  branchScope: string[] | null;
  joinedAt: string | null;
  workspace: AssetOwnerWorkspace;
  /** "hq" = Trạm chi nhánh đã chấp nhận liên kết với Trạm mình làm Trưởng đơn vị — chỉ đọc. */
  accessVia: OwnerWsAccess;
}

const NO_MEMBERSHIPS: OwnerWorkspaceMembership[] = [];

/**
 * Các không gian chủ tài sản mà người dùng là thành viên ĐANG HOẠT ĐỘNG (kèm vai trò
 * + ma trận quyền của vai trò), rồi tới các Trạm chi nhánh đã liên kết với nơi mình
 * là Trưởng đơn vị (Phase 14 — chỉ xem, xếp sau). Là thành viên trực tiếp của chính
 * chi nhánh đó thì dòng thành viên thắng. Lọc user_id là bắt buộc: policy đọc của
 * bảng thành viên trả cả dòng của đồng nghiệp trong cùng không gian.
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
          "id, workspace_id, role_id, branch_scope, joined_at, workspace:asset_owner_workspaces!asset_owner_workspace_members_workspace_id_fkey(*), ws_role:owner_ws_roles!asset_owner_workspace_members_role_id_fkey(id, name, is_system, permissions:owner_ws_role_permissions(module, action))",
        )
        .eq("user_id", userId!)
        .eq("status", "active");
      if (error) throw error;
      const direct: OwnerWorkspaceMembership[] = (data ?? []).flatMap((row) => {
        if (!row.workspace || !row.ws_role) return [];
        const isOwner = row.ws_role.is_system;
        const matrix = ownerMatrixFromRows(row.ws_role.permissions ?? []);
        const access = ownerAccessCtx({ isOwner, matrix, branchScope: row.branch_scope });
        return [
          {
            memberId: row.id,
            workspaceId: row.workspace_id,
            roleId: row.ws_role.id,
            roleName: row.ws_role.name,
            isOwner,
            hasWrite: isOwner || ownerMatrixHasWrite(matrix),
            access,
            branchScope: access.branchScope ? [...access.branchScope] : null,
            joinedAt: row.joined_at,
            workspace: row.workspace as AssetOwnerWorkspace,
            accessVia: "member" as const,
          },
        ];
      });

      const ownerOf = direct.filter((m) => m.isOwner).map((m) => m.workspaceId);
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
          roleId: null,
          roleName: HQ_ACCESS_LABEL,
          isOwner: false,
          hasWrite: false,
          access: ownerAccessCtx({ isOwner: false, matrix: HQ_VIEW_MATRIX, branchScope: null, accessVia: "hq" }),
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
 * `can(module, action)` / `canIn` / `canWriteClaim` / `canWritePosting` chỉ để ẩn
 * nút; RLS mới là cổng thật (owner_ws_has — migration 20260927170100).
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

  const access = current?.access ?? null;
  const branchScope = current?.branchScope ?? null;

  const can = useCallback((module: OwnerModule, action: OwnerAction) => ownerCan(access, module, action), [access]);
  /** Quyền module + phạm vi chi nhánh của bản ghi (null = bản ghi toàn đơn vị). */
  const canIn = useCallback(
    (module: OwnerModule, action: OwnerAction, branchId: string | null) => ownerCanIn(access, module, action, branchId),
    [access],
  );
  const canWriteClaim = useCallback(
    (branchIdOfClaim: string | null) => canWriteClaimFor(access, branchIdOfClaim),
    [access],
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
  // Mặc định so-hoa:update; ký gửi / hợp đồng mua bán truyền module của mình.
  const canWritePosting = useCallback(
    (posting: PostingOwnership, module: OwnerModule = "so-hoa", action: OwnerAction = "update") => {
      const m = posting.workspace_id ? memberships.find((x) => x.workspaceId === posting.workspace_id) : null;
      return canWritePostingFor(posting, userId, m?.access ?? null, module, action);
    },
    [memberships, userId],
  );
  /** Quyền của trang chi tiết hồ sơ (PostingAccessProvider): sửa / ký gửi / gửi tổ chức / chia sẻ. */
  const postingAccess = useCallback(
    (posting: PostingOwnership) => ({
      edit: canWritePosting(posting),
      consign: canWritePosting(posting, "ky-gui", "update"),
      consignCreate: canWritePosting(posting, "ky-gui", "create"),
      share: canWritePosting(posting, "so-hoa", "share"),
    }),
    [canWritePosting],
  );
  // Tạo hồ sơ mới trong tenant hiện tại. Người bị giới hạn chi nhánh vẫn tạo được —
  // wizard bắt chọn chi nhánh trong phạm vi.
  const canCreatePosting = isPersonal || ownerCan(access, "so-hoa", "create");

  return {
    userId,
    workspaceId: current?.workspaceId ?? null,
    workspace: current?.workspace ?? null,
    memberId: current?.memberId ?? null,
    roleId: current?.roleId ?? null,
    /** Tên vai trò ở không gian hiện tại; null ở tenant Cá nhân. */
    roleName: current?.roleName ?? null,
    isOwner: current?.isOwner ?? false,
    /** Bị giới hạn chi nhánh — form phải bắt chọn chi nhánh trong phạm vi. */
    isScoped: ownerIsScoped(access),
    /** Ngữ cảnh quyền cho các hàm thuần (vd. ownerPeriodicReport); null ở tenant Cá nhân. */
    access,
    /** null ở tenant Cá nhân. */
    accessVia: current?.accessVia ?? null,
    branchScope,
    memberships,
    isLoading,
    isError,
    can,
    canIn,
    canWriteClaim,
    selectWorkspace,
    // Phase 4 — tenant
    isPersonal,
    hasPersonalTenant,
    /** Họ tên KYC cá nhân đã duyệt (tên hiển thị của tenant Cá nhân), null nếu chưa có. */
    personalName: personal.data?.name ?? null,
    tenantKey,
    canWritePosting,
    postingAccess,
    canCreatePosting,
  };
}

/**
 * Quyền trên từng claim theo chi nhánh của claim — bản sao owner_ws_claim_write_ok
 * (Xác nhận / Từ chối = tai-san:update) và owner_ws_has_in cho module khác (vd.
 * Khai kết quả = ket-qua:update). Chỉ người bị giới hạn chi nhánh mới cần tra chi
 * nhánh của claim (asset_owner_id → workspace_branches.id); người khác không tải gì thêm.
 */
export function useClaimWriteAccess() {
  const { workspaceId, isScoped: scoped, can, canIn, canWriteClaim } = useOwnerWorkspace();

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

  const branchOfClaim = useCallback(
    (claim: { asset_owner_id: string | null }) =>
      claim.asset_owner_id ? branchByOwner?.get(claim.asset_owner_id) ?? null : null,
    [branchByOwner],
  );
  const canWriteClaimOf = useCallback(
    (claim: { asset_owner_id: string | null }) => canWriteClaim(branchOfClaim(claim)),
    [canWriteClaim, branchOfClaim],
  );
  /** Quyền module khác trên tài sản của claim (theo chi nhánh của claim). */
  const canOnClaim = useCallback(
    (module: OwnerModule, action: OwnerAction, claim: { asset_owner_id: string | null }) =>
      canIn(module, action, branchOfClaim(claim)),
    [canIn, branchOfClaim],
  );

  return {
    canWriteClaim: canWriteClaimOf,
    canOnClaim,
    // "Xác nhận tất cả" cập nhật mọi claim chờ — người bị giới hạn phạm vi thì không.
    canConfirmAll: can("tai-san", "update") && !scoped,
  };
}
