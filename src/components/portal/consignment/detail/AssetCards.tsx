import { Box, Check, Hash, Scale, X } from 'lucide-react'
import { getDeltaFields } from '@/constants/asset-delta-fields'
import { renderDeltaValue } from '@/components/asset-posting/format'
import { cn } from '@/lib/utils'
import type { OrgServiceRequest } from '@/types/consignment'
import { CardAux, DetailCard, InfoList, InfoRow } from './DetailCard'

/** Dấu tròn xanh ✓ / đỏ ✕ cạnh câu trả lời pháp lý. */
function Legal({ good, label }: { good: boolean | null; label: string }) {
  if (good === null) return <span className="text-muted-foreground">—</span>
  const Icon = good ? Check : X
  return (
    <span className={cn('inline-flex items-center gap-2', !good && 'text-destructive')}>
      <i
        className={cn(
          'grid h-5 w-5 place-items-center rounded-full',
          good ? 'bg-success/[0.12] text-success' : 'bg-destructive/[0.12] text-destructive',
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={3} />
      </i>
      {label}
    </span>
  )
}

/** Câu hỏi "có vướng X không": Có là xấu, Không là tốt. */
const flag = (v: boolean | null) => <Legal good={v === null ? null : !v} label={v ? 'Có' : 'Không'} />

interface AssetCardsProps {
  request: OrgServiceRequest
  /** Đã có hợp đồng ⇒ giấy tờ sở hữu nằm trong thẻ hợp đồng, bỏ dòng gợi ý. */
  hasContract: boolean
}

/** Ba thẻ hồ sơ tài sản: Thông tin tài sản · Thông số · Pháp lý. */
export function AssetCards({ request: r, hasContract }: AssetCardsProps) {
  const images = r.image_urls ?? []
  const deltas = getDeltaFields(r.child_slug)

  return (
    <>
      <DetailCard icon={Box} title="Thông tin tài sản" aside={<CardAux>{images.length} ảnh</CardAux>}>
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 min-[900px]:grid-cols-4">
            {images.slice(0, 4).map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => window.open(url, '_blank', 'noopener')}
                className="aspect-[4/3] overflow-hidden rounded-lg bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
              >
                <img src={url} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-base font-semibold [text-wrap:pretty]">{r.title}</h3>
          {r.description && <p className="whitespace-pre-line text-sm [text-wrap:pretty]">{r.description}</p>}
        </div>
      </DetailCard>

      {deltas.length > 0 && (
        <DetailCard icon={Hash} title="Thông số">
          <InfoList>
            {deltas.map((d) => (
              <InfoRow key={d.key} label={d.label} value={renderDeltaValue(d, r.delta_fields?.[d.key])} />
            ))}
          </InfoList>
        </DetailCard>
      )}

      <DetailCard icon={Scale} title="Pháp lý">
        <InfoList>
          <InfoRow
            label="Quyền được bán"
            value={<Legal good={r.right_to_sell} label={r.right_to_sell ? 'Có' : 'Chưa xác nhận'} />}
          />
          <InfoRow label="Đang tranh chấp" value={flag(r.has_dispute)} />
          <InfoRow label="Đang thế chấp" value={flag(r.has_mortgage)} />
          <InfoRow label="Bị kê biên" value={flag(r.is_seized)} />
        </InfoList>
        {!hasContract && (
          <p className="text-xs text-muted-foreground">
            Giấy tờ sở hữu do chủ tài sản nộp đã được sàn thẩm định; bạn xem được sau khi chủ tài sản chọn tổ chức của
            bạn.
          </p>
        )}
      </DetailCard>
    </>
  )
}
