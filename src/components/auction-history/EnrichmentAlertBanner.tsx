import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  count: number
  onGoToTab: () => void
}

export function EnrichmentAlertBanner({ count, onGoToTab }: Props) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-800 flex-1">
        <span className="font-semibold">{count} cuộc thiếu giá trúng</span> — mất điểm Mục IV.3-4
      </p>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50"
        onClick={onGoToTab}
      >
        Bổ sung nhanh →
      </Button>
    </div>
  )
}
