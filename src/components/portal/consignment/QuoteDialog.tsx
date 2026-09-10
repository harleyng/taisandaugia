import { useState } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { groupNumber, parseNumber, vnWords } from '@/components/asset-posting/format'
import { uploadQuoteDoc } from '@/hooks/useOrgServiceRequests'
import type { OrgServiceRequest, ServiceQuoteInput } from '@/types/consignment'

const MAX_DOC_BYTES = 10 * 1024 * 1024
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

interface QuoteDialogProps {
  request: OrgServiceRequest | null
  organizationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (quote: ServiceQuoteInput) => void
  isPending: boolean
}

/**
 * Báo giá tổ chức gửi lại chủ tài sản: thù lao · phí dịch vụ · giá khởi điểm đề
 * xuất · thời gian dự kiến · ghi chú · 1 tệp đính kèm.
 *
 * Gửi lại được nhiều lần: RPC ghi đè cho tới khi chủ tài sản chốt.
 */
export function QuoteDialog({
  request, organizationId, open, onOpenChange, onSubmit, isPending,
}: QuoteDialogProps) {
  const [commissionPct, setCommissionPct] = useState('')
  const [serviceFee, setServiceFee] = useState('')
  const [startingPrice, setStartingPrice] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Mỗi lần mở lại một yêu cầu khác thì nạp lại báo giá cũ (nếu đã từng gửi).
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (open && request && loadedFor !== request.id) {
    setLoadedFor(request.id)
    setCommissionPct(request.quote_commission_pct != null ? String(request.quote_commission_pct) : '')
    setServiceFee(request.quote_service_fee != null ? String(request.quote_service_fee) : '')
    setStartingPrice(request.quote_starting_price != null ? String(request.quote_starting_price) : '')
    setLeadTimeDays(request.quote_lead_time_days != null ? String(request.quote_lead_time_days) : '')
    setNote(request.quote_note ?? '')
    setFile(null)
  }

  const pickFile = (f: File | null) => {
    if (!f) return setFile(null)
    if (!DOC_TYPES.includes(f.type)) {
      toast.error('Chỉ nhận tệp PDF, JPG hoặc PNG.')
      return
    }
    if (f.size > MAX_DOC_BYTES) {
      toast.error('Tệp vượt quá 10MB.')
      return
    }
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!request) return
    const pct = commissionPct.trim() === '' ? null : Number(commissionPct)
    if (pct !== null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      toast.error('Thù lao phải trong khoảng 0–100%.')
      return
    }

    let docPath: string | undefined
    if (file && organizationId) {
      try {
        setUploading(true)
        docPath = await uploadQuoteDoc(organizationId, request.id, file)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không tải được tệp báo giá.')
        return
      } finally {
        setUploading(false)
      }
    }

    onSubmit({
      commission_pct: pct,
      service_fee: serviceFee ? Number(serviceFee) : null,
      starting_price: startingPrice ? Number(startingPrice) : null,
      lead_time_days: leadTimeDays ? Number(leadTimeDays) : null,
      note: note.trim() || undefined,
      doc_path: docPath ?? request.quote_doc_path ?? undefined,
    })
  }

  const busy = isPending || uploading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gửi báo giá</DialogTitle>
          <DialogDescription>
            {request?.title
              ? `Báo giá dịch vụ đấu giá cho "${request.title}".`
              : 'Báo giá dịch vụ đấu giá.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="q-commission">Thù lao (%)</Label>
              <Input
                id="q-commission"
                inputMode="decimal"
                placeholder="2"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value.replace(/[^\d.]/g, ''))}
              />
              {request?.commission_pct != null && (
                <p className="text-xs text-muted-foreground">
                  Chủ tài sản chấp nhận tới {request.commission_pct}%
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-fee">Phí dịch vụ (VNĐ)</Label>
              <Input
                id="q-fee"
                inputMode="numeric"
                placeholder="0"
                value={groupNumber(serviceFee)}
                onChange={(e) => setServiceFee(parseNumber(e.target.value))}
              />
              {serviceFee && <p className="text-xs text-muted-foreground">{vnWords(serviceFee)}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="q-price">Giá khởi điểm đề xuất (VNĐ)</Label>
              <Input
                id="q-price"
                inputMode="numeric"
                placeholder="0"
                value={groupNumber(startingPrice)}
                onChange={(e) => setStartingPrice(parseNumber(e.target.value))}
              />
              {/* Hồ sơ "nhờ định giá" không có giá — đây là chỗ tổ chức đề xuất. */}
              <p className="text-xs text-muted-foreground">
                {request?.pricing_mode === 'appraisal'
                  ? 'Chủ tài sản nhờ tổ chức định giá'
                  : startingPrice
                    ? vnWords(startingPrice)
                    : 'Để trống nếu giữ giá chủ tài sản đưa ra'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-lead">Thời gian dự kiến (ngày)</Label>
              <Input
                id="q-lead"
                inputMode="numeric"
                placeholder="30"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value.replace(/[^\d]/g, ''))}
              />
              <p className="text-xs text-muted-foreground">Kể từ khi ký hợp đồng tới khi mở phiên</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-note">Ghi chú</Label>
            <Textarea
              id="q-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Điều kiện kèm theo, phạm vi dịch vụ, cam kết…"
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-file">Tệp báo giá (PDF/JPG/PNG, ≤ 10MB)</Label>
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Bỏ tệp đính kèm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Input
                id="q-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            )}
            {!file && request?.quote_doc_path && (
              <p className="text-xs text-muted-foreground">Đang giữ tệp đã gửi lần trước.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'Đang tải tệp…' : request?.quote_doc_path || request?.quoted_at ? 'Cập nhật báo giá' : 'Gửi báo giá'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
