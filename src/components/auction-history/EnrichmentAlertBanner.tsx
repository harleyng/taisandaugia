import { Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  count: number
  onGoToTab: () => void
}

export function EnrichmentAlertBanner({ count, onGoToTab }: Props) {
  if (count === 0) return null
  return (
    <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-medium text-amber-900">1 gợi ý hoàn thiện hồ sơ năng lực</p>
      </div>

      <div
        role="button"
        tabIndex={0}
        className="flex items-center justify-between rounded-xl bg-white border border-amber-100 px-3 py-2.5 cursor-pointer hover:bg-amber-50 transition-colors"
        onClick={onGoToTab}
        onKeyDown={(e) => e.key === 'Enter' && onGoToTab()}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">Bổ sung giá trúng còn thiếu</p>
            <span className="text-xs font-semibold text-green-700">tăng điểm IV.3-4</span>
          </div>
          <p className="text-xs text-muted-foreground">{count} cuộc đấu giá chưa có giá trúng</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 ml-3 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
          onClick={(e) => { e.stopPropagation(); onGoToTab() }}
        >
          Bổ sung nhanh
        </Button>
      </div>
    </div>
  )
}
