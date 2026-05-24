import type { OrgGeneralInfo } from '@/types/general-info'

const KEY = 'tsd:general-info'

export function loadGeneralInfo(): OrgGeneralInfo | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as OrgGeneralInfo
  } catch {
    return null
  }
}

export function saveGeneralInfo(info: OrgGeneralInfo): void {
  localStorage.setItem(KEY, JSON.stringify(info))
}

export function clearGeneralInfo(): void {
  localStorage.removeItem(KEY)
}
