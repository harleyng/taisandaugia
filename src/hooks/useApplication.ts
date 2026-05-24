import { useState, useCallback, useEffect } from 'react'
import { Application, Announcement, AuctionPlan, SectionVCriterion, ExportFormat, ApplicationStatus } from '@/types/application'
import { getApplication, saveApplication } from '@/lib/applications/storage'
import { calcMucIII, calcMucV, calcTotal } from '@/lib/applications/scoring'

function createNewApplication(): Application {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  return {
    id,
    orgId: '',
    announcement: {
      ownerName: '',
      assetDescription: '',
      assetCategory: '',
      startingPrice: '',
      assetLocation: '',
      province: '',
      deadline: '',
      announcementUrl: '',
      announcementNumber: '',
      announcementDate: '',
    },
    capacitySnapshot: {
      scoreI: 0,
      scoreII: 0,
      scoreIV1to4: 0,
      scoreIV5: 0,
      scoreIV6to8: 0,
      scoreIV9: 0,
      totalCapacityScore: 0,
      warnings: [],
      snapshotAt: now,
    },
    auctionPlan: {
      format: '',
      receptionPlan: '',
      participantConditions: '',
      antiCollusionMeasures: '',
      score: 0,
    },
    sectionVCriteria: [],
    sectionVScore: 0,
    exportFormat: null,
    totalScore: 0,
    status: 'DRAFT',
    exportedFiles: [],
    createdAt: now,
    updatedAt: now,
  }
}

function recompute(app: Application): Application {
  const mucIII = calcMucIII(app.auctionPlan)
  const mucV = calcMucV(app.sectionVCriteria)
  const total = calcTotal(app.capacitySnapshot.totalCapacityScore, mucIII, mucV)
  return {
    ...app,
    auctionPlan: { ...app.auctionPlan, score: mucIII },
    sectionVScore: mucV,
    totalScore: total,
  }
}

interface UseApplicationReturn {
  app: Application | null
  isLoading: boolean
  isDirty: boolean
  updateAnnouncement: (data: Partial<Announcement>) => void
  updateAuctionPlan: (data: Partial<AuctionPlan>) => void
  updateCriteria: (criteria: SectionVCriterion[]) => void
  setExportFormat: (format: ExportFormat) => void
  setStatus: (status: ApplicationStatus) => void
  addExportedFile: (file: Application['exportedFiles'][0]) => void
  save: () => void
  refreshCapacity: (snapshot: Application['capacitySnapshot']) => void
}

export function useApplication(id: string | 'new'): UseApplicationReturn {
  const [app, setApp] = useState<Application | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (id === 'new') {
      setApp(createNewApplication())
    } else {
      const existing = getApplication(id)
      setApp(existing ?? createNewApplication())
    }
    setIsLoading(false)
  }, [id])

  const update = useCallback((updater: (prev: Application) => Application) => {
    setApp((prev) => {
      if (!prev) return prev
      const next = recompute(updater(prev))
      setIsDirty(true)
      return next
    })
  }, [])

  const updateAnnouncement = useCallback(
    (data: Partial<Announcement>) => {
      update((prev) => ({ ...prev, announcement: { ...prev.announcement, ...data } }))
    },
    [update]
  )

  const updateAuctionPlan = useCallback(
    (data: Partial<AuctionPlan>) => {
      update((prev) => ({ ...prev, auctionPlan: { ...prev.auctionPlan, ...data } }))
    },
    [update]
  )

  const updateCriteria = useCallback(
    (criteria: SectionVCriterion[]) => {
      update((prev) => ({ ...prev, sectionVCriteria: criteria }))
    },
    [update]
  )

  const setExportFormat = useCallback(
    (format: ExportFormat) => {
      update((prev) => ({ ...prev, exportFormat: format }))
    },
    [update]
  )

  const setStatus = useCallback(
    (status: ApplicationStatus) => {
      update((prev) => ({ ...prev, status }))
    },
    [update]
  )

  const addExportedFile = useCallback(
    (file: Application['exportedFiles'][0]) => {
      update((prev) => ({ ...prev, exportedFiles: [...prev.exportedFiles, file], status: 'EXPORTED' }))
    },
    [update]
  )

  const refreshCapacity = useCallback(
    (snapshot: Application['capacitySnapshot']) => {
      update((prev) => ({ ...prev, capacitySnapshot: snapshot }))
    },
    [update]
  )

  const save = useCallback(() => {
    if (app) {
      saveApplication(app)
      setIsDirty(false)
    }
  }, [app])

  return {
    app,
    isLoading,
    isDirty,
    updateAnnouncement,
    updateAuctionPlan,
    updateCriteria,
    setExportFormat,
    setStatus,
    addExportedFile,
    refreshCapacity,
    save,
  }
}
