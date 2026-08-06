import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { DossierEvent } from '@/types/personnel'
import { EventList } from './EventList'
import { DossierEventDialog } from './DossierEventDialog'

interface Props {
  events: DossierEvent[]
  onSave: (ev: Partial<DossierEvent>) => void
  onDelete: (id: string) => void
}

/**
 * Chỉ còn QUÁ TRÌNH CÔNG TÁC.
 *
 * Phần "cuộc đấu giá đã điều hành" đã bỏ khỏi đây: dữ liệu đó thuộc module
 * Lịch sử đấu giá và được đọc thẳng lúc kết xuất (ConductedAuctionsCard hiển
 * thị lại ở chế độ chỉ đọc). Lưu bản sao sẽ lệch ngay khi module kia đổi.
 */
export function CareerSection({ events, onSave, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DossierEvent | undefined>()

  const work = useMemo(() => events.filter((e) => e.eventType === 'WORK'), [events])

  const openAdd = () => { setEditing(undefined); setDialogOpen(true) }
  const openEdit = (e: DossierEvent) => { setEditing(e); setDialogOpen(true) }

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Quá trình công tác</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Các nơi đã và đang công tác, kèm chức vụ và thời gian.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          Thêm
        </Button>
      </div>

      <EventList
        events={work}
        emptyText="Chưa khai báo quá trình công tác."
        onEdit={openEdit}
        onDelete={onDelete}
      />

      <DossierEventDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(undefined) }}
        eventType="WORK"
        existing={editing}
        onSave={onSave}
      />
    </Card>
  )
}
