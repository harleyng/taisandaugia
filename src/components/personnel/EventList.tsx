import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import type { DossierEvent } from '@/types/personnel'
import { groupNumber } from '@/components/asset-posting/format'

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : '')

interface Props {
  events: DossierEvent[]
  emptyText: string
  onEdit: (ev: DossierEvent) => void
  onDelete: (id: string) => void
}

/** Danh sách mốc dùng chung cho cả 5 loại sự kiện. */
export function EventList({ events, emptyText, onEdit, onDelete }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-6 text-center">
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="divide-y rounded-lg border">
      {events.map((e) => {
        const period = e.endedOn
          ? `${fmtDate(e.startedOn)} – ${fmtDate(e.endedOn)}`
          : fmtDate(e.startedOn)
        const meta = [
          e.organizationName,
          e.role,
          period,
          e.referenceNo,
          e.outcome,
          e.amount ? `${groupNumber(String(e.amount))}₫` : '',
          e.hours ? `${e.hours} giờ` : '',
        ].filter(Boolean).join(' · ')

        return (
          <div key={e.id} className="flex items-start gap-3 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{e.title}</p>
              {meta && <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>}
              {e.notes && <p className="text-xs text-muted-foreground mt-0.5">{e.notes}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit(e)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(e.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
