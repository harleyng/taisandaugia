import type { TaxRecord } from '@/types/tax'

const KEY = 'tsd:tax-records'

export function listTaxRecords(): TaxRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TaxRecord[]) : []
  } catch {
    return []
  }
}

function persist(records: TaxRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(records))
}

export function upsertTaxRecord(record: TaxRecord): void {
  const all = listTaxRecords()
  const idx = all.findIndex((r) => r.id === record.id)
  if (idx >= 0) {
    all[idx] = record
  } else {
    all.push(record)
  }
  persist(all)
}

export function softDeleteTaxRecord(id: string): void {
  const all = listTaxRecords()
  const idx = all.findIndex((r) => r.id === id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], isDeleted: true, updatedAt: new Date().toISOString() }
    persist(all)
  }
}
