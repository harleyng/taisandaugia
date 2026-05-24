import { Application } from '@/types/application'
import { scoreBreakdown } from '@/lib/applications/scoring'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  app: Application
  statusLabel: string
}

export function ApplicationScoreHeader({ app, statusLabel }: Props) {
  const bd = scoreBreakdown(app.capacitySnapshot.totalCapacityScore, app.auctionPlan.score, app.sectionVScore)
  const total = bd.total

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-border shadow-sm px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        {/* Score display */}
        <div className="flex items-center gap-2 shrink-0">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div>
            <span className="text-xs text-muted-foreground">Điểm dự kiến</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-primary">{total}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex-1">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted gap-px">
            <div
              className="bg-primary transition-all duration-300"
              style={{ width: `${(bd.capacity.score / 100) * 100}%` }}
              title={`Năng lực: ${bd.capacity.score}/76`}
            />
            <div
              className="bg-amber-500 transition-all duration-300"
              style={{ width: `${(bd.mucIII.score / 100) * 100}%` }}
              title={`Mục III: ${bd.mucIII.score}/16`}
            />
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${(bd.mucV.score / 100) * 100}%` }}
              title={`Mục V: ${bd.mucV.score}/8`}
            />
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-primary" />
              Năng lực {bd.capacity.score}/76
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-amber-500" />
              Mục III {bd.mucIII.score}/16
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
              Mục V {bd.mucV.score}/8
            </span>
          </div>
        </div>

        {/* Save status */}
        {statusLabel && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{statusLabel}</span>
        )}
      </div>
    </div>
  )
}
