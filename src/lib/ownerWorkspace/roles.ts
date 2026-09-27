// Quyền của người dùng trong một không gian chủ tài sản ("Trạm Điều Hành").
//
// Mỗi Trạm có bộ vai trò RIÊNG (owner_ws_roles) + ma trận module × thao tác
// (owner_ws_role_permissions) — danh mục ở ./permissions.ts. Vai trò hệ thống OWNER
// "Trưởng đơn vị" luôn toàn quyền.
//
// BẢN SAO phía client của owner_ws_has / owner_ws_branch_ok / owner_ws_claim_write_ok /
// owner_posting_row_can (migration 20260927170100). Chỉ dùng để ẨN nút; quyền thật
// luôn do RLS + RPC quyết định. Đổi luật ở SQL thì phải sửa cả ở đây.

import {
  fullOwnerMatrix,
  HQ_VIEW_MATRIX,
  ownerMatrixHas,
  ownerMatrixSubset,
  type OwnerAction,
  type OwnerModule,
  type OwnerPermissionMatrix,
} from "./permissions";

/**
 * Cách người dùng vào một không gian (Phase 14): thành viên trực tiếp, hay Trưởng
 * đơn vị của TRỤ SỞ đã được chi nhánh chấp nhận liên kết — chỉ đọc, và không thấy
 * thành viên / vai trò của chi nhánh.
 */
export type OwnerWsAccess = "member" | "hq";

export const HQ_ACCESS_LABEL = "Trụ sở · chỉ xem";
export const OWNER_ROLE_LABEL = "Trưởng đơn vị";

/** Ngữ cảnh quyền của người dùng ở MỘT không gian. null = không phải thành viên. */
export interface OwnerWsAccessCtx {
  /** Vai trò hệ thống OWNER — toàn quyền, không bao giờ bị giới hạn chi nhánh. */
  isOwner: boolean;
  /** Quyền của vai trò (OWNER ⇒ đầy đủ; trụ sở ⇒ HQ_VIEW_MATRIX). */
  matrix: OwnerPermissionMatrix;
  /** NULL = toàn bộ không gian. */
  branchScope: readonly string[] | null;
}

/** Dựng ngữ cảnh từ dòng vai trò đã embed (hoặc trụ sở đã liên kết). */
export function ownerAccessCtx(input: {
  isOwner: boolean;
  matrix: OwnerPermissionMatrix;
  branchScope: readonly string[] | null;
  accessVia?: OwnerWsAccess;
}): OwnerWsAccessCtx {
  if (input.accessVia === "hq") return { isOwner: false, matrix: HQ_VIEW_MATRIX, branchScope: null };
  return {
    isOwner: input.isOwner,
    matrix: input.isOwner ? fullOwnerMatrix() : input.matrix,
    branchScope: input.isOwner ? null : input.branchScope,
  };
}

/** Bản sao owner_ws_has. */
export function ownerCan(
  ctx: OwnerWsAccessCtx | null | undefined,
  module: OwnerModule,
  action: OwnerAction,
): boolean {
  if (!ctx) return false;
  return ctx.isOwner || ownerMatrixHas(ctx.matrix, module, action);
}

/**
 * Bản sao owner_ws_branch_ok: Trưởng đơn vị hoặc người không bị giới hạn ⇒ true;
 * bản ghi không thuộc chi nhánh nào (branchId null) ⇒ chỉ người không bị giới hạn.
 */
export function ownerBranchOk(ctx: OwnerWsAccessCtx | null | undefined, branchId: string | null): boolean {
  if (!ctx) return false;
  if (ctx.isOwner || ctx.branchScope == null) return true;
  return branchId != null && ctx.branchScope.includes(branchId);
}

/** Bản sao owner_ws_has_in = quyền module + phạm vi chi nhánh của bản ghi. */
export function ownerCanIn(
  ctx: OwnerWsAccessCtx | null | undefined,
  module: OwnerModule,
  action: OwnerAction,
  branchId: string | null,
): boolean {
  return ownerCan(ctx, module, action) && ownerBranchOk(ctx, branchId);
}

/** Bị giới hạn chi nhánh (form phải bắt chọn chi nhánh trong phạm vi). */
export function ownerIsScoped(ctx: OwnerWsAccessCtx | null | undefined): boolean {
  return !!ctx && !ctx.isOwner && ctx.branchScope != null;
}

/**
 * Bản sao owner_ws_claim_write_ok. `branchIdOfClaim` = workspace_branches.id có
 * cùng asset_owner_id với claim (null nếu claim không thuộc chi nhánh nào).
 */
export function canWriteClaim(ctx: OwnerWsAccessCtx | null | undefined, branchIdOfClaim: string | null): boolean {
  return ownerCanIn(ctx, "tai-san", "update", branchIdOfClaim);
}

/** Phần của một hồ sơ số hoá quyết định quyền (asset_postings). */
export interface PostingOwnership {
  workspace_id: string | null;
  branch_id: string | null;
  user_id: string;
}

/**
 * Bản sao owner_posting_row_can(…, module, action) (migration 20260927170100):
 * hồ sơ cá nhân ⇒ chỉ người tạo; hồ sơ của không gian ⇒ quyền module + phạm vi chi
 * nhánh. `ctxOfWorkspace` là quyền của người dùng Ở CHÍNH không gian của hồ sơ
 * (không phải tenant đang chọn) — null nếu không là thành viên.
 */
export function canWritePosting(
  posting: PostingOwnership,
  userId: string | null | undefined,
  ctxOfWorkspace: OwnerWsAccessCtx | null,
  module: OwnerModule = "so-hoa",
  action: OwnerAction = "update",
): boolean {
  if (!posting.workspace_id) return !!userId && posting.user_id === userId;
  return ownerCanIn(ctxOfWorkspace, module, action, posting.branch_id);
}

/**
 * Người có ngữ cảnh `caller` có được gán / mời / chỉnh một vai trò không — bản sao
 * luật chống leo quyền owner_ws_role_within_user: Trưởng đơn vị luôn được; vai trò
 * Trưởng đơn vị chỉ Trưởng đơn vị; còn lại quyền của vai trò phải nằm trong quyền mình.
 */
export function roleWithinCaller(
  role: { isSystem: boolean; matrix: OwnerPermissionMatrix },
  caller: OwnerWsAccessCtx | null | undefined,
): boolean {
  if (!caller) return false;
  if (caller.isOwner) return true;
  if (role.isSystem) return false;
  return ownerMatrixSubset(role.matrix, caller.matrix);
}

/** Nhãn vai trò hiển thị cho một không gian (tenant). */
export function ownerWsAccessLabel(roleName: string, accessVia: OwnerWsAccess): string {
  return accessVia === "hq" ? HQ_ACCESS_LABEL : roleName;
}

// ─── Tên cổng (Phase 15a) ────────────────────────────────────────────────────

export const STATION_NAME = "Trạm Điều Hành";
export const TOWER_NAME = "Tháp Điều Hành";

/** Phần của một membership mà tên cổng cần (khớp OwnerWorkspaceMembership). */
export interface PortalNameMembership {
  accessVia: OwnerWsAccess;
  workspace: { parent_workspace_id?: string | null };
}

/**
 * "Tháp Điều Hành" khi Trạm đang chọn là trụ sở CÓ ít nhất một Trạm con đã liên kết
 * mà người dùng đọc được (chỉ Trưởng đơn vị trụ sở mới có các dòng accessVia 'hq'),
 * ngược lại "Trạm Điều Hành".
 */
export function ownerPortalName(workspaceId: string | null | undefined, memberships: PortalNameMembership[]): string {
  if (!workspaceId) return STATION_NAME;
  return memberships.some((m) => m.accessVia === "hq" && m.workspace.parent_workspace_id === workspaceId)
    ? TOWER_NAME
    : STATION_NAME;
}
