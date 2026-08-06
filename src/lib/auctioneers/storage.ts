import type { Auctioneer, CrawlSession } from '@/types/auctioneer'

const AUCTIONEERS_KEY = 'tsd:auctioneers'
const CRAWL_SESSIONS_KEY = 'tsd:crawl-sessions'
const TAX_CODE_KEY = 'tsd:org-tax-code'

const MIGRATED_KEY = 'tsd:auctioneers-migrated'

/**
 * CHỈ CÒN DÙNG CHO VIỆC NHẬP DỮ LIỆU CŨ.
 *
 * Nguồn sự thật của đấu giá viên nay là bảng Supabase org_auctioneers (xem
 * src/lib/auctioneers/supabase-repo.ts). Các hàm ghi localStorage đã bị gỡ bỏ
 * có chủ đích để không nơi nào vô tình ghi ngược lại. Key `tsd:auctioneers`
 * được GIỮ NGUYÊN, không xoá sau khi nhập — nhập lỗi thì còn khôi phục được.
 */
export function listAuctioneers(): Auctioneer[] {
  try {
    const raw = localStorage.getItem(AUCTIONEERS_KEY)
    return raw ? (JSON.parse(raw) as Auctioneer[]) : []
  } catch {
    return []
  }
}

export function isLegacyImported(): boolean {
  return localStorage.getItem(MIGRATED_KEY) === '1'
}

export function markLegacyImported(): void {
  localStorage.setItem(MIGRATED_KEY, '1')
}

export function getCrawlSessions(): CrawlSession[] {
  try {
    const raw = localStorage.getItem(CRAWL_SESSIONS_KEY)
    return raw ? (JSON.parse(raw) as CrawlSession[]) : []
  } catch {
    return []
  }
}

export function saveCrawlSession(session: CrawlSession): void {
  const all = getCrawlSessions()
  const idx = all.findIndex((s) => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.push(session)
  localStorage.setItem(CRAWL_SESSIONS_KEY, JSON.stringify(all))
}

export function getLastSuccessfulCrawl(): CrawlSession | undefined {
  return getCrawlSessions()
    .filter((s) => s.status === 'SUCCESS')
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0]
}

export function getStoredTaxCode(): string {
  return localStorage.getItem(TAX_CODE_KEY) ?? ''
}

export function setStoredTaxCode(taxCode: string): void {
  localStorage.setItem(TAX_CODE_KEY, taxCode)
}
