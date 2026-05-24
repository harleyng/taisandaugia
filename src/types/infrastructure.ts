export interface PhotoAttachment {
  id: string
  documentId: string
  storagePath: string
  url?: string
  fileName: string
  fileSize: number
  uploadedAt: string
  caption?: string
  takenAt?: string
  width: number
  height: number
}

export interface Headquarters {
  address: string
  ward: string
  district: string
  province: string
  phone: string
  email: string
  workingArea?: number
  floorCount?: number
  isOwned: boolean
  leaseEndDate?: string
  photos: PhotoAttachment[]
  lastUpdatedAt: string
}

export interface ReceptionPoint {
  isAtHeadquarters: boolean
  address?: string
  workingHours: string
  workingDays: string[]
  publicNoticeMethod: string
  photos: PhotoAttachment[]
  lastUpdatedAt: string
}

export interface CameraSystem {
  hasSystem: boolean
  locations: string[]
  canExtractRecording: boolean
  canStoreWithCase: boolean
  photos: PhotoAttachment[]
  technicalNotes?: string
  lastUpdatedAt: string
}

export interface CameraAtAuction extends CameraSystem {
  isSameAsOffice: boolean
}

export interface Website {
  type: 'OWN_DOMAIN' | 'SUB_PORTAL_DOJ'
  url: string
  isReachable?: boolean
  lastChecked?: string
  hasRegularUpdates: boolean
  lastContentUpdateDate?: string
  screenshots: PhotoAttachment[]
  lastUpdatedAt: string
}

export interface OnlineAuctionPlatform {
  qualificationType: 'APPROVED' | 'CONDUCTED_LAST_YEAR' | 'NONE'
  approvalDocumentNumber?: string
  approvalDate?: string
  approvedBy?: string
  approvalDocument?: string
  url?: string
  isOwnPlatform?: boolean
  platformProvider?: string
  lastYearOnlineAuctionCount?: number
  screenshots: PhotoAttachment[]
  lastUpdatedAt: string
}

export interface Archive {
  isAtHeadquarters: boolean
  address?: string
  area?: number
  storageType: 'CABINET' | 'ROOM' | 'WAREHOUSE' | 'DIGITAL' | 'HYBRID'
  securityMeasures: string[]
  photos: PhotoAttachment[]
  lastUpdatedAt: string
}

export interface InfrastructureScoreBreakdown {
  II_1_1: number
  II_1_2: number
  II_2_1: number
  II_2_2: number
  II_3: number
  II_4: number
  II_5: number
}

export interface Infrastructure {
  id: string
  orgId: string
  headquarters: Headquarters
  receptionPoint: ReceptionPoint
  cameraAtOffice: CameraSystem
  cameraAtAuction: CameraAtAuction
  website: Website
  onlineAuctionPlatform: OnlineAuctionPlatform
  archive: Archive
  totalScore: number
  scoreBreakdown: InfrastructureScoreBreakdown
  completionPercentage: number
  sectionsNeedingUpdate: string[]
  createdAt: string
  updatedAt: string
}
