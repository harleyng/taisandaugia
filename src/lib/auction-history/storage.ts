import type { AuctionCrawlSession, ImportSession } from '@/types/auction-record'

const CRAWL_SESSIONS_KEY = 'tsd:auction-crawl-sessions'
const IMPORT_SESSIONS_KEY = 'tsd:auction-import-sessions'

// Bản ghi đấu giá nay ở Supabase (org_auction_records — xem supabase-repo.ts).
// Bốn hàm listAuctionRecords/saveAuctionRecords/upsertAuctionRecord/
// deleteAuctionRecord đã gỡ: chúng đọc/ghi key 'tsd:auction-records' mà KHÔNG
// nơi nào ghi vào, nên mọi consumer đều âm thầm nhận mảng rỗng.
// Phần còn lại của file chỉ giữ phiên crawl/import — thuần nhật ký cục bộ.

export function getCrawlSessions(): AuctionCrawlSession[] {
  try {
    const raw = localStorage.getItem(CRAWL_SESSIONS_KEY)
    return raw ? (JSON.parse(raw) as AuctionCrawlSession[]) : []
  } catch {
    return []
  }
}

export function saveCrawlSession(session: AuctionCrawlSession): void {
  const all = getCrawlSessions()
  const idx = all.findIndex((s) => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.push(session)
  localStorage.setItem(CRAWL_SESSIONS_KEY, JSON.stringify(all))
}

export function getLastSuccessfulCrawl(): AuctionCrawlSession | undefined {
  return getCrawlSessions()
    .filter((s) => s.status === 'SUCCESS')
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0]
}

export function getImportSessions(): ImportSession[] {
  try {
    const raw = localStorage.getItem(IMPORT_SESSIONS_KEY)
    return raw ? (JSON.parse(raw) as ImportSession[]) : []
  } catch {
    return []
  }
}

export function saveImportSession(session: ImportSession): void {
  const all = getImportSessions()
  const idx = all.findIndex((s) => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.push(session)
  localStorage.setItem(IMPORT_SESSIONS_KEY, JSON.stringify(all))
}

export function getLastImportSession(): ImportSession | undefined {
  return getImportSessions().sort(
    (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime(),
  )[0]
}
