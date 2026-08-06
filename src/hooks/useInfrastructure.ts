import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Infrastructure } from '@/types/infrastructure'
import { createDefaultInfrastructure } from '@/lib/infrastructure/defaults'
import * as repo from '@/lib/infrastructure/supabase-repo'
import { calcMucII, totalFromBreakdown, getSectionsNeedingUpdate } from '@/lib/infrastructure/scoring'
import { generateSuggestions, type Suggestion } from '@/lib/infrastructure/suggestions'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { rowToRecord } from '@/lib/auction-history/supabase-repo'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import type { AuctionRecord } from '@/types/auction-record'
import { patchCapacityProfile } from '@/lib/applications/capacity-sync'
import { qk } from '@/lib/queryKeys'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type SaveStatus = 'idle' | 'saving' | 'saved'

function getPreviousYear(): number {
  const now = new Date()
  return now.getMonth() < 3 ? now.getFullYear() - 2 : now.getFullYear() - 1
}

export function useInfrastructure() {
  const { organizationId } = usePortalOrg()
  const qc = useQueryClient()

  // Truy vấn là NGUỒN, `infra` là bản nháp đang sửa. Form này autosave nên phải
  // giữ state cục bộ; nếu render trực tiếp từ cache thì mỗi lượt refetch sẽ
  // giật lại những gì user vừa gõ.
  const { data: loaded, isLoading } = useQuery({
    queryKey: qk.orgInfrastructure(organizationId),
    enabled: !!organizationId,
    queryFn: () => repo.getInfrastructure(organizationId!),
  })

  const [infra, setInfra] = useState<Infrastructure>(() => createDefaultInfrastructure())
  const [isDirty, setIsDirty] = useState(false)
  const seededRef = useRef(false)

  // Nạp một lần khi truy vấn xong. KHÔNG ghi đè nếu user đã bắt đầu sửa.
  useEffect(() => {
    if (seededRef.current || isLoading || !organizationId) return
    seededRef.current = true
    if (!isDirty) setInfra(loaded ?? createDefaultInfrastructure(organizationId))
  }, [isLoading, loaded, organizationId, isDirty])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scoreBreakdown = useMemo(() => calcMucII(infra), [infra])
  const totalScore = useMemo(() => totalFromBreakdown(scoreBreakdown), [scoreBreakdown])
  const suggestions = useMemo(() => generateSuggestions(infra, scoreBreakdown), [infra, scoreBreakdown])

  // Trước đây hàm này đọc localStorage 'tsd:auction-records' — một kho KHÔNG
  // nơi nào ghi vào — và lọc theo `r.year`, thuộc tính AuctionRecord không hề
  // có (nó nằm trên AuctionHistoryScore). Nên nó luôn trả rỗng, và ô "số cuộc
  // đấu giá trực tuyến năm trước" ở Mục II không bao giờ tự điền.
  const { data: onlineAuctionsLastYear = [] } = useQuery({
    queryKey: ['online-auctions-last-year', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<AuctionRecord[]> => {
      const prevYear = getPreviousYear()
      const { data, error } = await supabase
        .from('org_auction_records')
        .select('*')
        .eq('organization_id', organizationId!)
        .gte('auction_date', `${prevYear}-01-01`)
        .lte('auction_date', `${prevYear}-12-31`)
        // auctionFormat nằm trong cột details (JSONB).
        .eq('details->>auctionFormat', 'ONLINE')
        .order('auction_date', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToRecord(r as never))
    },
  })

  const save = useCallback(async () => {
    if (!organizationId) return
    const updated: Infrastructure = {
      ...infra,
      totalScore,
      scoreBreakdown,
      sectionsNeedingUpdate: getSectionsNeedingUpdate(infra),
      completionPercentage: Math.round((totalScore / 19) * 100),
    }
    try {
      await repo.saveInfrastructure(updated, organizationId)

      // Điểm Mục II chảy vào hồ sơ năng lực tổng hợp.
      await patchCapacityProfile(organizationId, { scoreII: totalScore }, 'scoreII')
      qc.invalidateQueries({ queryKey: qk.orgCapacityProfile(organizationId) })
      setSaveStatus('saved')
      setLastSavedAt(new Date())
      setIsDirty(false)
    } catch {
      // Autosave thất bại phải nói ra: nếu im lặng, user đóng tab và tưởng đã lưu.
      setSaveStatus('idle')
      toast.error('Không lưu được cơ sở vật chất. Kiểm tra kết nối rồi thử lại.')
    }
  }, [infra, organizationId, qc, scoreBreakdown, totalScore])

  useEffect(() => {
    if (!isDirty) return
    setSaveStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void save()
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
    isLoading,
    updateSection,
    saveStatus,
    statusLabel,
    scoreBreakdown,
    totalScore,
    suggestions,
    onlineAuctionsLastYear,
  }
}
