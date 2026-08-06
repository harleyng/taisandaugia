import { useState, useCallback, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import type {
  AuctionRecord,
  AuctionRecordWithComputed,
  ImportSession,
  AssetResult,
} from '@/types/auction-record'
import { computePriceDifference, computeEnrichmentStatus, getAuctionBadgeSource } from '@/types/auction-record'
import {
  getImportSessions,
  saveImportSession,
  getLastImportSession,
} from '@/lib/auction-history/storage'
import type { ColumnMapping } from '@/lib/auction-history/import-parser'
import * as repo from '@/lib/auction-history/supabase-repo'
import { useAuctioneers } from '@/hooks/useAuctioneers'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { calcAuctionHistoryScore, getTargetYear } from '@/lib/auction-history/scoring'
import { patchCapacityProfile } from '@/lib/applications/capacity-sync'
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

// Parse any date string into YYYY-MM-DD. Handles ISO, DD/MM/YYYY, and ISO with time.
function toISODate(raw: unknown): string | undefined {
  if (!raw) return undefined
  const s = String(raw).trim()
  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // Vietnamese DD/MM/YYYY or DD/MM/YYYY HH:MM
  const vn = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (vn) return `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}`
  // Fallback: try Date parse
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return undefined
}

// Map a Supabase listing row to an AuctionRecord

async function syncCapacityProfile(
  records: AuctionRecord[],
  organizationId: string,
): Promise<void> {
  const score = calcAuctionHistoryScore(records)
  await patchCapacityProfile(
    organizationId,
    {
      scoreIV1to4: score.total,
      auctionsCompleted: records.filter((r) => r.isSuccessful === true).length,
      auctionsMissingPrice: records.filter(
        (r) => r.winningPrice === undefined && r.isSuccessful !== false,
      ).length,
    },
    'scoreIV1to4',
  )
}

export function useAuctionHistory() {
  const { organizationId, auctionOrgId } = usePortalOrg()
  const { auctioneers } = useAuctioneers()

  // Người điều hành lưu bằng FK; UI vẫn thao tác theo tên như trước.
  const auctioneerNameById = useMemo(
    () => new Map(auctioneers.map((a) => [a.id, a.fullName])),
    [auctioneers],
  )
  const writeCtx = useMemo(
    () => ({
      organizationId: organizationId!,
      auctionOrgId,
      auctioneerIdByName: new Map(auctioneers.map((a) => [a.fullName.trim(), a.id])),
    }),
    [organizationId, auctionOrgId, auctioneers],
  )
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
        if (!organizationId) { setRecords([]); setRawListings({}); setIsLoading(false); return }

        const rows = await repo.listByOrg(organizationId)
        if (cancelled) return

        const mapped = rows.map((r) =>
          repo.rowToRecord(r, r.auctioneer_id ? auctioneerNameById.get(r.auctioneer_id) : undefined),
        )
        setRecords(mapped)
        void syncCapacityProfile(mapped, organizationId!)

        // custom_attributes chỉ có với bản ghi sinh từ tin rao; việc cũ thì không.
        setRawListings(await repo.fetchLinkedListings(rows))
      } catch {
        // silently fail — show empty state
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [organizationId, auctioneerNameById])

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
    if (!organizationId) return
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === record.id)
      const updated = idx < 0 ? [...prev, record] : prev.map((r, i) => (i === idx ? record : r))
      void syncCapacityProfile(updated, organizationId!)
      return updated
    })
    // Ghi nền: UI đã cập nhật lạc quan, lỗi mạng thì báo và nạp lại.
    void repo.upsertRecord(record, writeCtx).catch(() => {
      toast.error('Lưu cuộc đấu giá thất bại. Tải lại trang để xem dữ liệu mới nhất.')
    })
  }, [organizationId, writeCtx])

  const removeRecord = useCallback((id: string) => {
    setRecords((prev) => {
      const updated = prev.filter((r) => r.id !== id)
      void syncCapacityProfile(updated, organizationId!)
      return updated
    })
    void repo.deleteRecord(id).catch(() => toast.error('Xoá cuộc đấu giá thất bại.'))
  }, [organizationId])

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
          let patch: Partial<AuctionRecord>

          if (row.assetIndex !== undefined && row.assetIndex >= 1) {
            // Per-asset row: update assetResults[assetIndex-1] and recompute aggregates
            const idx = row.assetIndex - 1
            const existing: AssetResult[] = target.assetResults ? [...target.assetResults] : []
            while (existing.length <= idx) existing.push({})
            existing[idx] = {
              ...existing[idx],
              ...(row.winningPrice !== undefined && { winning_price: row.winningPrice }),
              ...(row.isSuccessful !== undefined && { isSuccessful: row.isSuccessful }),
              ...(row.failureReason !== undefined && { failureReason: row.failureReason }),
            }
            const successfulWithPrice = existing.filter(
              (r) => r.winning_price !== undefined && r.isSuccessful !== false,
            )
            patch = {
              assetResults: existing,
              winningPrice: successfulWithPrice.length > 0
                ? successfulWithPrice.reduce((s, r) => s + (r.winning_price ?? 0), 0)
                : undefined,
              isSuccessful: existing.some((r) => r.isSuccessful === true) ? true : undefined,
              importedAt: now,
              importBatchId: now,
              updatedAt: now,
            }
          } else {
            // Session-level row: existing behavior
            patch = {
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
          }
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
      void syncCapacityProfile(updated, organizationId!)
      // Ghi cả lô lên Supabase; trước đây chỉ nằm ở localStorage máy đang dùng.
      try {
        await repo.upsertMany(updated, writeCtx)
      } catch {
        toast.error('Nhập dữ liệu lên hệ thống thất bại. Vui lòng thử lại.')
      }

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
    [importFlow, organizationId, records, writeCtx],
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
