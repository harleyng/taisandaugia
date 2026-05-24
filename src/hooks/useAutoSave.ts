import { useEffect, useRef, useState } from 'react'
import { Application } from '@/types/application'

type SaveStatus = 'idle' | 'saving' | 'saved'

interface UseAutoSaveReturn {
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  statusLabel: string
}

export function useAutoSave(
  app: Application | null,
  save: () => void,
  isDirty: boolean,
  delayMs = 2000
): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!app || !isDirty) return

    setSaveStatus('saving')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      save()
      setSaveStatus('saved')
      setLastSavedAt(new Date())
    }, delayMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [app, isDirty, save, delayMs])

  const statusLabel = (() => {
    if (saveStatus === 'saving') return 'Đang lưu...'
    if (saveStatus === 'saved' && lastSavedAt) {
      const diffMin = Math.floor((Date.now() - lastSavedAt.getTime()) / 60000)
      if (diffMin === 0) return 'Đã lưu nháp · vừa xong'
      return `Đã lưu nháp · ${diffMin} phút trước`
    }
    return ''
  })()

  return { saveStatus, lastSavedAt, statusLabel }
}
