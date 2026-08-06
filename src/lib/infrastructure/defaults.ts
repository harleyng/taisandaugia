// Bản khởi tạo rỗng của Cơ sở vật chất.
//
// Tách khỏi storage.ts (localStorage, đã xoá): đây là hàm THUẦN, không đụng tới
// nơi lưu trữ, nên vẫn cần sau khi module chuyển sang Supabase.

import type { Infrastructure, PhotoAttachment } from '@/types/infrastructure'

const now = () => new Date().toISOString()

export function createDefaultInfrastructure(orgId = ''): Infrastructure {
  const ts = now()
  const emptyPhotos = (): PhotoAttachment[] => []

  return {
    id: crypto.randomUUID(),
    // Trước đây hardcode 'default' cho MỌI tổ chức — nguồn gốc việc dữ liệu
    // cơ sở vật chất không hề được phân tách theo tổ chức.
    orgId,
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
