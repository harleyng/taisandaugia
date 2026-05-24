import { useState, useCallback, useMemo, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type {
  AuctionRecord,
  AuctionRecordWithComputed,
  ImportSession,
} from '@/types/auction-record'
import { computePriceDifference, computeEnrichmentStatus, getAuctionBadgeSource } from '@/types/auction-record'
import {
  deleteAuctionRecord as deleteFromStorage,
  getImportSessions,
  saveImportSession,
  getLastImportSession,
} from '@/lib/auction-history/storage'
import { calcAuctionHistoryScore, getTargetYear } from '@/lib/auction-history/scoring'
import { getCapacityProfile, saveCapacityProfile } from '@/lib/applications/storage'
import type { ValidationResult } from '@/lib/auction-history/import-parser'
import { validateRows, TEMPLATE_MAPPING } from '@/lib/auction-history/import-parser'

export type ImportFlowStep = 'idle' | 'upload' | 'preview' | 'progress' | 'done'
export type DuplicateStrategy = 'SKIP' | 'OVERWRITE' | 'DUPLICATE'

// Keep CrawlState exported for any component that still imports it (compat shim)
export type CrawlState = 'idle' | 'loading' | 'preview' | 'no_data' | 'error' | 'bot_protection'

export interface ImportFlowState {
  step: ImportFlowStep
  file?: File
  headers: string[]
  rawRows: Record<string, unknown>[]
  mapping: ColumnMapping
  validation?: ValidationResult
  duplicateStrategy: DuplicateStrategy
  progress: number
  result?: ImportSession
}

const ENRICHMENT_STORE_KEY = 'tsd:auction-enrichments'

function loadEnrichments(): Record<string, Partial<AuctionRecord>> {
  try {
    return JSON.parse(localStorage.getItem(ENRICHMENT_STORE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveEnrichment(id: string, patch: Partial<AuctionRecord>): void {
  const store = loadEnrichments()
  store[id] = { ...store[id], ...patch }
  localStorage.setItem(ENRICHMENT_STORE_KEY, JSON.stringify(store))
}

// Parse any date string into YYYY-MM-DD. Handles ISO, DD/MM/YYYY, and ISO with time.
function toISODate(raw: unknown): string | undefined {
  if (!raw) return undefined
  const s = String(raw).trim()
  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // Vietnamese DD/MM/YYYY or DD/MM/YYYY HH:MM
  const vn = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/)
  if (vn) return `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}`
  // Fallback: try Date parse
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return undefined
}

// Map a Supabase listing row to an AuctionRecord
function listingToRecord(listing: Record<string, unknown>, enrichments: Record<string, Partial<AuctionRecord>>): AuctionRecord {
  const ca = (listing.custom_attributes ?? {}) as Record<string, unknown>
  const rawDate = ca.auction_time ?? ca.auction_date
  const auctionDate = toISODate(rawDate) ?? toISODate(listing.created_at) ?? new Date().toISOString().slice(0, 10)
  const enrichment = enrichments[listing.id as string] ?? {}
  const hasEnrichment = Object.keys(enrichment).length > 0

  return {
    id: listing.id as string,
    orgId: 'default',
    source: hasEnrichment ? 'CRAWLED_USER_ENRICHED' : 'CRAWLED',
    auctionDate,
    auctionNumber: ca.auction_number as string | undefined,
    assetDescription: (listing.title as string | null) ?? '',
    assetCategory: 'OTHER',
    assetLocation: ca.auction_location as string | undefined,
    legalStatus: (listing.legal_status ?? ca.legal_status) as string | undefined,
    ownerName: (ca.asset_owner_name as string | undefined) ?? '',
    startingPrice: (listing.price as number | null) ?? 0,
    winningPrice: enrichment.winningPrice ?? (ca.winning_price ?? ca.win_price) as number | undefined,
    isSuccessful: enrichment.isSuccessful ?? (listing.status === 'SOLD_RENTED' ? true : undefined),
    failureReason: enrichment.failureReason,
    auctionFormat: enrichment.auctionFormat ?? (ca.auction_format as AuctionRecord['auctionFormat'] | undefined),
    biddingMethod: enrichment.biddingMethod ?? (ca.bidding_method as AuctionRecord['biddingMethod'] | undefined),
    auctioneer: enrichment.auctioneer,
    bidStep: enrichment.bidStep ?? ((ca.bid_step ?? ca.step_price) as number | undefined),
    maxRounds: enrichment.maxRounds ?? (ca.max_rounds as number | undefined),
    actualRounds: enrichment.actualRounds ?? (ca.actual_rounds as number | undefined),
    numberOfParticipants: enrichment.numberOfParticipants ?? (ca.number_of_participants as number | undefined),
    depositPercentage: enrichment.depositPercentage ?? (ca.deposit_percentage as number | undefined),
    contractNumber: enrichment.contractNumber,
    internalNotes: enrichment.internalNotes,
    fieldSources: { auctionDate: 'PUBLIC', assetDescription: 'PUBLIC', ownerName: 'PUBLIC', startingPrice: 'PUBLIC' },
    overrides: [],
    attachedDocuments: [],
    isVerifiedByUser: false,
    isDisputed: false,
    crawledAt: listing.created_at as string,
    crawledFromUrl: (ca.source_urls as string[] | undefined)?.[0],
    importedAt: enrichment.importedAt,
    importBatchId: enrichment.importBatchId,
    createdAt: listing.created_at as string,
    updatedAt: enrichment.updatedAt ?? listing.updated_at as string,
  }
}

function syncCapacityProfile(records: AuctionRecord[]): void {
  const score = calcAuctionHistoryScore(records)
  const existing = getCapacityProfile()
  saveCapacityProfile({
    ...existing,
    scoreIV1to4: score.total,
    auctionsCompleted: records.filter((r) => r.isSuccessful === true).length,
    auctionsMissingPrice: records.filter((r) => r.winningPrice === undefined && r.isSuccessful !== false).length,
  })
}

export function useAuctionHistory() {
  const [isLoading, setIsLoading] = useState(true)
  const [records, setRecords] = useState<AuctionRecord[]>([])
  const [rawListings, setRawListings] = useState<Record<string, Record<string, unknown>>>({})
  const [importSessions] = useState<ImportSession[]>(() => getImportSessions())
  const [lastImport, setLastImport] = useState<ImportSession | undefined>(() => getLastImportSession())
  const [importFlow, setImportFlow] = useState<ImportFlowState>({
    step: 'idle',
    headers: [],
    rawRows: [],
    mapping: {},
    duplicateStrategy: 'SKIP',
    progress: 0,
  })

  // Fetch listings from Supabase via the user's auction_org_id
  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) { setIsLoading(false); return }

        // Get the user's organization via owner_id (same pattern as CompanyTab)
        const { data: orgRows } = await supabase
          .from('organizations')
          .select('license_info')
          .eq('owner_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
        const org = orgRows?.[0] ?? null

        const auctionOrgId = (org?.license_info as Record<string, unknown> | null)?.auction_org_id as string | undefined
        if (!auctionOrgId) { setIsLoading(false); return }

        // 3. Fetch all listings for this auction org
        const { data: listings } = await supabase
          .from('listings')
          .select('id, title, description, price, status, area, legal_status, asset_owner_id, custom_attributes, created_at, updated_at, auction_org_id')
          .eq('auction_org_id', auctionOrgId)
          .in('status', ['ACTIVE', 'SOLD_RENTED', 'INACTIVE'])
          .order('created_at', { ascending: false })

        if (cancelled) return
        const enrichments = loadEnrichments()
        const rawMap: Record<string, Record<string, unknown>> = {}
        const mapped = (listings ?? []).map((l) => {
          rawMap[l.id as string] = l as Record<string, unknown>
          return listingToRecord(l as Record<string, unknown>, enrichments)
        })
        setRawListings(rawMap)
        setRecords(mapped)
        syncCapacityProfile(mapped)
      } catch {
        // silently fail — show empty state
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const enriched = useMemo((): AuctionRecordWithComputed[] => {
    return records.map((r) => ({
      ...r,
      ...computePriceDifference(r),
      enrichmentStatus: computeEnrichmentStatus(r),
      badgeSource: getAuctionBadgeSource(r),
    }))
  }, [records])

  const score = useMemo(() => calcAuctionHistoryScore(records), [records])
  const targetYear = useMemo(() => getTargetYear(), [])

  const updateRecord = useCallback((record: AuctionRecord) => {
    // Persist only enrichment fields in localStorage
    const enrichmentFields: (keyof AuctionRecord)[] = [
      'winningPrice', 'isSuccessful', 'failureReason', 'auctionFormat', 'biddingMethod',
      'bidStep', 'maxRounds', 'actualRounds', 'numberOfParticipants',
      'depositPercentage', 'contractNumber', 'auctioneer', 'internalNotes', 'updatedAt',
    ]
    const patch: Partial<AuctionRecord> = {}
    for (const k of enrichmentFields) {
      if ((record as Record<string, unknown>)[k] !== undefined) {
        ;(patch as Record<string, unknown>)[k] = (record as Record<string, unknown>)[k]
      }
    }
    saveEnrichment(record.id, patch)
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === record.id)
      if (idx < 0) return prev
      const updated = [...prev]
      updated[idx] = record
      syncCapacityProfile(updated)
      return updated
    })
  }, [])

  const removeRecord = useCallback((id: string) => {
    deleteFromStorage(id)
    setRecords((prev) => {
      const updated = prev.filter((r) => r.id !== id)
      syncCapacityProfile(updated)
      return updated
    })
  }, [])

  const openImport = useCallback(() => {
    setImportFlow({ step: 'upload', headers: [], rawRows: [], mapping: {}, duplicateStrategy: 'SKIP', progress: 0 })
  }, [])

  const closeImport = useCallback(() => {
    setImportFlow((prev) => ({ ...prev, step: 'idle' }))
  }, [])

  const handleImportFile = useCallback((file: File, headers: string[], rows: Record<string, unknown>[]) => {
    const existingKeys = records.map((r) => r.auctionDate + (r.ownerName ?? ''))
    const validation = validateRows(rows, TEMPLATE_MAPPING, existingKeys)
    setImportFlow({ step: 'preview', file, headers, rawRows: rows, mapping: TEMPLATE_MAPPING, validation, duplicateStrategy: 'SKIP', progress: 0 })
  }, [records])

  const executeImport = useCallback(
    async (_strategy: DuplicateStrategy) => {
      setImportFlow((prev) => ({ ...prev, step: 'progress', progress: 0 }))

      const { validation, rawRows, file } = importFlow
      if (!validation) return

      const now = new Date().toISOString()
      const updated = [...records]
      let successRows = 0
      let unmatchedRows = 0

      const byDateOwner = new Map(records.map((r, idx) => [r.auctionDate + r.ownerName, idx]))
      const byNumber = new Map(records.flatMap((r, idx) => r.auctionNumber ? [[r.auctionNumber, idx]] : []))

      const allValidRows = [...validation.validRows, ...validation.warningRows.map((w) => w.data)]

      for (let i = 0; i < allValidRows.length; i++) {
        const row = allValidRows[i]
        const matchKey = (row.auctionDate ?? '') + (row.ownerName ?? '')
        const matchIdx = byDateOwner.get(matchKey) ?? (row.auctionNumber ? byNumber.get(row.auctionNumber) : undefined)

        if (matchIdx !== undefined) {
          const target = updated[matchIdx]
          const patch: Partial<AuctionRecord> = {
            ...(row.winningPrice !== undefined && { winningPrice: row.winningPrice }),
            ...(row.isSuccessful !== undefined && { isSuccessful: row.isSuccessful }),
            ...(row.failureReason !== undefined && { failureReason: row.failureReason }),
            ...(row.auctionFormat !== undefined && { auctionFormat: row.auctionFormat }),
            ...(row.bidStep !== undefined && { bidStep: row.bidStep }),
            ...(row.maxRounds !== undefined && { maxRounds: row.maxRounds }),
            ...(row.actualRounds !== undefined && { actualRounds: row.actualRounds }),
            ...(row.numberOfParticipants !== undefined && { numberOfParticipants: row.numberOfParticipants }),
            ...(row.depositPercentage !== undefined && { depositPercentage: row.depositPercentage }),
            ...(row.contractNumber !== undefined && { contractNumber: row.contractNumber }),
            ...(row.internalNotes !== undefined && { internalNotes: row.internalNotes }),
            importedAt: now,
            importBatchId: now,
            updatedAt: now,
          }
          saveEnrichment(target.id, patch)
          updated[matchIdx] = {
            ...target,
            ...patch,
            source: target.source === 'CRAWLED' ? 'CRAWLED_USER_ENRICHED' : target.source,
          }
          successRows++
        } else {
          unmatchedRows++
        }

        setImportFlow((prev) => ({ ...prev, progress: Math.round(((i + 1) / allValidRows.length) * 100) }))
        if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0))
      }

      setRecords(updated)
      syncCapacityProfile(updated)

      const session: ImportSession = {
        id: crypto.randomUUID(),
        fileName: file?.name ?? 'import',
        fileSize: file?.size ?? 0,
        totalRows: rawRows.length,
        successRows,
        errorRows: validation.errorRows.length,
        duplicateRows: unmatchedRows,
        errors: validation.errorRows.map((e) => ({ row: e.row, field: '', message: e.errors.join('; ') })),
        importedAt: now,
        importedBy: 'user',
      }
      saveImportSession(session)
      setLastImport(session)
      setImportFlow((prev) => ({ ...prev, step: 'done', result: session }))
    },
    [importFlow, records],
  )

  return {
    records: enriched,
    rawListings,
    score,
    targetYear,
    isLoading,
    lastImport,
    importSessions,
    importFlow,
    updateRecord,
    removeRecord,
    openImport,
    closeImport,
    handleImportFile,
    executeImport,
    setImportDuplicateStrategy: (s: DuplicateStrategy) =>
      setImportFlow((prev) => ({ ...prev, duplicateStrategy: s })),
  }
}
