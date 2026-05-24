import { Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { YearsOfOperation } from '@/lib/general-info/scoring'
import { mucIV5NextThreshold } from '@/lib/general-info/scoring'

interface OperationYearsCardProps {
  yearsOfOperation: YearsOfOperation
  score: number
}

const SCORE_LABELS: Record<number, string> = {
  4: 'mức cao nhất',
  3: '10-15 năm',
  2: '5-10 năm',
  1: '< 5 năm',
  0: 'chưa đủ 1 năm',
}

export function OperationYearsCard({ yearsOfOperation, score }: OperationYearsCardProps) {
  const next = mucIV5NextThreshold(yearsOfOperation.years)

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <Timer className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                Thời gian hoạt động: <span className="text-foreground font-semibold">{yearsOfOperation.displayText}</span>
              </span>
              <Badge variant={score >= 4 ? 'default' : 'secondary'} className="text-xs">
                Mục IV.5: {score}/4 điểm
              </Badge>
            </div>
            {score >= 4 ? (
              <p className="text-xs text-success mt-0.5">≥ 15 năm — {SCORE_LABELS[score]} ✓</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                {SCORE_LABELS[score]}{next ? ` · ${next}` : ''}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
