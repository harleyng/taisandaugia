import type { AuctionRecord, AuctionCrawlSession, ImportSession } from '@/types/auction-record'

const RECORDS_KEY = 'tsd:auction-records'
const CRAWL_SESSIONS_KEY = 'tsd:auction-crawl-sessions'
const IMPORT_SESSIONS_KEY = 'tsd:auction-import-sessions'

export function listAuctionRecords(): AuctionRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    return raw ? (JSON.parse(raw) as AuctionRecord[]) : []
  } catch {
    return []
  }
}

export function saveAuctionRecords(records: AuctionRecord[]): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
}

export function upsertAuctionRecord(record: AuctionRecord): void {
  const all = listAuctionRecords()
  const idx = all.findIndex((r) => r.id === record.id)
  if (idx >= 0) all[idx] = record
  else all.push(record)
  saveAuctionRecords(all)
}

export function deleteAuctionRecord(id: string): void {
  saveAuctionRecords(listAuctionRecords().filter((r) => r.id !== id))
}

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
