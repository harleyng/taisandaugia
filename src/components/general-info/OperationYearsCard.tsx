import { Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { YearsOfOperation } from '@/lib/general-info/scoring'
import { mucIV5NextThreshold } from '@/lib/general-info/scoring'

interface OperationYearsCardProps {
  yearsOfOperation: YearsOfOperation
  score: number
}

export function OperationYearsCard({ yearsOfOperation, score }: OperationYearsCardProps) {
  const next = mucIV5NextThreshold(yearsOfOperation.years)

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <Timer className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              Thời gian hoạt động:{' '}
              <span className="text-foreground">{yearsOfOperation.displayText}</span>
            </p>
            {score >= 4 ? (
              <p className="text-xs text-green-600 mt-0.5">≥ 15 năm — đạt điểm tối đa ✓</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">{next}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
