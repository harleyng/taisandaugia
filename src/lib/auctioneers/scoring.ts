import type { Auctioneer } from '@/types/auctioneer'
import { computePracticeYears } from '@/types/auctioneer'

export interface AuctioneerScoreDetail {
  scoreIV6: number  // /4 — số lượng ĐGV
  scoreIV7: number  // /4 — KN Giám đốc
  scoreIV8: number  // /5 — KN ĐGV hành nghề ≥5 năm
  total: number     // /13
  activeCount: number
  directorYears: number | null
  peopleWithFiveYears: number
}

export function calcAuctioneerScore(auctioneers: Auctioneer[]): AuctioneerScoreDetail {
  const active = auctioneers.filter((a) => a.isActive)
  const activeCount = active.length

  // IV.6: Số lượng ĐGV — chỉ chọn 1 tiêu chí
  // 6.1: 01 ĐGV → 2đ | 6.2: 02–04 → 3đ | 6.3: ≥05 → 4đ
  let scoreIV6 = 0
  if (activeCount >= 5) scoreIV6 = 4
  else if (activeCount >= 2) scoreIV6 = 3
  else if (activeCount === 1) scoreIV6 = 2

  // IV.7: KN Giám đốc (tính từ ngày cấp thẻ ĐGV)
  // 7.1: <5 năm → 2đ | 7.2: 5–9 năm → 3đ | 7.3: ≥10 năm → 4đ
  const director = active.find((a) => a.position === 'DIRECTOR')
  const directorYears = director ? computePracticeYears(director) : null
  let scoreIV7 = 0
  if (directorYears !== null) {
    if (directorYears >= 10) scoreIV7 = 4
    else if (directorYears >= 5) scoreIV7 = 3
    else scoreIV7 = 2
  }

  // IV.8: KN ĐGV hành nghề ≥5 năm
  // 8.1: không có ai ≥5y (nhưng có ĐGV) → 3đ | 8.2: 01–03 → 4đ | 8.3: ≥04 → 5đ
  const peopleWithFiveYears = active.filter(
    (a) => computePracticeYears(a) >= 5,
  ).length
  let scoreIV8 = 0
  if (activeCount > 0) {
    if (peopleWithFiveYears >= 4) scoreIV8 = 5
    else if (peopleWithFiveYears >= 1) scoreIV8 = 4
    else scoreIV8 = 3
  }

  return {
    scoreIV6,
    scoreIV7,
    scoreIV8,
    total: scoreIV6 + scoreIV7 + scoreIV8,
    activeCount,
    directorYears,
    peopleWithFiveYears,
  }
}
