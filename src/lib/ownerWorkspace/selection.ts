// Không gian đang chọn của người dùng thuộc NHIỀU không gian chủ tài sản.
//
// Ghi nhớ theo từng tài khoản trong localStorage — chỉ là tiện ích hiển thị,
// không phải trạng thái cần bền: đọc/ghi luôn bọc try/catch (chế độ riêng tư,
// storage bị chặn) và mọi trường hợp lỗi đều rơi về lựa chọn mặc định.

import type { OwnerWsAccess, OwnerWsRole } from "./roles";

const KEY_PREFIX = "owner-ws:selected:";
/** localStorage không bắn sự kiện "storage" trong CÙNG tab ⇒ tự bắn. */
const CHANGE_EVENT = "owner-ws-selection-change";

export function readSelectedWorkspace(userId: string | null | undefined): string | null {
  if (!userId) return null;
  try {
    return window.localStorage.getItem(KEY_PREFIX + userId);
  } catch {
    return null;
  }
}

export function writeSelectedWorkspace(userId: string, workspaceId: string): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, workspaceId);
  } catch {
    /* storage bị chặn — lựa chọn chỉ sống tới khi tải lại trang */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeSelectedWorkspace(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export interface SelectableMembership {
  workspaceId: string;
  role: OwnerWsRole;
  joinedAt: string | null;
  /** Thiếu = thành viên trực tiếp. */
  accessVia?: OwnerWsAccess;
}

const ROLE_RANK: Record<OwnerWsRole, number> = { owner: 0, staff: 1, viewer: 2 };
/** Trạm chi nhánh xem với tư cách trụ sở luôn xếp sau mọi nơi mình là thành viên. */
const HQ_RANK = 3;

const rankOf = (m: SelectableMembership) => (m.accessVia === "hq" ? HQ_RANK : ROLE_RANK[m.role]);

/**
 * Chọn không gian hiện tại: đúng cái đã lưu nếu người dùng còn là thành viên;
 * nếu không thì ưu tiên nơi mình là Trưởng đơn vị, rồi nơi tham gia sớm nhất;
 * Trạm chi nhánh xem qua liên kết trụ sở (Phase 14) xếp cuối.
 * KHÔNG ghi đè lựa chọn đã lưu — danh sách đang tải lại không được xoá nó.
 */
export function pickWorkspace<T extends SelectableMembership>(
  memberships: readonly T[],
  storedWorkspaceId: string | null,
): T | null {
  if (memberships.length === 0) return null;
  const stored = storedWorkspaceId
    ? memberships.find((m) => m.workspaceId === storedWorkspaceId)
    : undefined;
  if (stored) return stored;

  return [...memberships].sort((a, b) => {
    const byRole = rankOf(a) - rankOf(b);
    if (byRole !== 0) return byRole;
    return (a.joinedAt ?? "￿").localeCompare(b.joinedAt ?? "￿");
  })[0];
}

// ─── Tenant (Phase 4) ────────────────────────────────────────────────────────
// Một chủ tài sản có thể có NHIỀU tenant: mỗi không gian đang là thành viên + tenant
// "Cá nhân" (hồ sơ số hoá workspace_id NULL). Giá trị lưu trong localStorage là
// workspaceId hoặc hằng PERSONAL_TENANT.

export const PERSONAL_TENANT = "personal";

export type TenantPick<T> =
  | { kind: "workspace"; membership: T }
  | { kind: "personal" }
  | null;

/**
 * Chọn tenant hiện tại: đúng cái đã lưu nếu còn hợp lệ; nếu không thì theo thứ
 * tự Trưởng đơn vị → Cá nhân → Cán bộ/Người xem. Cá nhân đứng TRƯỚC nơi mình chỉ
 * là Cán bộ/Người xem: chủ tài sản cá nhân nhận lời mời làm Người xem ở một ngân
 * hàng thì vẫn mở cổng ra đúng "nhà" của mình như trước.
 */
export function pickTenant<T extends SelectableMembership>(
  memberships: readonly T[],
  hasPersonal: boolean,
  stored: string | null,
): TenantPick<T> {
  if (stored === PERSONAL_TENANT && hasPersonal) return { kind: "personal" };
  const storedMembership = stored ? memberships.find((m) => m.workspaceId === stored) : undefined;
  if (storedMembership) return { kind: "workspace", membership: storedMembership };

  const best = pickWorkspace(memberships, null);
  if (best?.role === "owner") return { kind: "workspace", membership: best };
  if (hasPersonal) return { kind: "personal" };
  return best ? { kind: "workspace", membership: best } : null;
}
