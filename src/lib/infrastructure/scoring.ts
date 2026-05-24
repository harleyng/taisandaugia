import type {
  Infrastructure,
  InfrastructureScoreBreakdown,
  Headquarters,
  ReceptionPoint,
  CameraSystem,
  CameraAtAuction,
  Website,
  OnlineAuctionPlatform,
  Archive,
} from '@/types/infrastructure'

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export function hasValidHeadquarters(hq: Headquarters): boolean {
  return !!(hq.address && hq.phone && hq.email && hq.photos.length >= 1)
}

export function hasValidReceptionPoint(rp: ReceptionPoint): boolean {
  return !!(rp.workingHours && rp.publicNoticeMethod && rp.photos.length >= 1)
}

export function hasValidCameraAtOffice(c: CameraSystem): boolean {
  return c.hasSystem && c.canExtractRecording
}

export function hasValidCameraAtAuction(c: CameraAtAuction): boolean {
  return c.hasSystem && c.canExtractRecording && c.canStoreWithCase
}

export function hasValidWebsite(w: Website): boolean {
  return !!(w.url && w.isReachable !== false && w.hasRegularUpdates && w.screenshots.length >= 1)
}

export function hasValidOnlineAuction(oa: OnlineAuctionPlatform): boolean {
  if (oa.qualificationType === 'APPROVED') {
    return !!(oa.approvalDocumentNumber && oa.approvalDate && oa.approvalDocument)
  }
  if (oa.qualificationType === 'CONDUCTED_LAST_YEAR') {
    return (oa.lastYearOnlineAuctionCount ?? 0) >= 1
  }
  return false
}

export function hasValidArchive(a: Archive): boolean {
  return a.photos.length >= 1 && a.securityMeasures.length >= 1
}

export function calcMucII(infra: Infrastructure): InfrastructureScoreBreakdown {
  return {
    II_1_1: hasValidHeadquarters(infra.headquarters) ? 1.5 : 0,
    II_1_2: hasValidReceptionPoint(infra.receptionPoint) ? 1.5 : 0,
    II_2_1: hasValidCameraAtOffice(infra.cameraAtOffice) ? 2 : 0,
    II_2_2: hasValidCameraAtAuction(infra.cameraAtAuction) ? 2 : 0,
    II_3: hasValidWebsite(infra.website) ? 4 : 0,
    II_4: hasValidOnlineAuction(infra.onlineAuctionPlatform) ? 4 : 0,
    II_5: hasValidArchive(infra.archive) ? 4 : 0,
  }
}

export function totalFromBreakdown(b: InfrastructureScoreBreakdown): number {
  return b.II_1_1 + b.II_1_2 + b.II_2_1 + b.II_2_2 + b.II_3 + b.II_4 + b.II_5
}

export function getSectionsNeedingUpdate(infra: Infrastructure): string[] {
  const now = Date.now()
  const stale = (ts: string) => now - new Date(ts).getTime() > NINETY_DAYS_MS

  const sections: string[] = []
  if (stale(infra.headquarters.lastUpdatedAt)) sections.push('headquarters')
  if (stale(infra.receptionPoint.lastUpdatedAt)) sections.push('receptionPoint')
  if (stale(infra.cameraAtOffice.lastUpdatedAt)) sections.push('cameraAtOffice')
  if (stale(infra.cameraAtAuction.lastUpdatedAt)) sections.push('cameraAtAuction')
  if (stale(infra.website.lastUpdatedAt)) sections.push('website')
  if (stale(infra.onlineAuctionPlatform.lastUpdatedAt)) sections.push('onlineAuctionPlatform')
  if (stale(infra.archive.lastUpdatedAt)) sections.push('archive')
  return sections
}
