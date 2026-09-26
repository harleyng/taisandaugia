// Vai trò trong không gian chủ tài sản ("Trạm Điều Hành") — docs/owner-control-tower-plan.md §A2.
//
// BẢN SAO phía client của owner_ws_can / owner_ws_branch_ok / owner_ws_claim_write_ok
// (migration 20260926000001 + 20260926140447). Chỉ dùng để ẨN nút; quyền thật
// luôn do RLS + RPC quyết định. Đổi ma trận ở SQL thì phải sửa cả ở đây.

export type OwnerWsRole = "owner" | "staff" | "viewer";

export type OwnerWsAction =
  | "read"
  | "write"
  | "manage_members"
  | "manage_workspace"
  | "send_report";

export const OWNER_WS_ROLES: readonly OwnerWsRole[] = ["owner", "staff", "viewer"];

/** Lời mời chỉ mang Cán bộ / Người xem; Trưởng đơn vị được trao sau khi đã tham gia. */
export const INVITABLE_ROLES: readonly OwnerWsRole[] = ["staff", "viewer"];

export const OWNER_WS_ROLE_LABEL: Record<OwnerWsRole, string> = {
  owner: "Trưởng đơn vị",
  staff: "Cán bộ",
  viewer: "Người xem",
};

/**
 * Cách người dùng vào một không gian (Phase 14): thành viên trực tiếp, hay Trưởng
 * đơn vị của TRỤ SỞ đã được chi nhánh chấp nhận liên kết — chỉ đọc, như Người xem,
 * nhưng không thấy danh sách thành viên chi nhánh.
 */
export type OwnerWsAccess = "member" | "hq";

export const HQ_ACCESS_LABEL = "Trụ sở · chỉ xem";

/** Nhãn vai trò hiển thị cho một không gian (tenant). */
export function ownerWsAccessLabel(role: OwnerWsRole, accessVia: OwnerWsAccess): string {
  return accessVia === "hq" ? HQ_ACCESS_LABEL : OWNER_WS_ROLE_LABEL[role];
}

export const OWNER_WS_ROLE_DESCRIPTION: Record<OwnerWsRole, string> = {
  owner: "Toàn quyền: quản lý thành viên, chi nhánh và gửi báo cáo.",
  staff: "Xử lý tài sản và kết quả phiên trong phạm vi chi nhánh được giao.",
  viewer: "Chỉ xem số liệu, không chỉnh sửa.",
};

const ROLE_ACTIONS: Record<OwnerWsRole, readonly OwnerWsAction[]> = {
  owner: ["read", "write", "manage_members", "manage_workspace", "send_report"],
  staff: ["read", "write"],
  viewer: ["read"],
};

export function isOwnerWsRole(value: unknown): value is OwnerWsRole {
  return typeof value === "string" && (OWNER_WS_ROLES as readonly string[]).includes(value);
}

/**
 * Bản sao owner_ws_can. Không phải thành viên (role null) ⇒ false. Trụ sở đã liên
 * kết được gán role "viewer" ở phía client (useOwnerWorkspaceMemberships) — khớp
 * nhánh chỉ-'read' của owner_ws_can (migration 20260926185917).
 */
export function ownerWsCan(role: OwnerWsRole | null | undefined, action: OwnerWsAction): boolean {
  return !!role && ROLE_ACTIONS[role].includes(action);
}

export interface OwnerWsScope {
  role: OwnerWsRole | null;
  /** NULL = toàn bộ không gian. */
  branchScope: readonly string[] | null;
}

/**
 * Bản sao owner_ws_branch_ok: Trưởng đơn vị hoặc người không bị giới hạn ⇒ true;
 * bản ghi không thuộc chi nhánh nào (branchId null) ⇒ chỉ người không bị giới hạn.
 */
export function ownerWsBranchOk(scope: OwnerWsScope, branchId: string | null): boolean {
  if (!scope.role) return false;
  if (scope.role === "owner" || scope.branchScope == null) return true;
  return branchId != null && scope.branchScope.includes(branchId);
}

/**
 * Bản sao owner_ws_claim_write_ok. `branchIdOfClaim` = workspace_branches.id có
 * cùng asset_owner_id với claim (null nếu claim không thuộc chi nhánh nào).
 */
export function canWriteClaim(scope: OwnerWsScope, branchIdOfClaim: string | null): boolean {
  return ownerWsCan(scope.role, "write") && ownerWsBranchOk(scope, branchIdOfClaim);
}

/** Phần của một hồ sơ số hoá quyết định quyền (asset_postings). */
export interface PostingOwnership {
  workspace_id: string | null;
  branch_id: string | null;
  user_id: string;
}

/**
 * Bản sao owner_posting_row_can(…, 'write') (migration 20260926152759):
 * hồ sơ cá nhân ⇒ chỉ người tạo; hồ sơ của không gian ⇒ vai trò có quyền ghi +
 * phạm vi chi nhánh. `scopeOfWorkspace` là vai trò của người dùng Ở CHÍNH không
 * gian của hồ sơ (không phải tenant đang chọn) — null nếu không là thành viên.
 */
export function canWritePosting(
  posting: PostingOwnership,
  userId: string | null | undefined,
  scopeOfWorkspace: OwnerWsScope | null,
): boolean {
  if (!posting.workspace_id) return !!userId && posting.user_id === userId;
  if (!scopeOfWorkspace) return false;
  return ownerWsCan(scopeOfWorkspace.role, "write") && ownerWsBranchOk(scopeOfWorkspace, posting.branch_id);
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
