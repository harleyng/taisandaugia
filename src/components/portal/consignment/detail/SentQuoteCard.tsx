import { useEffect, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signQuoteDoc } from '@/hooks/useOrgServiceRequests'
import { planSummary } from '@/lib/quotePlan'
import { formatVnd } from '@/lib/advertising/slug'
import type { OrgServiceRequest } from '@/types/consignment'
import { CardAux, DetailCard, InfoList, InfoRow, Note } from './DetailCard'
import { FeesTable } from './FeesTable'
import { fmtDate } from './format'

/** "Báo giá bạn đã gửi" — chỉ khi chưa có hợp đồng (có rồi thì xem Chi phí đã chốt). */
export function SentQuoteCard({ request: r }: { request: OrgServiceRequest }) {
  const [docUrl, setDocUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setDocUrl(null)
    if (r.quote_doc_path) {
      signQuoteDoc(r.quote_doc_path).then((url) => {
        if (alive) setDocUrl(url)
      })
    }
    return () => {
      alive = false
    }
  }, [r.quote_doc_path])

  return (
    <DetailCard icon={FileText} title="Báo giá bạn đã gửi" aside={r.quoted_at && <CardAux>Gửi {fmtDate(r.quoted_at)}</CardAux>}>
      <InfoList>
        <InfoRow
          label="Thù lao"
          value={r.quote_commission_pct != null ? `${r.quote_commission_pct}% giá khởi điểm` : null}
        />
        <InfoRow
          label="Giá khởi điểm đề xuất"
          value={r.quote_starting_price != null ? formatVnd(r.quote_starting_price) : null}
        />
        <InfoRow
          label="Thời gian dự kiến"
          value={r.quote_lead_time_days != null ? `${r.quote_lead_time_days} ngày` : null}
        />
        <InfoRow label="Hiệu lực đến" value={r.quote_valid_until && fmtDate(r.quote_valid_until)} />
        {planSummary(r.quote_plan, r.starting_price).map((row) => (
          <InfoRow key={row.label} label={row.label} value={row.value} />
        ))}
      </InfoList>
      <FeesTable items={r.quote_fee_items} legacyServiceFee={r.quote_service_fee} />
      {r.quote_note && <Note>{r.quote_note}</Note>}
      {r.quote_doc_path && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!docUrl}
            onClick={() => docUrl && window.open(docUrl, '_blank', 'noopener')}
          >
            {docUrl ? <Download className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            Tải tệp báo giá
          </Button>
        </div>
      )}
    </DetailCard>
  )
}
