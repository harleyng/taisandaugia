import { CheckCircle2, AlertCircle, CircleDashed } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ScoreReferenceBar } from './ScoreReferenceBar'
import type { TaxRecord } from '@/types/tax'
import { TAX_RECORD_TYPE_LABELS } from '@/types/tax'

interface Props {
  score: number
  targetYear: number
  targetRecord: TaxRecord | undefined
}

export function TaxScoreSummary({ score, targetYear, targetRecord }: Props) {
  const isMax = score === 3
  const hasData = score > 0

  const cardClass = isMax
    ? 'border-green-300 bg-green-50'
    : hasData
    ? 'border-amber-300 bg-amber-50'
    : 'border-border bg-muted/30'

  const Icon = isMax ? CheckCircle2 : hasData ? AlertCircle : CircleDashed
  const iconClass = isMax
    ? 'text-green-600'
    : hasData
    ? 'text-amber-600'
    : 'text-muted-foreground'

  const millions = targetRecord ? (targetRecord.amount / 1_000_000).toFixed(1) : null

  return (
    <Card className={`p-4 ${cardClass}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{score}</span>
              <span className="text-sm text-muted-foreground">/3 điểm</span>
              {isMax && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Điểm tối đa
                </span>
              )}
            </div>
            {targetRecord ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Năm {targetYear} · {TAX_RECORD_TYPE_LABELS[targetRecord.recordType]} ·{' '}
                {millions} triệu VND (đã trừ VAT)
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Chưa có dữ liệu năm {targetYear} — mất {3 - score} điểm tiềm năng
              </p>
            )}
          </div>
          <ScoreReferenceBar amountVnd={targetRecord?.amount ?? 0} />
        </div>
      </div>
    </Card>
  )
}
