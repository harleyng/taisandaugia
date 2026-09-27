import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import { uploadQuoteDoc } from '@/hooks/useOrgServiceRequests'
import { emptyQuotePlan, feeTotalRequired, planLeadTimeDays, validateQuote } from '@/lib/quotePlan'
import { formatVnd } from '@/lib/advertising/slug'
import type { AuctionFormat } from '@/types/asset-posting'
import type { OrgServiceRequest, QuoteFeeItem, QuotePlan, ServiceQuoteInput } from '@/types/consignment'
import { QuotePlanSection } from './QuotePlanSection'
import { QuoteFeeSection } from './QuoteFeeSection'
import { QuoteNoteSection } from './QuoteNoteSection'

interface QuoteDialogProps {
  request: OrgServiceRequest | null
  organizationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (quote: ServiceQuoteInput) => void
  isPending: boolean
}

type TabKey = 'plan' | 'fee' | 'note'

/** Hiệu lực mặc định của một báo giá mới. */
const DEFAULT_VALID_DAYS = 30
const isoDay = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * Báo giá tổ chức gửi lại chủ tài sản: phương án tổ chức đấu giá · chi phí theo
 * khoản mục · ghi chú và tệp đính kèm.
 *
 * Gửi lại được nhiều lần: RPC ghi đè cho tới khi chủ tài sản chốt.
 *
 * Phí dịch vụ và số ngày tới khi mở phiên KHÔNG có ô nhập riêng — server suy ra
 * từ các khoản bắt buộc và mốc 'mo_phien'. Hai con số cạnh nhau sẽ lệch nhau
 * ngay lần sửa đầu tiên, mà quote_service_fee còn đi thẳng vào CRM.
 */
export function QuoteDialog({
  request, organizationId, open, onOpenChange, onSubmit, isPending,
}: QuoteDialogProps) {
  const [tab, setTab] = useState<TabKey>('plan')
  const [plan, setPlan] = useState<QuotePlan>(emptyQuotePlan())
  const [feeItems, setFeeItems] = useState<QuoteFeeItem[]>([])
  const [commissionPct, setCommissionPct] = useState('')
  const [startingPrice, setStartingPrice] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  // Bắt buộc: chủ tài sản so "Hiệu lực báo giá" giữa các tổ chức.
  const [validUntil, setValidUntil] = useState('')

  // Mỗi lần mở lại một yêu cầu khác thì nạp lại báo giá cũ (nếu đã từng gửi).
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (open && request && loadedFor !== request.id) {
    setLoadedFor(request.id)
    setTab('plan')
    setShowErrors(false)
    // Chưa có phương án thì mặc định theo hình thức chủ tài sản mong muốn.
    setPlan(request.quote_plan ?? emptyQuotePlan((request.auction_format as AuctionFormat) ?? null))
    setFeeItems(request.quote_fee_items ?? [])
    setCommissionPct(request.quote_commission_pct != null ? String(request.quote_commission_pct) : '')
    setStartingPrice(request.quote_starting_price != null ? String(request.quote_starting_price) : '')
    setNote(request.quote_note ?? '')
    setFile(null)
    setValidUntil(request.quote_valid_until ?? isoDay(addDays(new Date(), DEFAULT_VALID_DAYS)))
  }

  const pct = commissionPct.trim() === '' ? null : Number(commissionPct)
  const validation = validateQuote(plan, feeItems, Number.isNaN(pct as number) ? null : pct)
  const leadDays = planLeadTimeDays(plan)
  const today = isoDay(new Date())
  const validityError = !validUntil
    ? 'Nhập ngày hết hiệu lực của báo giá.'
    : validUntil < today
      ? 'Hiệu lực báo giá phải từ hôm nay trở đi.'
      : null

  const handleSubmit = async () => {
    if (!request) return
    if (!validation.ok || validityError) {
      setShowErrors(true)
      if (!validation.ok) setTab(validation.errors.plan.length > 0 ? 'plan' : 'fee')
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
      // service_fee / lead_time_days là giá trị dẫn xuất — gửi kèm để tương
      // thích, nhưng server tính lại từ fee_items và plan.milestones.
      service_fee: feeTotalRequired(feeItems),
      starting_price: startingPrice ? Number(startingPrice) : null,
      lead_time_days: leadDays,
      plan,
      fee_items: feeItems,
      note: note.trim() || undefined,
      doc_path: docPath ?? request.quote_doc_path ?? undefined,
      valid_until: validUntil,
    })
  }

  const busy = isPending || uploading
  const errorDot = (list: string[]) =>
    showErrors && list.length > 0 ? <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-destructive" /> : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gửi báo giá</DialogTitle>
          <DialogDescription>
            {request?.title
              ? `Phương án và chi phí dịch vụ đấu giá cho "${request.title}".`
              : 'Phương án và chi phí dịch vụ đấu giá.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="plan" className="gap-0">
              Phương án
              {errorDot(validation.errors.plan)}
            </TabsTrigger>
            <TabsTrigger value="fee" className="gap-0">
              Chi phí
              {errorDot(validation.errors.fee)}
            </TabsTrigger>
            <TabsTrigger value="note">Ghi chú</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            <TabsContent value="plan" className="mt-0">
              <QuotePlanSection
                plan={plan}
                onChange={(patch) => setPlan((p) => ({ ...p, ...patch }))}
                request={request}
              />
            </TabsContent>
            <TabsContent value="fee" className="mt-0">
              <QuoteFeeSection
                items={feeItems}
                onChange={setFeeItems}
                commissionPct={commissionPct}
                onCommissionChange={setCommissionPct}
                startingPrice={startingPrice}
                onStartingPriceChange={setStartingPrice}
                request={request}
              />
            </TabsContent>
            <TabsContent value="note" className="mt-0">
              <QuoteNoteSection
                note={note}
                onNoteChange={setNote}
                file={file}
                onFileChange={setFile}
                existingDocPath={request?.quote_doc_path ?? null}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-4">
          <Label htmlFor="quote-valid-until" className="text-sm">
            Hiệu lực báo giá đến <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quote-valid-until"
            type="date"
            value={validUntil}
            min={today}
            onChange={(e) => setValidUntil(e.target.value)}
            aria-invalid={showErrors && !!validityError}
            className="h-9 w-44"
          />
          <span className="text-xs text-muted-foreground">Chủ tài sản thấy ngày này khi so sánh báo giá.</span>
        </div>

        {showErrors && (!validation.ok || validityError) && (
          <ul className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {[...validation.errors.plan, ...validation.errors.fee, ...(validityError ? [validityError] : [])].map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        {/* Tổng kết dính: ba con số chủ tài sản sẽ đem đi so sánh. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Thù lao <b className="font-semibold text-foreground">{commissionPct ? `${commissionPct}%` : '—'}</b>
            {' · '}
            Tổng phí <b className="font-semibold text-foreground">{formatVnd(feeTotalRequired(feeItems))}</b>
            {' · '}
            Mở phiên sau <b className="font-semibold text-foreground">{leadDays != null ? `${leadDays} ngày` : '—'}</b>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Huỷ
            </Button>
            <Button onClick={handleSubmit} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Đang tải tệp…' : request?.quoted_at ? 'Cập nhật báo giá' : 'Gửi báo giá'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
