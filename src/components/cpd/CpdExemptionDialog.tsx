import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { CpdExemption } from '@/types/personnel'
import { useCpdCatalog } from '@/hooks/useCpdCatalog'
import { selectableReasons } from '@/lib/personnel/cpd-catalog'
import { PersonnelFileUpload } from '@/components/personnel/PersonnelFileUpload'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  personName: string
  existing?: CpdExemption
  /** Cần cả hai để bật ô đính kèm giấy tờ chứng minh diện miễn. */
  organizationId?: string
  auctioneerId?: string
  onSave: (v: {
    reasonId: string; note?: string; filedAt?: string; attachments: string[]
  }) => void
}

/**
 * Miễn nghĩa vụ bồi dưỡng theo Điều 26.3 TT 19/2024/TT-BTP. Danh sách trường hợp
 * miễn là MASTER DATA admin quản lý (cpd_exemption_reasons) chứ không còn là ba
 * hằng số trong code — Sở Tư pháp bổ sung diện miễn thì admin thêm được ngay.
 *
 * Giấy tờ chứng minh phải nộp Sở Tư pháp chậm nhất 15/12 hằng năm — ô "Ngày đã
 * nộp" tồn tại để tổ chức tự đối chiếu mốc đó, hệ thống không nộp thay.
 */
export function CpdExemptionDialog({
  open, onOpenChange, year, personName, existing, organizationId, auctioneerId, onSave,
}: Props) {
  const { catalog, isLoading } = useCpdCatalog()
  const reasons = selectableReasons(catalog)

  const [reasonId, setReasonId] = useState(existing?.reasonId ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [filedAt, setFiledAt] = useState(existing?.filedAt ?? '')
  const [attachments, setAttachments] = useState<string[]>(existing?.attachments ?? [])

  useEffect(() => {
    if (open) {
      setReasonId(existing?.reasonId ?? reasons[0]?.id ?? '')
      setNote(existing?.note ?? '')
      setFiledAt(existing?.filedAt ?? '')
      setAttachments(existing?.attachments ?? [])
    }
  }, [open, existing?.id, reasons.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tra trong TOÀN danh mục: bản ghi cũ có thể trỏ tới diện miễn đã bị tắt.
  const selected = catalog.exemptionReasons.find((r) => r.id === reasonId)

  // Miễn nghĩa vụ là kết luận có hệ quả pháp lý — nếu danh mục nói phải có minh
  // chứng thì không cho lưu chay. Chỉ chặn khi ô tải lên thực sự hiện ra, không
  // thì người dùng gặp nút Lưu chết mà không có cách nào chữa.
  const uploadAvailable = !!organizationId && !!auctioneerId
  const evidenceMissing = !!selected?.requiresEvidence
    && uploadAvailable
    && attachments.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {existing ? 'Sửa' : 'Đăng ký'} diện miễn bồi dưỡng — {personName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Áp dụng cho năm {year} theo Điều 26.3 Thông tư 19/2024/TT-BTP. Giấy tờ
            chứng minh phải nộp Sở Tư pháp chậm nhất ngày 15/12/{year}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Trường hợp được miễn</label>
            <Select value={reasonId} onValueChange={setReasonId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Đang tải danh mục…' : 'Chọn trường hợp'} />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.legalBasis && (
              <p className="text-xs text-muted-foreground">Căn cứ: {selected.legalBasis}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Ngày đã nộp giấy tờ cho Sở Tư pháp</label>
            <Input type="date" value={filedAt} onChange={(e) => setFiledAt(e.target.value)} />
          </div>

          {uploadAvailable && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Giấy tờ chứng minh
                {selected?.requiresEvidence && <span className="text-destructive"> *</span>}
              </label>
              {selected?.description && (
                <p className="text-xs text-muted-foreground">{selected.description}</p>
              )}
              <PersonnelFileUpload
                organizationId={organizationId!}
                auctioneerId={auctioneerId!}
                value={attachments}
                onChange={setAttachments}
              />
              {evidenceMissing && (
                <p className="text-xs text-destructive">
                  Trường hợp này bắt buộc có minh chứng mới ghi nhận được diện miễn.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Ghi chú</label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            size="sm"
            disabled={!reasonId || evidenceMissing}
            onClick={() => {
              onSave({
                reasonId,
                note: note || undefined,
                filedAt: filedAt || undefined,
                attachments,
              })
              onOpenChange(false)
            }}
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
