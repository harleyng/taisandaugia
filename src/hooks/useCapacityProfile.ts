import { useMemo } from 'react'
import { CapacityProfile } from '@/types/capacity-profile'
import { getCapacityProfile } from '@/lib/applications/storage'
import { Application } from '@/types/application'

interface UseCapacityProfileReturn {
  profile: CapacityProfile
  isLoading: false
  toSnapshot: () => Application['capacitySnapshot']
}

export function useCapacityProfile(): UseCapacityProfileReturn {
  const profile = useMemo(() => getCapacityProfile(), [])

  const toSnapshot = useMemo(
    () => (): Application['capacitySnapshot'] => ({
      scoreI: profile.onMinistryList ? 0 : 0,
      scoreII: profile.scoreII,
      scoreIV1to4: profile.scoreIV1to4,
      scoreIV5: profile.scoreIV5,
      scoreIV6to8: profile.scoreIV6to8,
      scoreIV9: profile.scoreIV9,
      totalCapacityScore: profile.totalCapacityScore,
      warnings: profile.warnings,
      snapshotAt: new Date().toISOString(),
    }),
    [profile]
  )

  return { profile, isLoading: false, toSnapshot }
}
