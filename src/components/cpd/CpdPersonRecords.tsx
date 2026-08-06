import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileWarning, Pencil, ShieldOff, Trash2 } from 'lucide-react'
import type { CpdExemption, DossierEvent } from '@/types/personnel'
import { useCpdCatalog } from '@/hooks/useCpdCatalog'
import { creditedHoursOf, formLabel } from '@/lib/personnel/cpd-catalog'

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')

interface Props {
  records: DossierEvent[]
  exemption?: CpdExemption
  onEdit: (e: DossierEvent) => void
  onDelete: (e: DossierEvent) => void
  onEditExemption: () => void
  onRemoveExemption: () => void
}

export function CpdPersonRecords({
  records, exemption, onEdit, onDelete, onEditExemption, onRemoveExemption,
}: Props) {
  const { index, resolve } = useCpdCatalog()
  const labelOf = (e: DossierEvent) => formLabel(
    e.cpdActivityTypeId ? index.typeById.get(e.cpdActivityTypeId) : undefined,
    e.cpdActivityRoleId ? index.roleById.get(e.cpdActivityRoleId) : undefined,
  )

  return (
    <div className="space-y-2 px-4 py-3 bg-muted/30">
      {exemption && (
        <div className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
          <ShieldOff className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              Được miễn — {index.reasonById.get(exemption.reasonId)?.name ?? 'Không rõ lý do'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[
                exemption.filedAt
                  ? `Đã nộp Sở Tư pháp ${fmtDate(exemption.filedAt)}`
                  : 'Chưa ghi nhận ngày nộp Sở Tư pháp (hạn 15/12)',
                exemption.attachments.length > 0
                  ? `${exemption.attachments.length} tệp đính kèm`
                  : 'Chưa có giấy tờ đính kèm',
                exemption.note,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onEditExemption}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemoveExemption}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {records.length === 0 && !exemption && (
        <p className="text-xs text-muted-foreground py-2">
          Chưa ghi nhận hoạt động bồi dưỡng nào trong năm này.
        </p>
      )}

      {records.map((r) => {
        const rule = resolve(r)
        const label = labelOf(r)
        return (
        <div key={r.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{r.title}</span>
              {label && (
                <Badge variant="secondary" className="text-xs font-normal">{label}</Badge>
              )}
              {rule?.mode === 'FULL_YEAR' && (
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  Hoàn thành cả năm
                </Badge>
              )}
              {r.attachments.length === 0 && (
                <Badge variant="outline" className="gap-1 text-xs font-normal text-muted-foreground">
                  <FileWarning className="h-3 w-3" />
                  Thiếu minh chứng
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[
                fmtDate(r.startedOn),
                r.organizationName,
                // Giờ ĐƯỢC TÍNH, không phải giờ đã khai — với hoạt động cho đạt
                // cả năm thì con số khai không vào mốc 8 giờ, hiện ra sẽ gây
                // hiểu nhầm là đang cộng dồn.
                rule?.mode === 'HOURS' ? `${creditedHoursOf(r, rule)} giờ` : '',
                r.outcome,
                r.referenceNo,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        )
      })}
    </div>
  )
}
