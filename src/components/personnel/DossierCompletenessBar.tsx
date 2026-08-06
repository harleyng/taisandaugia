import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle } from 'lucide-react'
import type { DossierCompleteness } from '@/types/personnel'

interface Props {
  completeness: DossierCompleteness
}

export function DossierCompletenessBar({ completeness }: Props) {
  const pct = Math.round(completeness.ratio * 100)
  const items: Array<[boolean, string]> = [
    [completeness.identityDone, 'Định danh'],
    [completeness.documentsDone, 'Giấy tờ'],
    [completeness.careerDone, 'Công tác'],
    [completeness.trainingDone, 'Đào tạo'],
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Mức hoàn thiện hồ sơ</span>
        <span className="text-xs font-medium">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map(([done, label]) => (
          <span
            key={label}
            className={`flex items-center gap-1 text-xs ${done ? 'text-success' : 'text-muted-foreground'}`}
          >
            {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
