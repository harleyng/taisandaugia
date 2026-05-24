import { useState, useCallback, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Auctioneer, AuctioneerWithComputed, ConflictRecord, CrawlSession } from '@/types/auctioneer'
import {
  computeYearsOfExperience,
  computeDaysUntilExpiry,
  getBadgeSource,
} from '@/types/auctioneer'
import {
  listAuctioneers,
  saveAuctioneers,
  upsertAuctioneer,
  deleteAuctioneer as deleteFromStorage,
  saveCrawlSession,
  getLastSuccessfulCrawl,
  getStoredTaxCode,
  setStoredTaxCode,
} from '@/lib/auctioneers/storage'
import { calcAuctioneerScore } from '@/lib/auctioneers/scoring'
import { getCapacityProfile, saveCapacityProfile } from '@/lib/applications/storage'
import { createFromCrawled, mergeWithExisting } from '@/lib/auctioneers/merge'
import type { CrawledAuctioneer } from '@/lib/auctioneers/merge'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'no_data' | 'bot_protection'

function syncAuctioneerScore(auctioneers: Auctioneer[]): void {
  const detail = calcAuctioneerScore(auctioneers)
  const profile = getCapacityProfile()
  saveCapacityProfile({
    ...profile,
    scoreIV6to8: detail.total,
    auctioneerCount: detail.activeCount,
    totalCapacityScore: profile.totalCapacityScore - profile.scoreIV6to8 + detail.total,
  })
}

export function useAuctioneers() {
  const [auctioneers, setAuctioneers] = useState<Auctioneer[]>(() => listAuctioneers())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastCrawl, setLastCrawl] = useState<CrawlSession | undefined>(() => getLastSuccessfulCrawl())
  const [pendingConflicts, setPendingConflicts] = useState<ConflictRecord[]>([])
  const [taxCode, setTaxCodeState] = useState<string>(() => getStoredTaxCode())

  const enriched = useMemo((): AuctioneerWithComputed[] => {
    const conflictIds = new Set(pendingConflicts.map((c) => c.auctioneerId))
    return auctioneers.map((a) => ({
      ...a,
      yearsOfExperience: computeYearsOfExperience(a.licenseIssuedDate),
      daysUntilLicenseExpiry: computeDaysUntilExpiry(a.licenseExpiryDate),
      badgeSource: getBadgeSource(a, conflictIds.has(a.id)),
    }))
  }, [auctioneers, pendingConflicts])

  const score = useMemo(() => calcAuctioneerScore(enriched), [enriched])

  const expiringLicenses = useMemo(
    () => enriched.filter((a) => a.daysUntilLicenseExpiry !== undefined && a.daysUntilLicenseExpiry < 60 && a.isActive),
    [enriched],
  )

  const syncFromMst = useCallback(async (code: string) => {
    if (!code.trim()) return
    setSyncStatus('syncing')
    try {
      const { data, error } = await supabase.functions.invoke('crawl-auctioneers', {
        body: { taxCode: code.trim() },
      })
      if (error) throw error

      if (data.error === 'bot_protection') { setSyncStatus('bot_protection'); return }
      if (data.error === 'no_data' || !data.data?.length) { setSyncStatus('no_data'); return }

      const crawled = data.data as CrawledAuctioneer[]
      const now = new Date().toISOString()
      const existing = listAuctioneers()
      const updated = [...existing]
      const newConflicts: ConflictRecord[] = []

      for (const c of crawled) {
        const idx = updated.findIndex((a) => a.licenseNumber === c.licenseNumber)
        if (idx >= 0) {
          const { merged, conflicts: fc } = mergeWithExisting(c, updated[idx], now)
          updated[idx] = { ...merged, updatedAt: now, source: merged.overrides.length > 0 ? 'CRAWLED_USER_ENRICHED' : 'CRAWLED' }
          for (const f of fc) newConflicts.push({ ...f, auctioneerId: updated[idx].id, detectedAt: now })
        } else {
          updated.push(createFromCrawled(c, 'default', now))
        }
      }

      saveAuctioneers(updated)
      setAuctioneers(updated)
      if (newConflicts.length) setPendingConflicts((prev) => [...prev, ...newConflicts])

      const session: CrawlSession = {
        id: crypto.randomUUID(),
        orgId: 'default',
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
  }, [])

  const saveTaxCode = useCallback((code: string) => {
    setStoredTaxCode(code)
    setTaxCodeState(code)
  }, [])

  const addAuctioneer = useCallback((a: Auctioneer) => {
    upsertAuctioneer(a)
    const updated = listAuctioneers()
    setAuctioneers(updated)
    syncAuctioneerScore(updated)
  }, [])

  const updateAuctioneer = useCallback((a: Auctioneer) => {
    upsertAuctioneer(a)
    const updated = listAuctioneers()
    setAuctioneers(updated)
    syncAuctioneerScore(updated)
  }, [])

  const removeAuctioneer = useCallback((id: string) => {
    deleteFromStorage(id)
    const updated = listAuctioneers()
    setAuctioneers(updated)
    syncAuctioneerScore(updated)
  }, [])

  const resolveConflict = useCallback(
    (auctioneerId: string, field: string, resolution: 'KEEP_CURRENT' | 'USE_NEW', newValue?: string) => {
      if (resolution === 'USE_NEW' && newValue !== undefined) {
        const all = listAuctioneers()
        const idx = all.findIndex((a) => a.id === auctioneerId)
        if (idx >= 0) {
          ;(all[idx] as Record<string, unknown>)[field] = newValue
          all[idx].updatedAt = new Date().toISOString()
          saveAuctioneers(all)
          setAuctioneers(all)
        }
      }
      setPendingConflicts((prev) => prev.filter((c) => !(c.auctioneerId === auctioneerId && c.field === field)))
    },
    [],
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
  }
}
