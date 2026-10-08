import { cn } from '@/lib/utils'
import { DetailCard } from './DetailCard'
import { fmtDate } from './format'
import { HISTORY_ACTOR_LABELS, type HistoryEvent } from './requestHistory'

function dotClass(e: HistoryEvent, latest: boolean): string {
  if (e.tone === 'ok') return cn('border-success', latest && 'bg-success')
  if (e.tone === 'err') return cn('border-destructive', latest && 'bg-destructive')
  return latest ? 'border-primary bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]' : 'border-muted-foreground/45'
}

/** "Lịch sử thao tác" — dòng thời gian mới nhất lên đầu, chấm đầu tiên tô đặc. */
export function HistoryCard({ events }: { events: HistoryEvent[] }) {
  return (
    <DetailCard title="Lịch sử thao tác">
      <ol className="flex flex-col">
        {events.map((e, i) => {
          const last = i === events.length - 1
          return (
            <li key={`${e.title}-${e.at}`} className={cn('relative grid grid-cols-[12px_minmax(0,1fr)] gap-3', !last && 'pb-[18px]')}>
              {!last && <span aria-hidden className="absolute -bottom-0.5 left-[5.5px] top-3.5 w-px bg-border" />}
              <i className={cn('mt-[3px] h-3 w-3 rounded-full border-2 bg-card', dotClass(e, i === 0))} />
              <div className="min-w-0">
                <p className="text-sm font-medium [text-wrap:pretty]">{e.title}</p>
                {e.sub && (
                  <p className="mt-px text-[13px] text-muted-foreground [overflow-wrap:anywhere] [text-wrap:pretty]">{e.sub}</p>
                )}
                <p className="mt-[3px] text-xs tabular-nums text-muted-foreground">
                  {fmtDate(e.at)} · {HISTORY_ACTOR_LABELS[e.who]}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </DetailCard>
  )
}
