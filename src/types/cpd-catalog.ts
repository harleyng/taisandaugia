// Danh mục bồi dưỡng chuyên môn — master data do admin quản lý.
//
// Trước đây taxonomy này là hằng số trong types/personnel.ts (`CpdKind`,
// `CPD_ALTERNATIVE_KINDS`). Nó phải rời khỏi code vì cách tính phụ thuộc
// (HÌNH THỨC × VAI TRÒ) và đổi theo văn bản pháp lý — ví dụ làm báo cáo viên
// hội thảo là hoàn thành cả năm (Điều 26.2), còn đi dự hội thảo chỉ được quy
// đổi ít giờ. Hard-code hai thứ đó thành một mã là chấm sai tuân thủ.

/**
 * HOURS     — cộng giờ vào mốc 8 giờ/năm (Điều 26.1)
 * FULL_YEAR — hoàn thành nghĩa vụ cả năm, bất kể số giờ (Điều 26.2)
 */
export type CpdCreditMode = 'HOURS' | 'FULL_YEAR'

export const CPD_CREDIT_MODE_LABELS: Record<CpdCreditMode, string> = {
  HOURS: 'Tính theo giờ',
  FULL_YEAR: 'Hoàn thành nghĩa vụ cả năm',
}

export interface CpdActivityRole {
  id: string
  activityTypeId: string
  code: string
  name: string
  description?: string
  creditMode: CpdCreditMode
  /** Chỉ có nghĩa khi creditMode='HOURS'. Rỗng = tổ chức nhập giờ thực tế. */
  fixedHours?: number
  sortOrder: number
  isActive: boolean
}

export interface CpdActivityType {
  id: string
  code: string
  name: string
  description?: string
  legalBasis?: string
  /** true ⇒ cách tính nằm ở từng vai trò, hai trường dưới bị bỏ qua. */
  hasRoles: boolean
  creditMode: CpdCreditMode
  fixedHours?: number
  /** Nhãn động cho form khai báo — thay cho các nhánh `if (kind === 'X')` cũ. */
  titleLabel: string
  orgLabel: string
  /** Gợi ý giấy tờ xác nhận theo Điều 27.1. */
  evidenceHint?: string
  sortOrder: number
  isActive: boolean
  roles: CpdActivityRole[]
}

export interface CpdExemptionReasonDef {
  id: string
  code: string
  name: string
  description?: string
  legalBasis?: string
  /** true ⇒ chặn lưu nếu chưa đính kèm minh chứng. */
  requiresEvidence: boolean
  sortOrder: number
  isActive: boolean
}

export interface CpdCatalog {
  activityTypes: CpdActivityType[]
  exemptionReasons: CpdExemptionReasonDef[]
}

export const EMPTY_CPD_CATALOG: CpdCatalog = { activityTypes: [], exemptionReasons: [] }
