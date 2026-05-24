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
    ? 'border-green-200 bg-green-50/50'
    : hasData
    ? 'border-amber-200 bg-amber-50/50'
    : 'border-border bg-muted/20'

  const Icon = isMax ? CheckCircle2 : hasData ? AlertCircle : CircleDashed
  const iconClass = isMax ? 'text-green-600' : hasData ? 'text-amber-600' : 'text-muted-foreground'

  const millions = targetRecord ? (targetRecord.amount / 1_000_000).toFixed(1) : null

  return (
    <Card className={`p-4 ${cardClass}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
        <div className="flex-1 space-y-3">
          {targetRecord ? (
            <p className="text-sm text-muted-foreground">
              Năm {targetYear} · {TAX_RECORD_TYPE_LABELS[targetRecord.recordType]} ·{' '}
              <span className="font-medium text-foreground">{millions} triệu VND</span> (đã trừ VAT)
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa có dữ liệu năm {targetYear} — nhập số liệu để được tính điểm
            </p>
          )}
          <ScoreReferenceBar amountVnd={targetRecord?.amount ?? 0} />
        </div>
      </div>
    </Card>
  )
}
