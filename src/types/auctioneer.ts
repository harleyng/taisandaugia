export type DataSource = 'CRAWLED' | 'MANUAL' | 'CRAWLED_USER_ENRICHED'
export type Position = 'DIRECTOR' | 'DEPUTY_DIRECTOR' | 'AUCTIONEER'
export type ContractType = 'OFFICIAL' | 'COLLABORATOR'
export type FieldSource = 'PUBLIC' | 'USER' | 'USER_OVERRIDE'
export type BadgeSource = 'AUTO' | 'USER_VERIFIED'

export const POSITION_LABELS: Record<Position, string> = {
  DIRECTOR: 'Giám đốc',
  DEPUTY_DIRECTOR: 'Phó Giám đốc',
  AUCTIONEER: 'Đấu giá viên',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  OFFICIAL: 'Chính thức',
  COLLABORATOR: 'Cộng tác viên',
}

export const FIELD_LABELS: Record<string, string> = {
  fullName: 'Họ tên',
  dateOfBirth: 'Ngày sinh',
  permanentAddress: 'Địa chỉ thường trú',
  professionalCertNumber: 'Số CCHN',
  licenseNumber: 'Số thẻ ĐGV',
  licenseIssuedDate: 'Ngày cấp thẻ',
  joinedDate: 'Ngày bắt đầu công tác',
}

export interface OverrideRecord {
  field: string
  originalValue: string
  overriddenValue: string
  reason: string
  overriddenAt: string
  overriddenBy: string
}

export type PublicFieldKey =
  | 'fullName'
  | 'dateOfBirth'
  | 'permanentAddress'
  | 'professionalCertNumber'
  | 'licenseNumber'
  | 'licenseIssuedDate'
  | 'joinedDate'

export const PUBLIC_FIELD_KEYS: PublicFieldKey[] = [
  'fullName',
  'dateOfBirth',
  'permanentAddress',
  'professionalCertNumber',
  'licenseNumber',
  'licenseIssuedDate',
  'joinedDate',
]

export interface Auctioneer {
  id: string
  orgId: string

  source: DataSource
  crawledAt?: string
  crawledFromUrl?: string
  isVerifiedByPublicSource: boolean

  fullName: string
  dateOfBirth?: string
  permanentAddress?: string
  professionalCertNumber: string
  professionalCertIssuedDate?: string
  licenseNumber: string
  licenseIssuedDate: string
  joinedDate: string

  fieldSources: Record<PublicFieldKey, FieldSource>

  overrides: OverrideRecord[]

  position: Position
  contractType: ContractType
  licenseExpiryDate?: string
  email?: string
  phone?: string
  internalNotes?: string
  endedDate?: string
  isActive: boolean

  attachedDocuments: string[]

  // ── Hồ sơ số hoá (mảng a: định danh mở rộng) ──
  // Tất cả optional để mọi nơi đang dùng Auctioneer không phải sửa gì.
  idNumber?: string
  idType?: 'CCCD' | 'PASSPORT'
  idIssuedDate?: string
  idIssuedPlace?: string
  hometown?: string
  ethnicity?: string
  nationality?: string
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  educationLevel?: string
  major?: string
  almaMater?: string
  /** Chức danh hiển thị công khai; rỗng thì suy ra từ `position`. */
  /**
   * Mốc bắt đầu hành nghề đấu giá — ngày cấp Thẻ ĐGV HOẶC ngày đăng ký danh
   * sách tại Sở Tư pháp (NĐ 05/2005, NĐ 17/2010), lấy mốc sớm nhất.
   * Rỗng thì suy ra từ licenseIssuedDate.
   */
  practiceStartDate?: string
  /** Ngày bắt đầu giữ chức quản lý (GĐ/Phó GĐ) — phục vụ IV.7 và tie-break V.2. */
  managementStartDate?: string
  publicTitle?: string
  /** URL trực tiếp trong bucket public personnel-portraits. */
  portraitUrl?: string
  /** Có hiện ở mục "Đội ngũ đấu giá viên" trên trang tổ chức hay không. */
  isPublicProfile?: boolean
  /** Cho phép khoe số cuộc / giá trị trúng / sở trường ở mục Đội ngũ công khai. */
  showPublicStats?: boolean
  dossierUpdatedAt?: string

  createdAt: string
  updatedAt: string
}

export interface ConflictRecord {
  auctioneerId: string
  field: string
  currentValue: string
  newValueFromCrawl: string
  detectedAt: string
}

export interface CrawlSession {
  id: string
  orgId: string
  initiatedBy: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'NO_DATA'
  startedAt: string
  completedAt?: string
  creditsCost: number
  results: {
    totalFound: number
    newlyAdded: number
    updated: number
    conflicts: ConflictRecord[]
  }
}

export interface AuctioneerWithComputed extends Auctioneer {
  yearsOfExperience: number
  daysUntilLicenseExpiry?: number
  badgeSource: BadgeSource
}

/**
 * Số năm hành nghề dùng để CHẤM ĐIỂM (TT19 mục IV.7, IV.8).
 *
 * Thẻ ĐGV chỉ tồn tại từ 1/7/2017. Ai hành nghề trước đó theo NĐ 17/2010 mà
 * tính từ ngày cấp thẻ sẽ hụt tới ~7 năm và rớt ngưỡng ≥5 năm / ≥10 năm —
 * mất điểm oan. Vì vậy luôn lấy mốc SỚM NHẤT giữa practiceStartDate và
 * licenseIssuedDate.
 */
export function computePracticeYears(a: {
  licenseIssuedDate: string
  practiceStartDate?: string
}): number {
  const dates = [a.licenseIssuedDate, a.practiceStartDate].filter(Boolean) as string[]
  if (dates.length === 0) return 0
  const earliest = dates.reduce((min, d) => (d < min ? d : min))
  return computeYearsOfExperience(earliest)
}

export function computeYearsOfExperience(licenseIssuedDate: string): number {
  try {
    const issued = new Date(licenseIssuedDate)
    const now = new Date()
    return Math.max(0, Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
  } catch {
    return 0
  }
}

export function computeDaysUntilExpiry(licenseExpiryDate?: string): number | undefined {
  if (!licenseExpiryDate) return undefined
  try {
    const expiry = new Date(licenseExpiryDate)
    const now = new Date()
    return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  } catch {
    return undefined
  }
}

export function getBadgeSource(auctioneer: Auctioneer, hasConflict: boolean): BadgeSource {
  if (auctioneer.source === 'MANUAL' || auctioneer.overrides.length > 0 || hasConflict) return 'USER_VERIFIED'
  return 'AUTO'
}

export function makeDefaultFieldSources(src: FieldSource): Record<PublicFieldKey, FieldSource> {
  return {
    fullName: src,
    dateOfBirth: src,
    permanentAddress: src,
    professionalCertNumber: src,
    licenseNumber: src,
    licenseIssuedDate: src,
    joinedDate: src,
  }
}
