import { Card } from '@/components/ui/card'
import { CheckCircle2, Circle, Calendar } from 'lucide-react'
import { Application } from '@/types/application'
import { scoreBreakdown } from '@/lib/applications/scoring'
import { validateForExport } from '@/lib/applications/validation'

interface Props {
  app: Application
}

function MiniScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: 'primary' | 'amber' | 'emerald' }) {
  const pct = Math.min((score / max) * 100, 100)
  const barColor = color === 'primary' ? 'bg-primary' : color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground w-9 text-right shrink-0">
        {score}/{max}
      </span>
    </div>
  )
}

export function ApplicationSummaryBox({ app }: Props) {
  const bd = scoreBreakdown(app.capacitySnapshot.totalCapacityScore, app.auctionPlan.score, app.sectionVScore)
  const errors = validateForExport(app)

  const sec1Done = !errors.some((e) => e.section === 'Section 1')
  const sec3Done = !errors.some((e) => e.section.startsWith('Mục III'))
  const sec4Done = !errors.some((e) => e.section === 'Mục V')

  const sections = [
    { label: 'Thông tin cuộc đấu giá', done: sec1Done, id: 'section-1' },
    { label: 'Năng lực tổ chức', done: true, id: 'section-2' },
    { label: 'Phương án đấu giá', done: sec3Done, id: 'section-3' },
    { label: 'Tiêu chí khác', done: sec4Done, id: 'section-4' },
  ]

  const deadline = app.announcement.deadline

  return (
    <Card className="p-4 space-y-4">
      {/* Score tổng */}
      <div className="text-center pb-4 border-b border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Điểm dự kiến</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-bold text-primary">{bd.total}</span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <MiniScoreBar label="Năng lực" score={bd.capacity.score} max={76} color="primary" />
          <MiniScoreBar label="Mục III" score={bd.mucIII.score} max={16} color="amber" />
          <MiniScoreBar label="Mục V" score={bd.mucV.score} max={8} color="emerald" />
        </div>
      </div>

      {/* Checklist sections */}
      <div className="space-y-1">
        {sections.map((s, i) => (
          <button
            key={i}
            className="flex items-center gap-2 w-full text-left rounded px-1 py-1 hover:bg-muted/60 transition-colors"
            onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {s.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            )}
            <span className={`text-xs ${s.done ? 'text-muted-foreground' : 'text-foreground'}`}>
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Hạn nộp */}
      {deadline && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">
            Hạn nộp:{' '}
            <span className="text-foreground font-medium">
              {new Date(deadline).toLocaleDateString('vi-VN')}
            </span>
          </span>
        </div>
      )}
    </Card>
  )
}
