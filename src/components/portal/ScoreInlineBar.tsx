import { cn } from '@/lib/utils'

interface Props {
  label: string   // e.g. "Mục IV.5" or "Mục IV.1-4 · Năm 2024"
  score: number
  max: number
  className?: string
}

function barColor(pct: number) {
  if (pct >= 75) return 'bg-green-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-destructive/70'
}

function textColor(pct: number) {
  if (pct >= 75) return 'text-green-600'
  if (pct >= 40) return 'text-amber-600'
  return 'text-destructive'
}

export function ScoreInlineBar({ label, score, max, className }: Props) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0

  return (
    <div className={cn('flex items-center gap-2 mt-1.5', className)}>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
        <div
          className={cn('h-full rounded-full transition-all', barColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums', textColor(pct))}>
        {score}/{max} điểm
      </span>
    </div>
  )
}
