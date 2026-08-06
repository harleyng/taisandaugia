import { Badge } from '@/components/ui/badge'
import { AlertTriangle, BadgeCheck, CheckCircle2, FileWarning, ShieldOff } from 'lucide-react'
import { CPD_STATUS_LABELS, type CpdEvaluation } from '@/lib/personnel/cpd'

/**
 * Trạng thái tuân thủ là KẾT LUẬN PHÁP LÝ. Thiếu minh chứng là NHẮC NGHIỆP VỤ —
 * cố ý tách thành badge phụ riêng để một lời nhắc không bị đọc nhầm thành một
 * phát hiện vi phạm.
 */
export function CpdStatusBadge({ ev }: { ev: CpdEvaluation }) {
  if (ev.status === 'MIEN') {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <ShieldOff className="h-3 w-3" />
        {CPD_STATUS_LABELS.MIEN}
      </Badge>
    )
  }
  if (ev.status === 'DAT') {
    return (
      <Badge className="gap-1 bg-success/10 text-success hover:bg-success/10 font-normal">
        {ev.reason === 'full_year_form'
          ? <BadgeCheck className="h-3 w-3" />
          : <CheckCircle2 className="h-3 w-3" />}
        {CPD_STATUS_LABELS.DAT}
      </Badge>
    )
  }
  if (ev.status === 'QUA_HAN') {
    return (
      <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive font-normal">
        <AlertTriangle className="h-3 w-3" />
        {CPD_STATUS_LABELS.QUA_HAN}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 border-warning/40 text-warning font-normal">
      <AlertTriangle className="h-3 w-3" />
      Thiếu {ev.required - ev.hours} giờ
    </Badge>
  )
}

/** Badge phụ — không phải kết luận tuân thủ. */
export function CpdProofBadge({ ev }: { ev: CpdEvaluation }) {
  if (!ev.missingProof) return null
  return (
    <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
      <FileWarning className="h-3 w-3" />
      Thiếu minh chứng
    </Badge>
  )
}
