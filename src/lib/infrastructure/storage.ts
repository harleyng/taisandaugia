import type { Infrastructure } from '@/types/infrastructure'

const KEY = 'tsd:infrastructure'
const now = () => new Date().toISOString()

export function getInfrastructure(): Infrastructure | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Infrastructure) : null
  } catch {
    return null
  }
}

export function saveInfrastructure(infra: Infrastructure): void {
  localStorage.setItem(KEY, JSON.stringify({ ...infra, updatedAt: now() }))
}

export function createDefaultInfrastructure(): Infrastructure {
  const ts = now()
  const emptyPhotos = () => []

  return {
    id: crypto.randomUUID(),
    orgId: 'default',
    headquarters: {
      address: '',
      ward: '',
      district: '',
      province: '',
      phone: '',
      email: '',
      isOwned: true,
      photos: emptyPhotos(),
      lastUpdatedAt: ts,
    },
    receptionPoint: {
      isAtHeadquarters: true,
      workingHours: '',
      workingDays: ['T2', 'T3', 'T4', 'T5', 'T6'],
      publicNoticeMethod: '',
      photos: emptyPhotos(),
      lastUpdatedAt: ts,
    },
    cameraAtOffice: {
      hasSystem: false,
      locations: [],
      canExtractRecording: false,
      canStoreWithCase: false,
      photos: emptyPhotos(),
      lastUpdatedAt: ts,
    },
    cameraAtAuction: {
      hasSystem: false,
      isSameAsOffice: false,
      locations: [],
      canExtractRecording: false,
      canStoreWithCase: false,
      photos: emptyPhotos(),
      lastUpdatedAt: ts,
    },
    website: {
      type: 'OWN_DOMAIN',
      url: '',
      hasRegularUpdates: false,
      screenshots: emptyPhotos(),
      lastUpdatedAt: ts,
    },
    onlineAuctionPlatform: {
      qualificationType: 'NONE',
      screenshots: emptyPhotos(),
      lastUpdatedAt: ts,
    },
    archive: {
      isAtHeadquarters: true,
      storageType: 'CABINET',
      securityMeasures: [],
      photos: emptyPhotos(),
      lastUpdatedAt: ts,
    },
    totalScore: 0,
    scoreBreakdown: {
      II_1_1: 0,
      II_1_2: 0,
      II_2_1: 0,
      II_2_2: 0,
      II_3: 0,
      II_4: 0,
      II_5: 0,
    },
    completionPercentage: 0,
    sectionsNeedingUpdate: [],
    createdAt: ts,
    updatedAt: ts,
  }
}
