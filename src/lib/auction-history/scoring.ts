import type { AuctionRecord, AuctionHistoryScore } from '@/types/auction-record'

export function getTargetYear(): number {
  const now = new Date()
  return now.getMonth() < 2 ? now.getFullYear() - 2 : now.getFullYear() - 1
}

function recordYear(r: AuctionRecord): number {
  return new Date(r.auctionDate).getFullYear()
}

export function calcMucIV1(records: AuctionRecord[], year: number): number {
  const count = records.filter((r) => recordYear(r) === year).length
  if (count >= 70) return 5
  if (count >= 40) return 4
  if (count >= 20) return 3
  if (count >= 1) return 2
  return 1
}

export function calcMucIV2(records: AuctionRecord[], year: number): number {
  const count = records.filter((r) => recordYear(r) === year && r.isSuccessful === true).length
  if (count >= 50) return 5
  if (count >= 30) return 4
  if (count >= 10) return 3
  if (count >= 1) return 2
  return 1
}

export function calcMucIV3(records: AuctionRecord[], year: number): number {
  const count = records.filter(
    (r) =>
      recordYear(r) === year &&
      r.isSuccessful === true &&
      r.winningPrice !== undefined &&
      r.winningPrice > r.startingPrice,
  ).length
  if (count >= 50) return 5
  if (count >= 30) return 4
  if (count >= 10) return 3
  if (count >= 1) return 2
  return 1
}

export function calcMucIV4(records: AuctionRecord[], year: number): number {
  const count = records.filter((r) => {
    if (recordYear(r) !== year || r.isSuccessful !== true || r.winningPrice === undefined) return false
    const pct = r.startingPrice > 0 ? ((r.winningPrice - r.startingPrice) / r.startingPrice) * 100 : 0
    return pct >= 10
  }).length
  if (count >= 20) return 6
  if (count >= 10) return 4
  if (count >= 1) return 2
  return 0
}

export function calcAuctionHistoryScore(records: AuctionRecord[]): AuctionHistoryScore {
  const year = getTargetYear()
  const iv1Count = records.filter((r) => recordYear(r) === year).length
  const iv2Count = records.filter((r) => recordYear(r) === year && r.isSuccessful === true).length
  const iv3Count = records.filter(
    (r) => recordYear(r) === year && r.isSuccessful === true && r.winningPrice !== undefined && r.winningPrice > r.startingPrice,
  ).length
  const iv4Count = records.filter((r) => {
    if (recordYear(r) !== year || r.isSuccessful !== true || r.winningPrice === undefined) return false
    const pct = r.startingPrice > 0 ? ((r.winningPrice - r.startingPrice) / r.startingPrice) * 100 : 0
    return pct >= 10
  }).length

  const s1 = calcMucIV1(records, year)
  const s2 = calcMucIV2(records, year)
  const s3 = calcMucIV3(records, year)
  const s4 = calcMucIV4(records, year)

  return {
    year,
    iv1: { count: iv1Count, score: s1, max: 5 },
    iv2: { count: iv2Count, score: s2, max: 5 },
    iv3: { count: iv3Count, score: s3, max: 5 },
    iv4: { count: iv4Count, score: s4, max: 6 },
    total: s1 + s2 + s3 + s4,
    maxTotal: 21,
  }
}
