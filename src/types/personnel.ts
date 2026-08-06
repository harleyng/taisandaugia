// Kiểu cho phần hồ sơ số hoá của đấu giá viên / lãnh đạo.
// Phần định danh nằm ngay trên `Auctioneer` (src/types/auctioneer.ts); đây là
// các thực thể con: giấy tờ, dòng thời gian, và bản chiếu công khai.

export type DocType =
  | 'DGV_CARD'
  | 'CCHN'
  | 'DEGREE'
  | 'TRAINING_CERT'
  | 'CRIMINAL_RECORD'
  | 'LABOR_CONTRACT'
  | 'PORTRAIT'
  | 'OTHER'

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  DGV_CARD: 'Thẻ đấu giá viên',
  CCHN: 'Chứng chỉ hành nghề',
  DEGREE: 'Bằng cấp',
  TRAINING_CERT: 'Chứng chỉ đào tạo nghề đấu giá',
  CRIMINAL_RECORD: 'Lý lịch tư pháp',
  LABOR_CONTRACT: 'Hợp đồng lao động',
  PORTRAIT: 'Ảnh chân dung',
  OTHER: 'Giấy tờ khác',
}

export const DOC_TYPE_ORDER: DocType[] = [
  'DGV_CARD',
  'CCHN',
  'DEGREE',
  'TRAINING_CERT',
  'CRIMINAL_RECORD',
  'LABOR_CONTRACT',
  'PORTRAIT',
  'OTHER',
]

// AUCTION đã bỏ: cuộc đấu giá đọc thẳng từ module Lịch sử đấu giá lúc kết
// xuất (auction-source.ts), không lưu bản sao trong hồ sơ.
export type EventType = 'WORK' | 'TRAINING' | 'REWARD' | 'DISCIPLINE'

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WORK: 'Quá trình công tác',
  TRAINING: 'Đào tạo & bồi dưỡng',
  REWARD: 'Khen thưởng',
  DISCIPLINE: 'Kỷ luật',
}

// ─── Bồi dưỡng chuyên môn hằng năm (TT 19/2024/TT-BTP) ──────────────────────
//
// Taxonomy (hình thức, vai trò, cách quy đổi giờ, trường hợp miễn) KHÔNG còn ở
// đây — nó là master data admin quản lý, xem @/types/cpd-catalog và bảng
// cpd_activity_types / cpd_activity_roles / cpd_exemption_reasons.
//
// Lý do dời đi: cách tính phụ thuộc (HÌNH THỨC × VAI TRÒ). Bản hằng số cũ gộp
// "làm báo cáo viên hội thảo" (đạt cả năm, Điều 26.2) với "đi dự hội thảo" (chỉ
// quy đổi ít giờ) vào một mã 'SPEAKER' ⇒ ai đi nghe hội thảo cũng được chấm đạt.

export interface CpdExemption {
  id: string
  auctioneerId: string
  organizationId: string
  year: number
  /** Trỏ sang cpd_exemption_reasons — danh mục do admin quản lý. */
  reasonId: string
  note?: string
  /** Ngày đã nộp giấy tờ cho Sở Tư pháp — hạn luật định 15/12 hằng năm. */
  filedAt?: string
  attachments: string[]
  createdAt: string
  updatedAt: string
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
}

export type IdType = 'CCCD' | 'PASSPORT'

export const ID_TYPE_LABELS: Record<IdType, string> = {
  CCCD: 'CCCD',
  PASSPORT: 'Hộ chiếu',
}

export interface PersonnelDocument {
  id: string
  auctioneerId: string
  organizationId: string
  docType: DocType
  title?: string
  docNumber?: string
  issuer?: string
  issuedDate?: string
  expiryDate?: string
  filePaths: string[]
  notes?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface DossierEvent {
  id: string
  auctioneerId: string
  organizationId: string
  eventType: EventType
  title: string
  organizationName?: string
  role?: string
  startedOn?: string
  endedOn?: string
  referenceNo?: string
  outcome?: string
  amount?: number
  hours?: number
  notes?: string
  attachments: string[]
  /** Năm được tính nghĩa vụ bồi dưỡng. Chỉ có nghĩa với eventType 'TRAINING'. */
  cpdYear?: number
  /** Rỗng = bản ghi đào tạo không thuộc diện bồi dưỡng bắt buộc hằng năm. */
  cpdActivityTypeId?: string
  /** Bắt buộc khi hình thức có `hasRoles` — cách tính giờ nằm ở vai trò. */
  cpdActivityRoleId?: string
  /**
   * Cờ "Trung tâm dịch vụ đấu giá tài sản (Sở Tư pháp)" — chỉ dùng cho WORK.
   * Nơi công tác vốn là text tự do nên không đếm được để chấm TT19 mục V.2.
   */
  isStateAuctionCenter?: boolean
  sourceRecordId?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** Đúng những gì RPC public_org_auctioneers trả về — không hơn. */
export interface PublicAuctioneer {
  id: string
  full_name: string
  title: string
  license_number: string
  license_issued_date: string
  years_of_experience: number
  portrait_url: string | null
  /** Chỉ có giá trị khi ĐGV bật show_public_stats; ngược lại null. */
  total_auctions: number | null
  successful_auctions: number | null
  total_winning_value: number | null
  top_category: string | null
}

export interface DossierCompleteness {
  /** 0..1 */
  ratio: number
  identityDone: boolean
  documentsDone: boolean
  careerDone: boolean
  trainingDone: boolean
  missing: string[]
}
