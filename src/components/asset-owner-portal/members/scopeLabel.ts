export interface ScopeLabel {
  /** Câu ngắn hiện trong bảng. */
  text: string;
  /** Danh sách đầy đủ cho tooltip khi phạm vi có nhiều chi nhánh. */
  detail?: string;
}

/**
 * Phạm vi chi nhánh của một thành viên / lời mời. Trưởng đơn vị luôn làm việc trên
 * toàn không gian; mọi vai trò khác có thể bị giới hạn chi nhánh. Id không còn
 * trong danh sách (chi nhánh đã xoá sau khi phân quyền) hiện thành "Chi nhánh đã
 * xoá" thay vì biến mất.
 */
export function scopeLabel(
  isOwner: boolean,
  branchScope: readonly string[] | null,
  branchNames: ReadonlyMap<string, string>,
): ScopeLabel {
  if (isOwner || !branchScope || branchScope.length === 0) return { text: "Toàn bộ không gian" };

  const names = branchScope.map((id) => branchNames.get(id) ?? "Chi nhánh đã xoá");
  if (names.length === 1) return { text: names[0] };
  return { text: `${names.length} chi nhánh`, detail: names.join(", ") };
}
