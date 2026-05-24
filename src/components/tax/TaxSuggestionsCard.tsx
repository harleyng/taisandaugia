import { Lightbulb, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScoreReferenceBar } from './ScoreReferenceBar'
import { nextThresholdText } from '@/lib/tax/scoring'
import type { TaxRecord } from '@/types/tax'

interface Props {
  score: number
  targetYear: number
  targetRecord: TaxRecord | undefined
  onAction: () => void
}

export function TaxSuggestionsCard({ score, targetYear, targetRecord, onAction }: Props) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const rule = month <= 3 ? 'T1–T3: dùng năm N−2' : 'T4+: dùng năm N−1'

  const isMax = score === 3

  let title = ''
  let description = ''
  let cta = ''
  let pointsGain: number | null = null

  if (!targetRecord) {
    title = `Nhập số liệu thuế năm ${targetYear}`
    description = 'Chưa có dữ liệu — nhập để được tính điểm Mục IV.9'
    cta = 'Thêm'
    pointsGain = 3
  } else if (!isMax) {
    const next = nextThresholdText(targetRecord.amount)
    const millions = (targetRecord.amount / 1_000_000).toFixed(1)
    title = `Tăng điểm Mục IV.9 (hiện ${millions} triệu)`
    description = next ?? `Đạt ${score}/3 điểm`
    cta = 'Cập nhật'
    pointsGain = 3 - score
  }

  return (
    <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">Năm tính điểm: {targetYear}</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Nộp hồ sơ tháng {month}/{year} — {rule}. Chỉ dữ liệu năm {targetYear} được tính.
          </p>
        </div>
      </div>

      {isMax ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
          <p className="text-xs font-medium text-green-800">Mục IV.9: Đạt điểm tối đa 3/3 ✓</p>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="flex items-center justify-between rounded-xl bg-white border border-amber-100 px-3 py-2.5 cursor-pointer hover:bg-amber-50 transition-colors"
          onClick={onAction}
          onKeyDown={(e) => e.key === 'Enter' && onAction()}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{title}</p>
              {pointsGain !== null && pointsGain > 0 && (
                <span className="text-xs font-semibold text-green-700">+{pointsGain}đ</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 ml-3 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={(e) => { e.stopPropagation(); onAction() }}
          >
            {cta}
          </Button>
        </div>
      )}

      <div className="pt-0.5">
        <ScoreReferenceBar amountVnd={targetRecord?.amount ?? 0} />
      </div>
    </div>
  )
}
