import type { Infrastructure, InfrastructureScoreBreakdown } from '@/types/infrastructure'
import {
  hasValidHeadquarters,
  hasValidReceptionPoint,
  hasValidCameraAtOffice,
  hasValidCameraAtAuction,
  hasValidWebsite,
  hasValidOnlineAuction,
  hasValidArchive,
} from './scoring'

export interface Suggestion {
  sectionId: string
  title: string
  description: string
  pointsGain: number
  effort: 'LOW' | 'MEDIUM' | 'HIGH'
}

const EFFORT_WEIGHT = { LOW: 1, MEDIUM: 2, HIGH: 3 } as const

export function generateSuggestions(
  infra: Infrastructure,
  breakdown: InfrastructureScoreBreakdown,
): Suggestion[] {
  const suggestions: Suggestion[] = []

  if (!hasValidHeadquarters(infra.headquarters)) {
    const missing = []
    if (!infra.headquarters.address) missing.push('địa chỉ')
    if (!infra.headquarters.phone) missing.push('số điện thoại')
    if (!infra.headquarters.email) missing.push('email')
    if (infra.headquarters.photos.length === 0) missing.push('ảnh trụ sở')
    suggestions.push({
      sectionId: 'headquarters',
      title: 'Hoàn thiện thông tin trụ sở',
      description: `Còn thiếu: ${missing.join(', ')}`,
      pointsGain: 1.5 - breakdown.II_1_1,
      effort: 'LOW',
    })
  }

  if (!hasValidReceptionPoint(infra.receptionPoint)) {
    const missing = []
    if (!infra.receptionPoint.workingHours) missing.push('giờ làm việc')
    if (!infra.receptionPoint.publicNoticeMethod) missing.push('phương thức thông báo')
    if (infra.receptionPoint.photos.length === 0) missing.push('ảnh khu vực tiếp nhận')
    suggestions.push({
      sectionId: 'receptionPoint',
      title: 'Bổ sung địa điểm tiếp nhận hồ sơ',
      description: `Còn thiếu: ${missing.join(', ')}`,
      pointsGain: 1.5 - breakdown.II_1_2,
      effort: 'LOW',
    })
  }

  if (!hasValidCameraAtOffice(infra.cameraAtOffice)) {
    suggestions.push({
      sectionId: 'camera',
      title: 'Thiết lập camera giám sát tại trụ sở',
      description: 'Cần có hệ thống camera và khả năng trích xuất ghi hình',
      pointsGain: 2 - breakdown.II_2_1,
      effort: 'MEDIUM',
    })
  }

  if (!hasValidCameraAtAuction(infra.cameraAtAuction)) {
    suggestions.push({
      sectionId: 'camera',
      title: 'Thiết lập camera tại nơi tổ chức phiên đấu giá',
      description: 'Cần có hệ thống camera, trích xuất được và lưu theo hồ sơ',
      pointsGain: 2 - breakdown.II_2_2,
      effort: 'MEDIUM',
    })
  }

  if (!hasValidWebsite(infra.website)) {
    const missing = []
    if (!infra.website.url) missing.push('URL website')
    if (!infra.website.hasRegularUpdates) missing.push('xác nhận cập nhật thường xuyên')
    if (infra.website.screenshots.length === 0) missing.push('ảnh chụp màn hình')
    suggestions.push({
      sectionId: 'website',
      title: 'Cập nhật trang thông tin điện tử',
      description: `Còn thiếu: ${missing.join(', ')}`,
      pointsGain: 4 - breakdown.II_3,
      effort: 'LOW',
    })
  }

  if (!hasValidOnlineAuction(infra.onlineAuctionPlatform)) {
    suggestions.push({
      sectionId: 'onlineAuction',
      title: 'Khai báo trang đấu giá trực tuyến',
      description:
        infra.onlineAuctionPlatform.qualificationType === 'NONE'
          ? 'Chọn phương án: có quyết định phê duyệt hoặc đã thực hiện cuộc ĐG trực tuyến năm trước'
          : 'Bổ sung đầy đủ thông tin phê duyệt hoặc lịch sử cuộc đấu giá',
      pointsGain: 4 - breakdown.II_4,
      effort: 'HIGH',
    })
  }

  if (!hasValidArchive(infra.archive)) {
    const missing = []
    if (infra.archive.photos.length === 0) missing.push('ảnh kho lưu trữ')
    if (infra.archive.securityMeasures.length === 0) missing.push('biện pháp an toàn')
    suggestions.push({
      sectionId: 'archive',
      title: 'Bổ sung thông tin nơi lưu trữ hồ sơ',
      description: `Còn thiếu: ${missing.join(', ')}`,
      pointsGain: 4 - breakdown.II_5,
      effort: 'LOW',
    })
  }

  return suggestions
    .filter((s) => s.pointsGain > 0)
    .sort(
      (a, b) =>
        b.pointsGain / EFFORT_WEIGHT[b.effort] - a.pointsGain / EFFORT_WEIGHT[a.effort],
    )
}
