import type { Auctioneer, CrawlSession } from '@/types/auctioneer'

const AUCTIONEERS_KEY = 'tsd:auctioneers'
const CRAWL_SESSIONS_KEY = 'tsd:crawl-sessions'
const TAX_CODE_KEY = 'tsd:org-tax-code'

export function listAuctioneers(): Auctioneer[] {
  try {
    const raw = localStorage.getItem(AUCTIONEERS_KEY)
    return raw ? (JSON.parse(raw) as Auctioneer[]) : []
  } catch {
    return []
  }
}

export function saveAuctioneers(auctioneers: Auctioneer[]): void {
  localStorage.setItem(AUCTIONEERS_KEY, JSON.stringify(auctioneers))
}

export function upsertAuctioneer(auctioneer: Auctioneer): void {
  const all = listAuctioneers()
  const idx = all.findIndex((a) => a.id === auctioneer.id)
  if (idx >= 0) all[idx] = auctioneer
  else all.push(auctioneer)
  saveAuctioneers(all)
}

export function deleteAuctioneer(id: string): void {
  saveAuctioneers(listAuctioneers().filter((a) => a.id !== id))
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
