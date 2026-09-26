import type { OwnerWsRole } from "@/lib/ownerWorkspace/roles";

export interface ScopeLabel {
  /** Câu ngắn hiện trong bảng. */
  text: string;
  /** Danh sách đầy đủ cho tooltip khi phạm vi có nhiều chi nhánh. */
  detail?: string;
}

/**
 * Phạm vi chi nhánh chỉ có nghĩa với Cán bộ — Trưởng đơn vị và Người xem luôn
 * làm việc / xem trên toàn không gian. Id không còn trong danh sách (chi nhánh
 * đã xoá sau khi phân quyền) hiện thành "Chi nhánh đã xoá" thay vì biến mất.
 */
export function scopeLabel(
  role: OwnerWsRole,
  branchScope: readonly string[] | null,
  branchNames: ReadonlyMap<string, string>,
): ScopeLabel {
  if (role !== "staff") return { text: "Toàn bộ không gian" };
  if (!branchScope || branchScope.length === 0) return { text: "Toàn bộ chi nhánh" };

  const names = branchScope.map((id) => branchNames.get(id) ?? "Chi nhánh đã xoá");
  if (names.length === 1) return { text: names[0] };
  return { text: `${names.length} chi nhánh`, detail: names.join(", ") };
}
