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
