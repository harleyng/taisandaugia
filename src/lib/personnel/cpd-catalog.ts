// Tra cứu THUẦN trên danh mục bồi dưỡng. Không I/O, không React — để engine
// cpd.ts, hồ sơ kết xuất (đồng bộ) và form khai báo dùng chung một cách hiểu.

import type {
  CpdActivityRole, CpdActivityType, CpdCatalog, CpdCreditMode, CpdExemptionReasonDef,
} from '@/types/cpd-catalog'
import type { DossierEvent } from '@/types/personnel'

/** Cách một bản ghi được tính vào nghĩa vụ. */
export interface CpdRule {
  mode: CpdCreditMode
  /** Quy đổi cố định mỗi lần tham gia; rỗng = lấy số giờ tổ chức tự khai. */
  fixedHours?: number
}

export interface CpdCatalogIndex {
  typeById: Map<string, CpdActivityType>
  roleById: Map<string, CpdActivityRole>
  reasonById: Map<string, CpdExemptionReasonDef>
}

export function indexCatalog(c: CpdCatalog): CpdCatalogIndex {
  const typeById = new Map<string, CpdActivityType>()
  const roleById = new Map<string, CpdActivityRole>()
  for (const t of c.activityTypes) {
    typeById.set(t.id, t)
    for (const r of t.roles) roleById.set(r.id, r)
  }
  return {
    typeById,
    roleById,
    reasonById: new Map(c.exemptionReasons.map((r) => [r.id, r])),
  }
}

/**
 * VAI TRÒ THẮNG HÌNH THỨC khi hình thức có phân vai trò. Đây là toàn bộ lý do
 * module này tồn tại: cùng một "hội thảo", báo cáo viên đạt cả năm còn người dự
 * chỉ được 4 giờ.
 *
 * Phải khớp tuyệt đối với CTE `records` trong RPC admin_cpd_report — lệch một
 * bên là hai màn hình ra hai con số cho cùng một người.
 */
export function ruleFor(
  type: CpdActivityType | undefined,
  role: CpdActivityRole | undefined,
): CpdRule | undefined {
  if (!type) return undefined
  if (type.hasRoles && role) return { mode: role.creditMode, fixedHours: role.fixedHours }
  return { mode: type.creditMode, fixedHours: type.fixedHours }
}

export type CpdRuleResolver = (e: DossierEvent) => CpdRule | undefined

/** Dựng hàm tra quy tắc cho engine — bản ghi chưa gắn hình thức trả undefined. */
export function makeCpdResolver(catalog: CpdCatalog): CpdRuleResolver {
  const ix = indexCatalog(catalog)
  return (e) => {
    if (!e.cpdActivityTypeId) return undefined
    return ruleFor(
      ix.typeById.get(e.cpdActivityTypeId),
      e.cpdActivityRoleId ? ix.roleById.get(e.cpdActivityRoleId) : undefined,
    )
  }
}

/** Số giờ một bản ghi thực sự đóng góp vào mốc 8 giờ/năm. */
export function creditedHoursOf(e: DossierEvent, rule: CpdRule | undefined): number {
  if (!rule || rule.mode !== 'HOURS') return 0
  return rule.fixedHours ?? e.hours ?? 0
}

/** Nhãn hiển thị: "Hội thảo, toạ đàm, diễn đàn — Báo cáo viên". */
export function formLabel(
  type: CpdActivityType | undefined,
  role: CpdActivityRole | undefined,
): string {
  if (!type) return ''
  return type.hasRoles && role ? `${type.name} — ${role.name}` : type.name
}

/** Nhãn của một bản ghi, tra thẳng từ catalog. Rỗng khi chưa gắn hình thức. */
export function eventFormLabel(e: DossierEvent, catalog: CpdCatalog): string {
  const ix = indexCatalog(catalog)
  return formLabel(
    e.cpdActivityTypeId ? ix.typeById.get(e.cpdActivityTypeId) : undefined,
    e.cpdActivityRoleId ? ix.roleById.get(e.cpdActivityRoleId) : undefined,
  )
}

/**
 * Chỉ những mục còn bật mới được chọn khi khai mới. Dòng đã tắt vẫn đọc được
 * để hiện đúng nhãn cho bản ghi lịch sử — nên lọc ở ĐIỂM CHỌN, không lọc ở
 * điểm nạp dữ liệu.
 */
export const selectableTypes = (c: CpdCatalog): CpdActivityType[] =>
  c.activityTypes.filter((t) => t.isActive)

export const selectableRoles = (t: CpdActivityType | undefined): CpdActivityRole[] =>
  (t?.roles ?? []).filter((r) => r.isActive)

export const selectableReasons = (c: CpdCatalog): CpdExemptionReasonDef[] =>
  c.exemptionReasons.filter((r) => r.isActive)

/**
 * Ô "Số giờ" hiện cho MỌI hình thức — hồ sơ kết xuất cần in số giờ thực tế của
 * khoá học kể cả khi hình thức đó đạt cả năm. Nhưng khoá lại khi có quy đổi cố
 * định: cho sửa thì con số trên màn hình sẽ khác con số được cộng.
 */
export const hoursFieldState = (rule: CpdRule | undefined): 'free' | 'fixed' => (
  rule?.mode === 'HOURS' && rule.fixedHours != null ? 'fixed' : 'free'
)
