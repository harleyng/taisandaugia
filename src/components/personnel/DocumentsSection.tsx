import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import type { PersonnelDocument } from '@/types/personnel'
import { DOC_TYPE_LABELS } from '@/types/personnel'
import { computeDaysUntilExpiry } from '@/types/auctioneer'
import { PersonnelDocDialog } from './PersonnelDocDialog'

interface Props {
  organizationId: string
  auctioneerId: string
  documents: PersonnelDocument[]
  onSave: (doc: Partial<PersonnelDocument>) => void
  onDelete: (id: string) => void
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

function ExpiryBadge({ expiryDate }: { expiryDate?: string }) {
  const days = computeDaysUntilExpiry(expiryDate)
  if (days === undefined) return null
  if (days < 0) return <Badge variant="destructive" className="text-xs">Đã hết hạn</Badge>
  if (days < 60) {
    return (
      <Badge className="bg-warning text-warning-foreground text-xs gap-1">
        <AlertTriangle className="h-3 w-3" />
        Còn {days} ngày
      </Badge>
    )
  }
  return null
}

export function DocumentsSection({
  organizationId, auctioneerId, documents, onSave, onDelete,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PersonnelDocument | undefined>()

  const openAdd = () => { setEditing(undefined); setDialogOpen(true) }
  const openEdit = (d: PersonnelDocument) => { setEditing(d); setDialogOpen(true) }

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Giấy tờ hành nghề</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Thẻ ĐGV, chứng chỉ hành nghề, bằng cấp, lý lịch tư pháp… Lưu ở khu vực riêng tư.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Thêm giấy tờ
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center">
          <FileText className="h-7 w-7 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Chưa có giấy tờ nào.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{DOC_TYPE_LABELS[d.docType]}</span>
                  {d.docNumber && <span className="text-xs text-muted-foreground">· {d.docNumber}</span>}
                  <ExpiryBadge expiryDate={d.expiryDate} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {d.title ? `${d.title} · ` : ''}
                  Cấp {fmtDate(d.issuedDate)}
                  {d.expiryDate ? ` · Hết hạn ${fmtDate(d.expiryDate)}` : ''}
                  {` · ${d.filePaths.length} tệp`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(d.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <PersonnelDocDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organizationId={organizationId}
        auctioneerId={auctioneerId}
        existing={editing}
        onSave={onSave}
      />
    </Card>
  )
}
