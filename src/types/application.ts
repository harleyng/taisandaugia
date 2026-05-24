export type ExportFormat = 'SEPARATED' | 'INTEGRATED' | 'CUSTOM'

export type AssetCategory =
  | 'LAND_USE_RIGHT'   // QSDĐ
  | 'ADMIN_VIOLATION'  // Tang vật VPHC
  | 'ENFORCEMENT'      // Thi hành án
  | 'MACHINERY'        // Máy móc
  | 'VEHICLE'          // Phương tiện
  | 'OTHER'

export type ApplicationStatus = 'DRAFT' | 'EXPORTED' | 'SUBMITTED' | 'WON' | 'LOST'

export interface Announcement {
  ownerName: string
  assetDescription: string
  assetCategory: AssetCategory | ''
  startingPrice: number | ''
  assetLocation: string
  province: string
  deadline: string // ISO date
  announcementUrl: string
  announcementNumber: string
  announcementDate: string // ISO date
}

export interface AuctionPlan {
  format: string              // 3.1 hình thức, bước giá, số vòng
  receptionPlan: string       // 3.2 bán/tiếp nhận hồ sơ
  participantConditions: string // 3.3 đối tượng, điều kiện tham gia
  antiCollusionMeasures: string // 3.4 giải pháp giám sát, chống thông đồng
  score: number               // /16 auto-calculated
}

export type CriterionNature = 'CAPACITY' | 'PROPOSAL'
export type CriterionMeets = true | false | null

export interface SectionVCriterion {
  id: string
  label: string
  maxPoints: number
  nature: CriterionNature
  natureAutoDetected: boolean
  meets: CriterionMeets
  evidence: string
  attachedDocIds: string[]
  autoMatchResult?: {
    matched: boolean
    matchedItems: string[]
  }
}

export interface CapacitySnapshot {
  scoreI: number
  scoreII: number
  scoreIV1to4: number
  scoreIV5: number
  scoreIV6to8: number
  scoreIV9: number
  totalCapacityScore: number // /76
  warnings: string[]
  snapshotAt: string // ISO datetime
}

export interface ExportedFile {
  url: string
  name: string
  exportedAt: string
}

export interface Application {
  id: string
  orgId: string
  name?: string   // user-set display name, takes priority over derived title

  announcement: Announcement

  capacitySnapshot: CapacitySnapshot

  auctionPlan: AuctionPlan

  sectionVCriteria: SectionVCriterion[]
  sectionVScore: number // /8, can exceed

  exportFormat: ExportFormat | null

  totalScore: number // /100 auto-calculated
  status: ApplicationStatus
  exportedFiles: ExportedFile[]

  createdAt: string
  updatedAt: string
}
