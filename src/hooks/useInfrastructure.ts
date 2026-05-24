import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Infrastructure } from '@/types/infrastructure'
import {
  getInfrastructure,
  saveInfrastructure,
  createDefaultInfrastructure,
} from '@/lib/infrastructure/storage'
import { calcMucII, totalFromBreakdown, getSectionsNeedingUpdate } from '@/lib/infrastructure/scoring'
import { generateSuggestions, type Suggestion } from '@/lib/infrastructure/suggestions'
import { listAuctionRecords } from '@/lib/auction-history/storage'
import type { AuctionRecord } from '@/types/auction-record'

type SaveStatus = 'idle' | 'saving' | 'saved'

function getPreviousYear(): number {
  const now = new Date()
  return now.getMonth() < 3 ? now.getFullYear() - 2 : now.getFullYear() - 1
}

export function useInfrastructure() {
  const [infra, setInfra] = useState<Infrastructure>(() => {
    return getInfrastructure() ?? createDefaultInfrastructure()
  })
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scoreBreakdown = useMemo(() => calcMucII(infra), [infra])
  const totalScore = useMemo(() => totalFromBreakdown(scoreBreakdown), [scoreBreakdown])
  const suggestions = useMemo(() => generateSuggestions(infra, scoreBreakdown), [infra, scoreBreakdown])

  const onlineAuctionsLastYear = useMemo((): AuctionRecord[] => {
    const prevYear = getPreviousYear()
    return listAuctionRecords().filter(
      (r) => r.auctionFormat === 'ONLINE' && r.year === prevYear,
    )
  }, [])

  const save = useCallback(() => {
    const updated: Infrastructure = {
      ...infra,
      totalScore,
      scoreBreakdown,
      sectionsNeedingUpdate: getSectionsNeedingUpdate(infra),
      completionPercentage: Math.round((totalScore / 19) * 100),
    }
    saveInfrastructure(updated)
    setSaveStatus('saved')
    setLastSavedAt(new Date())
  }, [infra, totalScore, scoreBreakdown])

  useEffect(() => {
    if (!isDirty) return
    setSaveStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      save()
    }, 2000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [infra, isDirty, save])

  const statusLabel = (() => {
    if (saveStatus === 'saving') return 'Đang lưu...'
    if (saveStatus === 'saved' && lastSavedAt) {
      const diffMin = Math.floor((Date.now() - lastSavedAt.getTime()) / 60000)
      if (diffMin === 0) return 'Đã lưu · vừa xong'
      return `Đã lưu · ${diffMin} phút trước`
    }
    return ''
  })()

  function updateSection<K extends keyof Infrastructure>(
    section: K,
    partial: Partial<Infrastructure[K]>,
  ) {
    setInfra((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as object),
        ...partial,
        lastUpdatedAt: new Date().toISOString(),
      },
    }))
    setIsDirty(true)
  }

  return {
    infra,
    updateSection,
    saveStatus,
    statusLabel,
    scoreBreakdown,
    totalScore,
    suggestions,
    onlineAuctionsLastYear,
  }
}
