export type DataSource = 'CRAWLED' | 'IMPORTED' | 'MANUAL' | 'CRAWLED_USER_ENRICHED'

export type AssetCategory =
  | 'LAND_USE_RIGHT'
  | 'REAL_ESTATE'
  | 'VEHICLE'
  | 'MACHINERY'
  | 'ADMIN_VIOLATION'
  | 'ENFORCEMENT'
  | 'SECURED_ASSET'
  | 'OTHER'

export type AuctionFormat =
  | 'DIRECT_VOICE'
  | 'DIRECT_PAPER'
  | 'ONLINE'
  | 'HYBRID'
  | 'SEALED_BID'

export type BiddingMethod = 'ASCENDING' | 'DESCENDING'

export type FieldSource = 'PUBLIC' | 'USER' | 'IMPORTED' | 'USER_OVERRIDE'

export type AuctionBadgeSource = 'AUTO' | 'USER_VERIFIED'

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  LAND_USE_RIGHT: 'Quyền sử dụng đất',
  REAL_ESTATE: 'Nhà ở, công trình',
  VEHICLE: 'Xe cộ',
  MACHINERY: 'Máy móc, thiết bị',
  ADMIN_VIOLATION: 'Tang vật VPHC',
  ENFORCEMENT: 'Thi hành án',
  SECURED_ASSET: 'Tài sản bảo đảm',
  OTHER: 'Khác',
}

export const AUCTION_FORMAT_LABELS: Record<AuctionFormat, string> = {
  DIRECT_VOICE: 'Trực tiếp bằng lời nói',
  DIRECT_PAPER: 'Trực tiếp bằng phiếu',
  ONLINE: 'Trực tuyến',
  HYBRID: 'Kết hợp',
  SEALED_BID: 'Bỏ phiếu kín',
}

export const BIDDING_METHOD_LABELS: Record<BiddingMethod, string> = {
  ASCENDING: 'Trả giá lên',
  DESCENDING: 'Đặt giá xuống',
}

export interface OverrideRecord {
  field: string
  originalValue: string
  overriddenValue: string
  reason?: string
  overriddenAt: string
}

export interface AuctionRecord {
  id: string
  orgId: string

  source: DataSource
  crawledAt?: string
  crawledFromUrl?: string
  importedAt?: string
  importBatchId?: string

  auctionDate: string
  auctionNumber?: string

  assetDescription: string
  assetCategory: AssetCategory
  assetCategoryConfidence?: number
  assetLocation?: string
  legalStatus?: string

  ownerName: string
  contractNumber?: string
  contractSignedDate?: string

  startingPrice: number

  fieldSources: Record<string, FieldSource>

  winningPrice?: number
  isSuccessful?: boolean
  failureReason?: string

  auctionFormat?: AuctionFormat
  biddingMethod?: BiddingMethod
  bidStep?: number
  bidStepPercentage?: number
  maxRounds?: number
  actualRounds?: number

  numberOfParticipants?: number
  numberOfBids?: number

  depositPercentage?: number

  overrides: OverrideRecord[]

  auctioneer?: string
  internalNotes?: string
  attachedDocuments: string[]
  tags?: string[]

  isVerifiedByUser: boolean
  isDisputed: boolean

  createdAt: string
  updatedAt: string
}

export interface AuctionRecordWithComputed extends AuctionRecord {
  priceDifference?: number
  priceDifferencePercentage?: number
  isAboveTenPercent?: boolean
  enrichmentStatus: EnrichmentStatus
  badgeSource: AuctionBadgeSource
}

export interface EnrichmentStatus {
  hasWinningPrice: boolean
  hasFormat: boolean
  hasBidStep: boolean
  completionPercentage: number
}

export interface AuctionHistoryScore {
  year: number
  iv1: { count: number; score: number; max: 5 }
  iv2: { count: number; score: number; max: 5 }
  iv3: { count: number; score: number; max: 5 }
  iv4: { count: number; score: number; max: 6 }
  total: number
  maxTotal: 21
}

export interface AuctionCrawlSession {
  id: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  newAuctionsFound: number
  updatedAuctions: number
  startedAt: string
  completedAt?: string
  creditsCost: number
}

export interface ImportSession {
  id: string
  fileName: string
  fileSize: number
  totalRows: number
  successRows: number
  errorRows: number
  duplicateRows: number
  errors: Array<{ row: number; field: string; message: string }>
  importedAt: string
  importedBy: string
}

export interface ConflictRecord {
  recordId: string
  field: string
  currentValue: string
  newValueFromCrawl: string
  detectedAt: string
}

export function computePriceDifference(record: AuctionRecord): {
  priceDifference?: number
  priceDifferencePercentage?: number
  isAboveTenPercent?: boolean
} {
  if (!record.winningPrice || !record.isSuccessful) return {}
  const diff = record.winningPrice - record.startingPrice
  const pct = record.startingPrice > 0 ? (diff / record.startingPrice) * 100 : 0
  return {
    priceDifference: diff,
    priceDifferencePercentage: Math.round(pct * 100) / 100,
    isAboveTenPercent: pct >= 10,
  }
}

export function computeEnrichmentStatus(record: AuctionRecord): EnrichmentStatus {
  const hasWinningPrice = record.winningPrice !== undefined
  const hasFormat = record.auctionFormat !== undefined
  const hasBidStep = record.bidStep !== undefined
  const filled = [hasWinningPrice, hasFormat, hasBidStep].filter(Boolean).length
  return {
    hasWinningPrice,
    hasFormat,
    hasBidStep,
    completionPercentage: Math.round((filled / 3) * 100),
  }
}

export function getAuctionBadgeSource(record: AuctionRecord): AuctionBadgeSource {
  if (record.source === 'CRAWLED' && record.overrides.length === 0) return 'AUTO'
  return 'USER_VERIFIED'
}
