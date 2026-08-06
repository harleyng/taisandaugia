import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import type { Auctioneer, AuctioneerWithComputed, ConflictRecord, CrawlSession } from '@/types/auctioneer'
import {
  computePracticeYears,
  computeDaysUntilExpiry,
  getBadgeSource,
} from '@/types/auctioneer'
import {
  saveCrawlSession,
  getLastSuccessfulCrawl,
  getStoredTaxCode,
  setStoredTaxCode,
} from '@/lib/auctioneers/storage'
import * as repo from '@/lib/auctioneers/supabase-repo'
import { calcAuctioneerScore } from '@/lib/auctioneers/scoring'
import { patchCapacityProfile } from '@/lib/applications/capacity-sync'
import { createFromCrawled, mergeWithExisting } from '@/lib/auctioneers/merge'
import type { CrawledAuctioneer } from '@/lib/auctioneers/merge'
import { usePortalOrg } from '@/hooks/usePortalOrg'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'no_data' | 'bot_protection'

async function syncAuctioneerScore(
  auctioneers: Auctioneer[],
  organizationId: string,
): Promise<void> {
  const detail = calcAuctioneerScore(auctioneers)
  await patchCapacityProfile(
    organizationId,
    { scoreIV6to8: detail.total, auctioneerCount: detail.activeCount },
    'scoreIV6to8',
  )
}

export function useAuctioneers() {
  const { organizationId, auctionOrgId, hasOrg, isLoading: orgLoading } = usePortalOrg()
  const qc = useQueryClient()
  const queryKey = useMemo(() => ['auctioneers', organizationId], [organizationId])

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastCrawl, setLastCrawl] = useState<CrawlSession | undefined>(() => getLastSuccessfulCrawl())
  const [pendingConflicts, setPendingConflicts] = useState<ConflictRecord[]>([])
  const [taxCode, setTaxCodeState] = useState<string>(() => getStoredTaxCode())

  const { data, isLoading: listLoading } = useQuery({
    queryKey,
    enabled: !!organizationId,
    queryFn: () => repo.listByOrg(organizationId!),
  })

  const auctioneers = useMemo(() => data ?? [], [data])
  const ids = useMemo(
    () => ({ organizationId: organizationId!, auctionOrgId }),
    [organizationId, auctionOrgId],
  )

  const enriched = useMemo((): AuctioneerWithComputed[] => {
    const conflictIds = new Set(pendingConflicts.map((c) => c.auctioneerId))
    return auctioneers.map((a) => ({
      ...a,
      yearsOfExperience: computePracticeYears(a),
      daysUntilLicenseExpiry: computeDaysUntilExpiry(a.licenseExpiryDate),
      badgeSource: getBadgeSource(a, conflictIds.has(a.id)),
    }))
  }, [auctioneers, pendingConflicts])

  const score = useMemo(() => calcAuctioneerScore(enriched), [enriched])

  const expiringLicenses = useMemo(
    () => enriched.filter((a) => a.daysUntilLicenseExpiry !== undefined && a.daysUntilLicenseExpiry < 60 && a.isActive),
    [enriched],
  )

  // Điểm Mục IV.6-8 phải bám theo DỮ LIỆU, không theo callback của mutation:
  // sau khi chuyển sang React Query thì mutation kết thúc TRƯỚC lúc query
  // refetch xong, ghi điểm trong callback sẽ luôn tính trên mảng cũ.
  useEffect(() => {
    if (data && organizationId) void syncAuctioneerScore(data, organizationId)
  }, [data, organizationId])

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey })
  }, [qc, queryKey])

  const upsertMutation = useMutation({
    mutationFn: (a: Auctioneer) => repo.upsertOne(a, ids),
    onSuccess: invalidate,
    onError: (err: { code?: string }) => {
      // 23505 = unique_violation trên (organization_id, license_number).
      // Không có onError thì lỗi bị nuốt và người dùng tưởng đã lưu thành công.
      if (err?.code === '23505') {
        toast.error('Số thẻ đấu giá viên này đã tồn tại trong tổ chức.')
      } else {
        toast.error('Lưu đấu giá viên thất bại. Vui lòng thử lại.')
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repo.removeOne(id),
    onSuccess: invalidate,
    onError: () => toast.error('Xoá đấu giá viên thất bại.'),
  })

  const syncFromMst = useCallback(
    async (code: string) => {
      if (!code.trim() || !organizationId) return
      setSyncStatus('syncing')
      try {
        const { data: fnData, error } = await supabase.functions.invoke('crawl-auctioneers', {
          body: { taxCode: code.trim() },
        })
        if (error) throw error

        if (fnData.error === 'bot_protection') { setSyncStatus('bot_protection'); return }
        if (fnData.error === 'no_data' || !fnData.data?.length) { setSyncStatus('no_data'); return }

        const crawled = fnData.data as CrawledAuctioneer[]
        const now = new Date().toISOString()
        const existing = await repo.listByOrg(organizationId)
        const updated = [...existing]
        const newConflicts: ConflictRecord[] = []

        for (const c of crawled) {
          const idx = updated.findIndex((a) => a.licenseNumber === c.licenseNumber)
          if (idx >= 0) {
            const { merged, conflicts: fc } = mergeWithExisting(c, updated[idx], now)
            updated[idx] = { ...merged, updatedAt: now, source: merged.overrides.length > 0 ? 'CRAWLED_USER_ENRICHED' : 'CRAWLED' }
            for (const f of fc) newConflicts.push({ ...f, auctioneerId: updated[idx].id, detectedAt: now })
          } else {
            updated.push(createFromCrawled(c, organizationId, now))
          }
        }

        await repo.upsertMany(updated, ids)
        invalidate()
        if (newConflicts.length) setPendingConflicts((prev) => [...prev, ...newConflicts])

        const session: CrawlSession = {
          id: crypto.randomUUID(),
          orgId: organizationId,
          initiatedBy: 'auto',
          status: 'SUCCESS',
          startedAt: now,
          completedAt: now,
          creditsCost: 0,
          results: {
            totalFound: crawled.length,
            newlyAdded: crawled.filter((c) => !existing.find((e) => e.licenseNumber === c.licenseNumber)).length,
            updated: crawled.filter((c) => !!existing.find((e) => e.licenseNumber === c.licenseNumber)).length,
            conflicts: newConflicts,
          },
        }
        saveCrawlSession(session)
        setLastCrawl(session)
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    },
    [organizationId, ids, invalidate],
  )

  const saveTaxCode = useCallback((code: string) => {
    setStoredTaxCode(code)
    setTaxCodeState(code)
  }, [])

  const addAuctioneer = useCallback((a: Auctioneer) => { upsertMutation.mutate(a) }, [upsertMutation])
  const updateAuctioneer = useCallback((a: Auctioneer) => { upsertMutation.mutate(a) }, [upsertMutation])
  const removeAuctioneer = useCallback((id: string) => { deleteMutation.mutate(id) }, [deleteMutation])

  const resolveConflict = useCallback(
    (auctioneerId: string, field: string, resolution: 'KEEP_CURRENT' | 'USE_NEW', newValue?: string) => {
      if (resolution === 'USE_NEW' && newValue !== undefined) {
        const target = auctioneers.find((a) => a.id === auctioneerId)
        if (target) {
          upsertMutation.mutate({
            ...target,
            [field]: newValue,
            updatedAt: new Date().toISOString(),
          } as Auctioneer)
        }
      }
      setPendingConflicts((prev) => prev.filter((c) => !(c.auctioneerId === auctioneerId && c.field === field)))
    },
    [auctioneers, upsertMutation],
  )

  return {
    auctioneers: enriched,
    score,
    syncStatus,
    lastCrawl,
    pendingConflicts,
    expiringLicenses,
    taxCode,
    saveTaxCode,
    syncFromMst,
    addAuctioneer,
    updateAuctioneer,
    removeAuctioneer,
    resolveConflict,
    // Mới — để trang hiện skeleton / empty state "chưa xác thực tổ chức"
    isLoading: orgLoading || (!!organizationId && listLoading),
    hasOrg,
    organizationId,
    auctionOrgId,
  }
}
