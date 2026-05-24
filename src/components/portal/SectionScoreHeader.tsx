import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface Props {
  label: string    // e.g. "Mục IV.6-8 — Đấu giá viên"
  score: number
  max: number
  detail?: string  // e.g. "Năm tính điểm: 2024"
}

function badgeColor(pct: number) {
  if (pct >= 75) return 'bg-green-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

export function SectionScoreHeader({ label, score, max, detail }: Props) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const remaining = max - score

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-0.5">
            {score}
            <span className="text-lg font-normal text-muted-foreground">/{max} điểm</span>
          </p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-sm font-medium text-white shrink-0', badgeColor(pct))}>
          {pct}%
        </span>
      </div>

      <div className="space-y-1.5">
        <Progress value={pct} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {detail && <span>{detail}</span>}
          {remaining > 0 ? (
            <span className={cn(!detail && 'ml-auto')}>Còn {remaining} điểm có thể đạt thêm</span>
          ) : (
            <span className={cn('text-green-600 font-medium', !detail && 'ml-auto')}>Điểm tối đa ✓</span>
          )}
        </div>
      </div>
    </div>
  )
}
