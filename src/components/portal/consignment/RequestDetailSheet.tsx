import { useEffect, useState } from 'react'
import { Download, FileText, MapPin, Scale, Send, XCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ASSET_CATEGORIES } from '@/constants/category.constants'
import { getDeltaFields } from '@/constants/asset-delta-fields'
import { renderDeltaValue } from '@/components/asset-posting/format'
import { signQuoteDoc } from '@/hooks/useOrgServiceRequests'
import { QuoteDetails } from '@/components/consignment/QuoteDetails'
import { OrgContractSection } from './OrgContractSection'
import {
  AUCTION_FORMAT_LABELS, EXPECTED_TIMELINE_LABELS,
  type AuctionFormat, type ExpectedTimeline,
} from '@/types/asset-posting'
import {
  CLOSED_REQUEST_STATUSES, ORG_REQUEST_STATUS_LABELS, REQUEST_STATUS_BADGE_CLASS,
  type OrgServiceRequest,
} from '@/types/consignment'
import { formatVnd } from '@/lib/advertising/slug'

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.name]))
const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
)

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right font-medium">{value}</span>
    </div>
  )
}

interface RequestDetailSheetProps {
  request: OrgServiceRequest | null
  auctionOrgId: string | null
  onOpenChange: (open: boolean) => void
  onQuote: () => void
  onDecline: () => void
}

/**
 * Chi tiết một yêu cầu ký gửi theo góc nhìn tổ chức.
 *
 * Dữ liệu đến từ RPC `org_service_requests` — đã lược danh tính chủ tài sản, số
 * nhà và giấy tờ sở hữu. Đừng thêm cột ở đây mà không mở tương ứng trong RPC.
 * Sau khi được chốt, những thứ đó hiện trong OrgContractSection (RPC riêng).
 */
export function RequestDetailSheet({ request, auctionOrgId, onOpenChange, onQuote, onDecline }: RequestDetailSheetProps) {
  const [docUrl, setDocUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setDocUrl(null)
    if (request?.quote_doc_path) {
      signQuoteDoc(request.quote_doc_path).then((url) => {
        if (alive) setDocUrl(url)
      })
    }
    return () => {
      alive = false
    }
  }, [request?.quote_doc_path])

  if (!request) return null

  const r = request
  const deltas = getDeltaFields(r.child_slug)
  const location = [r.district, r.province].filter(Boolean).join(', ')
  const closed = CLOSED_REQUEST_STATUSES.includes(r.status)
  const legal = (v: boolean | null) => (v === null ? '—' : v ? 'Có' : 'Không')

  return (
    <Sheet open={!!request} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-lg leading-snug">{r.title}</SheetTitle>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${REQUEST_STATUS_BADGE_CLASS[r.status]}`}>
              {ORG_REQUEST_STATUS_LABELS[r.status]}
            </span>
          </div>
          <SheetDescription>
            {PARENT_NAME[r.parent_slug] ?? r.parent_slug} · {CHILD_LABEL[r.child_slug] ?? r.child_slug}
            {r.origin === 'platform' && ' · Sàn giới thiệu'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-5">
          {r.reopened_at && !closed && (
            <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-foreground">
              Yêu cầu đã mở lại: hợp đồng giữa chủ tài sản và tổ chức được chọn trước đó đã bị huỷ. Bạn có thể cập
              nhật báo giá.
            </p>
          )}

          {r.message && (
            <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
              “{r.message}”
            </p>
          )}

          {r.contract_id && (
            <div className="rounded-xl border border-border p-4">
              <OrgContractSection request={r} auctionOrgId={auctionOrgId} />
            </div>
          )}

          {r.image_urls && r.image_urls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {r.image_urls.slice(0, 6).map((url, i) => (
                <div key={url} className="aspect-square overflow-hidden rounded-lg bg-muted">
                  <img src={url} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold">Thông tin tài sản</h3>
            {location && (
              <Row
                label="Khu vực"
                value={
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {location}
                  </span>
                }
              />
            )}
            <Row
              label="Giá khởi điểm"
              value={
                r.pricing_mode === 'appraisal'
                  ? 'Nhờ tổ chức định giá'
                  : r.starting_price != null
                    ? formatVnd(r.starting_price)
                    : '—'
              }
            />
            <Row label="Hình thức" value={AUCTION_FORMAT_LABELS[r.auction_format as AuctionFormat] ?? r.auction_format} />
            {r.commission_pct != null && <Row label="Thù lao chấp nhận" value={`${r.commission_pct}%`} />}
            {r.expected_timeline && (
              <Row
                label="Thời gian kỳ vọng"
                value={EXPECTED_TIMELINE_LABELS[r.expected_timeline as ExpectedTimeline] ?? r.expected_timeline}
              />
            )}
            {r.description && <p className="whitespace-pre-line pt-1 text-sm text-foreground">{r.description}</p>}
          </div>

          {deltas.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold">Thông số</h3>
                <div className="grid grid-cols-1 gap-y-2">
                  {deltas.map((d) => (
                    <Row key={d.key} label={d.label} value={renderDeltaValue(d, r.delta_fields?.[d.key])} />
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Scale className="h-4 w-4 text-muted-foreground" /> Pháp lý
            </h3>
            <Row label="Quyền được bán" value={r.right_to_sell ? 'Có' : 'Chưa xác nhận'} />
            <Row label="Đang tranh chấp" value={legal(r.has_dispute)} />
            <Row label="Đang thế chấp" value={legal(r.has_mortgage)} />
            <Row label="Bị kê biên" value={legal(r.is_seized)} />
            {/* Giấy tờ sở hữu chỉ hiện trong phần hợp đồng, sau khi được chốt. */}
            {!r.contract_id && (
              <p className="pt-1 text-xs text-muted-foreground">
                Giấy tờ sở hữu do chủ tài sản nộp được sàn thẩm định; bạn xem được sau khi chủ tài sản chọn tổ chức
                của bạn.
              </p>
            )}
          </div>

          {r.quoted_at && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold">Báo giá bạn đã gửi</h3>
                {r.quote_commission_pct != null && <Row label="Thù lao" value={`${r.quote_commission_pct}%`} />}
                {r.quote_service_fee != null && <Row label="Phí dịch vụ" value={formatVnd(r.quote_service_fee)} />}
                {r.quote_starting_price != null && (
                  <Row label="Giá khởi điểm đề xuất" value={formatVnd(r.quote_starting_price)} />
                )}
                {r.quote_lead_time_days != null && <Row label="Thời gian dự kiến" value={`${r.quote_lead_time_days} ngày`} />}
                <QuoteDetails
                  plan={r.quote_plan}
                  feeItems={r.quote_fee_items}
                  startingPrice={r.starting_price}
                  className="pt-1"
                />
                {r.quote_note && (
                  <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">{r.quote_note}</p>
                )}
                {r.quote_doc_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={!docUrl}
                    onClick={() => docUrl && window.open(docUrl, '_blank', 'noopener')}
                  >
                    {docUrl ? <Download className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    {docUrl ? 'Tải tệp báo giá' : 'Đang tạo liên kết…'}
                  </Button>
                )}
              </div>
            </>
          )}

          {r.status === 'declined' && r.decline_reason && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              Lý do từ chối: {r.decline_reason}
            </p>
          )}
        </div>

        {!closed && r.status !== 'declined' && (
          <div className="sticky bottom-0 flex gap-3 border-t border-border bg-background py-4">
            <Button onClick={onQuote} className="flex-1 gap-2">
              <Send className="h-4 w-4" />
              {r.quoted_at ? 'Cập nhật báo giá' : 'Duyệt & báo giá'}
            </Button>
            <Button variant="outline" onClick={onDecline} className="gap-2">
              <XCircle className="h-4 w-4" />
              Từ chối
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
