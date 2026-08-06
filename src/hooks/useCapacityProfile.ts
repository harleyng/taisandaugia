import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CapacityProfile } from '@/types/capacity-profile'
import type { Application } from '@/types/application'
import * as repo from '@/lib/applications/supabase-repo'
import { qk } from '@/lib/queryKeys'
import { usePortalOrg } from '@/hooks/usePortalOrg'

interface UseCapacityProfileReturn {
  profile: CapacityProfile
  isLoading: boolean
  toSnapshot: () => Application['capacitySnapshot']
}

/**
 * Điểm năng lực tổng hợp của tổ chức (bảng org_capacity_profile).
 *
 * ⚠️ ĐỔI HÀNH VI CÓ CHỦ Ý: bản cũ `getCapacityProfile()` đọc localStorage và khi
 * không có dữ liệu thì trả về MOCK_CAPACITY_PROFILE — nên một tổ chức thật, chưa
 * nhập gì, vẫn thấy "47 cuộc đấu giá" và điểm của công ty mẫu, rồi số đó chảy vào
 * ảnh chụp năng lực của hồ sơ dự tuyển. Nay chưa có dữ liệu thì trả bộ số 0.
 */
const EMPTY: CapacityProfile = {
  onMinistryList: false,
  scoreII: 0,
  scoreIV1to4: 0,
  auctionsCompleted: 0,
  auctionsMissingPrice: 0,
  scoreIV5: 0,
  yearsActive: 0,
  scoreIV6to8: 0,
  auctioneerCount: 0,
  scoreIV9: 0,
  taxPaidPreviousYear: 0,
  totalCapacityScore: 0,
  warnings: [],
}

export function useCapacityProfile(): UseCapacityProfileReturn {
  const { organizationId } = usePortalOrg()

  const { data, isLoading } = useQuery({
    queryKey: qk.orgCapacityProfile(organizationId),
    enabled: !!organizationId,
    queryFn: () => repo.getCapacityProfile(organizationId!),
  })

  const profile = data ?? EMPTY

  const toSnapshot = useCallback(
    (): Application['capacitySnapshot'] => ({
      // Mục I không tính điểm — chỉ là điều kiện cần (có trong danh sách Bộ Tư pháp).
      scoreI: 0,
      scoreII: profile.scoreII,
      scoreIV1to4: profile.scoreIV1to4,
      scoreIV5: profile.scoreIV5,
      scoreIV6to8: profile.scoreIV6to8,
      scoreIV9: profile.scoreIV9,
      totalCapacityScore: profile.totalCapacityScore,
      warnings: profile.warnings,
      snapshotAt: new Date().toISOString(),
    }),
    [profile],
  )

  return { profile, isLoading, toSnapshot }
}
