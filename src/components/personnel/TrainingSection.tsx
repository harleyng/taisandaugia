import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, AlertTriangle, CheckCircle2, ShieldOff } from 'lucide-react'
import type { CpdExemption, DossierEvent, EventType } from '@/types/personnel'
import { EventList } from './EventList'
import { DossierEventDialog } from './DossierEventDialog'
import { trainingCompliance } from '@/lib/personnel/completeness'
import { CPD_REASON_LABELS } from '@/lib/personnel/cpd'
import { formLabel } from '@/lib/personnel/cpd-catalog'
import { useCpdCatalog } from '@/hooks/useCpdCatalog'

interface Props {
  events: DossierEvent[]
  /** Diện miễn theo Điều 26.3 — thiếu thì banner báo thiếu giờ oan. */
  exemptions?: CpdExemption[]
  /** Cần cả hai để bật ô đính kèm giấy tờ xác nhận (Điều 27.1). */
  organizationId?: string
  auctioneerId?: string
  onSave: (ev: Partial<DossierEvent>) => void
  onDelete: (id: string) => void
}

export function TrainingSection({
  events, exemptions = [], organizationId, auctioneerId, onSave, onDelete,
}: Props) {
  const [dialogType, setDialogType] = useState<EventType | null>(null)
  const [editing, setEditing] = useState<DossierEvent | undefined>()

  const { index, resolve } = useCpdCatalog()
  const training = useMemo(() => events.filter((e) => e.eventType === 'TRAINING'), [events])
  const compliance = useMemo(() => {
    const year = new Date().getFullYear()
    const ex = exemptions.find((x) => x.year === year)
    const labelOf = (e: DossierEvent) => formLabel(
      e.cpdActivityTypeId ? index.typeById.get(e.cpdActivityTypeId) : undefined,
      e.cpdActivityRoleId ? index.roleById.get(e.cpdActivityRoleId) : undefined,
    )
    return trainingCompliance(
      events,
      year,
      resolve,
      ex ? { reasonName: index.reasonById.get(ex.reasonId)?.name } : undefined,
      labelOf,
    )
  }, [events, exemptions, resolve, index])
  const rewards = useMemo(
    () => events.filter((e) => e.eventType === 'REWARD' || e.eventType === 'DISCIPLINE'),
    [events],
  )

  const openAdd = (t: EventType) => { setEditing(undefined); setDialogType(t) }
  const openEdit = (e: DossierEvent) => { setEditing(e); setDialogType(e.eventType) }

  return (
    <Card className="p-5 rounded-2xl space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Đào tạo & Khen thưởng / Kỷ luật</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Bồi dưỡng nghiệp vụ hằng năm theo quy định, cùng khen thưởng và xử lý vi phạm.
        </p>
      </div>

      <div
        className={`flex items-start gap-2.5 rounded-lg border p-3 ${
          compliance.isExempt
            ? 'bg-muted/40'
            : compliance.ok
              ? 'border-success/40 bg-success/5'
              : 'border-warning/40 bg-warning/5'
        }`}
      >
        {compliance.isExempt ? (
          <ShieldOff className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        ) : compliance.ok ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
        )}
        <div>
          <p className="text-sm font-medium">
            Bồi dưỡng năm {compliance.year}
            {compliance.isExempt
              ? ' — được miễn'
              : compliance.hasFullYearForm
                ? ' — đã hoàn thành nghĩa vụ cả năm'
                : `: ${compliance.hours}/${compliance.required} giờ`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {compliance.ok
              ? CPD_REASON_LABELS[compliance.reason]
              : `Còn thiếu ${compliance.required - compliance.hours} giờ so với mức tối thiểu 8 giờ/năm theo Điều 26 Thông tư 19/2024/TT-BTP.`}
            {compliance.missingProof && ' Có hoạt động chưa đính kèm giấy tờ xác nhận.'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bồi dưỡng nghiệp vụ
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAdd('TRAINING')}>
            <Plus className="h-3.5 w-3.5" />
            Thêm
          </Button>
        </div>
        <EventList
          events={training}
          emptyText="Chưa ghi nhận khoá bồi dưỡng nào."
          onEdit={openEdit}
          onDelete={onDelete}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Khen thưởng / Kỷ luật
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAdd('REWARD')}>
              <Plus className="h-3.5 w-3.5" />
              Khen thưởng
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAdd('DISCIPLINE')}>
              <Plus className="h-3.5 w-3.5" />
              Kỷ luật
            </Button>
          </div>
        </div>
        <EventList
          events={rewards}
          emptyText="Chưa có khen thưởng hay kỷ luật nào."
          onEdit={openEdit}
          onDelete={onDelete}
        />
      </div>

      {dialogType && (
        <DossierEventDialog
          open={!!dialogType}
          onOpenChange={(o) => { if (!o) { setDialogType(null); setEditing(undefined) } }}
          eventType={dialogType}
          existing={editing}
          organizationId={organizationId}
          auctioneerId={auctioneerId}
          onSave={onSave}
        />
      )}
    </Card>
  )
}
