import { Application } from '@/types/application'
import { CapacityProfile } from '@/types/capacity-profile'
import { listTaxRecords } from '@/lib/tax/storage'
import { getTargetYear, calcMucIV9 } from '@/lib/tax/scoring'

const KEYS = {
  list: 'tsd:applications',
  item: (id: string) => `tsd:application:${id}`,
  capacity: 'tsd:capacity:profile',
}

export type ApplicationListItem = Pick<Application, 'id' | 'status' | 'createdAt' | 'updatedAt'> & {
  title: string       // derived: ownerName + assetDescription
  ownerName: string   // announcement.ownerName
  deadline: string    // announcement.deadline (ISO date)
  totalScore: number  // /100
}

export function listApplications(): ApplicationListItem[] {
  try {
    const raw = localStorage.getItem(KEYS.list)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getApplication(id: string): Application | null {
  try {
    const raw = localStorage.getItem(KEYS.item(id))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveApplication(app: Application): void {
  const updated = { ...app, updatedAt: new Date().toISOString() }

  // Save full payload
  localStorage.setItem(KEYS.item(app.id), JSON.stringify(updated))

  // Update list index
  const list = listApplications()

  const CATEGORY_ABBR: Partial<Record<string, string>> = {
    LAND_USE_RIGHT: 'QSDĐ',
    ADMIN_VIOLATION: 'Tang vật',
    ENFORCEMENT: 'THA',
    MACHINERY: 'Máy móc',
    VEHICLE: 'Phương tiện',
  }
  const assetShortName =
    app.announcement.assetCategory && app.announcement.province
      ? `${CATEGORY_ABBR[app.announcement.assetCategory] ?? 'Tài sản'} ${app.announcement.province}`
      : app.announcement.assetDescription
  const title = app.name?.trim() || assetShortName || 'Hồ sơ chưa đặt tên'

  const idx = list.findIndex((a) => a.id === app.id)
  const item: ApplicationListItem = {
    id: app.id,
    status: app.status,
    createdAt: app.createdAt,
    updatedAt: updated.updatedAt,
    title,
    ownerName: app.announcement.ownerName ?? '',
    deadline: app.announcement.deadline ?? '',
    totalScore: app.totalScore ?? 0,
  }

  if (idx >= 0) {
    list[idx] = item
  } else {
    list.unshift(item)
  }
  localStorage.setItem(KEYS.list, JSON.stringify(list))
}

export function deleteApplication(id: string): void {
  localStorage.removeItem(KEYS.item(id))
  const list = listApplications().filter((a) => a.id !== id)
  localStorage.setItem(KEYS.list, JSON.stringify(list))
}

export function getCapacityProfile(): CapacityProfile {
  let base: CapacityProfile = MOCK_CAPACITY_PROFILE

  try {
    const raw = localStorage.getItem(KEYS.capacity)
    if (raw) base = JSON.parse(raw)
  } catch {
    // fall through to mock
  }

  // Derive IV.1-4 fields from live auction record storage if available
  try {
    const auctionRaw = localStorage.getItem('tsd:auction-records')
    if (auctionRaw) {
      const records = JSON.parse(auctionRaw) as Array<{
        isSuccessful?: boolean
        winningPrice?: number
      }>
      const auctionsCompleted = records.filter((r) => r.isSuccessful === true).length
      const auctionsMissingPrice = records.filter(
        (r) => r.winningPrice === undefined && r.isSuccessful !== false
      ).length
      base = { ...base, auctionsCompleted, auctionsMissingPrice }
    }
  } catch {
    // fall through
  }

  // Derive IV.9 score from live tax records
  try {
    const taxRecords = listTaxRecords().filter((r) => !r.isDeleted)
    const scoreIV9 = calcMucIV9(taxRecords)
    const targetYear = getTargetYear()
    const targetRecord = taxRecords.find((r) => r.year === targetYear)
    const taxPaidPreviousYear = targetRecord ? targetRecord.amount / 1_000_000 : base.taxPaidPreviousYear
    const totalWithoutIV9 = base.totalCapacityScore - base.scoreIV9
    base = {
      ...base,
      scoreIV9,
      taxPaidPreviousYear,
      totalCapacityScore: totalWithoutIV9 + scoreIV9,
    }
  } catch {
    // fall through
  }

  return base
}

export function saveCapacityProfile(profile: CapacityProfile): void {
  localStorage.setItem(KEYS.capacity, JSON.stringify(profile))
}

const MOCK_CAPACITY_PROFILE: CapacityProfile = {
  companyName: 'Công ty TNHH Đấu giá Hà Nội',
  onMinistryList: true,
  scoreII: 14,
  scoreIV1to4: 18,
  auctionsCompleted: 47,
  auctionsMissingPrice: 3,
  scoreIV5: 5,
  yearsActive: 12,
  scoreIV6to8: 7,
  auctioneerCount: 4,
  scoreIV9: 3,
  taxPaidPreviousYear: 850,
  totalCapacityScore: 49,
  warnings: ['3 cuộc đấu giá thiếu giá trúng — cần bổ sung kết quả'],
}
