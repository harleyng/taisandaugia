import { File } from 'lucide-react'
import { formatVnd } from '@/lib/advertising/slug'
import {
  AUCTION_FORMAT_LABELS, EXPECTED_TIMELINE_LABELS, type AuctionFormat, type ExpectedTimeline,
} from '@/types/asset-posting'
import type { OrgServiceRequest } from '@/types/consignment'
import { CardAux, DetailCard, InfoList, InfoRow, Note } from './DetailCard'

/** "Yêu cầu của chủ tài sản": lời nhắn + điều kiện chủ tài sản đặt ra. */
export function OwnerRequestCard({ request: r }: { request: OrgServiceRequest }) {
  return (
    <DetailCard
      icon={File}
      title="Yêu cầu của chủ tài sản"
      aside={<CardAux>{r.origin === 'platform' ? 'Sàn giới thiệu' : 'Gửi trực tiếp'}</CardAux>}
    >
      {r.message && <Note tone="primary">“{r.message}”</Note>}
      <InfoList>
        <InfoRow
          label="Giá khởi điểm"
          value={
            r.pricing_mode === 'appraisal'
              ? 'Nhờ tổ chức đề xuất'
              : r.starting_price != null
                ? formatVnd(r.starting_price)
                : '—'
          }
        />
        <InfoRow
          label="Hình thức mong muốn"
          value={AUCTION_FORMAT_LABELS[r.auction_format as AuctionFormat] ?? r.auction_format}
        />
        <InfoRow
          label="Thời gian kỳ vọng"
          value={
            r.expected_timeline
              ? (EXPECTED_TIMELINE_LABELS[r.expected_timeline as ExpectedTimeline] ?? r.expected_timeline)
              : null
          }
        />
        <InfoRow
          label="Thù lao chấp nhận"
          value={r.commission_pct != null ? `Tối đa ${r.commission_pct}% giá khởi điểm` : 'Chưa nêu'}
        />
      </InfoList>
    </DetailCard>
  )
}
