import { AlertCircle } from 'lucide-react'

interface Props {
  lastUpdatedAt: string
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export function SectionFreshnessIndicator({ lastUpdatedAt }: Props) {
  const isStale = Date.now() - new Date(lastUpdatedAt).getTime() > NINETY_DAYS_MS
  if (!isStale) return null

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
      <AlertCircle className="h-3 w-3" />
      Cần cập nhật
    </span>
  )
}
