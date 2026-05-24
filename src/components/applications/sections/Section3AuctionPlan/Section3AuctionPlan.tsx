import { Card } from '@/components/ui/card'
import { AuctionPlan } from '@/types/application'
import { AuctionPlanSubsection } from './AuctionPlanSubsection'

interface Props {
  auctionPlan: AuctionPlan
  onChange: (data: Partial<AuctionPlan>) => void
  onCopyFromPrevious?: () => void
}

export function Section3AuctionPlan({ auctionPlan, onChange, onCopyFromPrevious }: Props) {
  return (
    <Card className="px-5 py-0 overflow-hidden">
      <AuctionPlanSubsection
        id="plan-format"
        title="III.1 — Hình thức, bước giá, số vòng"
        subtitle="Đề xuất hình thức đấu giá, bước giá tối thiểu và số vòng tổ chức"
        maxScore={8}
        value={auctionPlan.format}
        minChars={100}
        onChange={(v) => onChange({ format: v })}
        onCopyFromPrevious={onCopyFromPrevious}
      />

      <AuctionPlanSubsection
        id="plan-reception"
        title="III.2 — Bán, tiếp nhận hồ sơ tham gia"
        subtitle="Địa điểm, thời gian, phương thức phát hành và tiếp nhận hồ sơ"
        maxScore={2}
        value={auctionPlan.receptionPlan}
        minChars={50}
        onChange={(v) => onChange({ receptionPlan: v })}
        onCopyFromPrevious={onCopyFromPrevious}
      />

      <AuctionPlanSubsection
        id="plan-conditions"
        title="III.3 — Đối tượng, điều kiện tham gia"
        subtitle="Điều kiện về đối tượng được phép đăng ký tham gia đấu giá"
        maxScore={3}
        value={auctionPlan.participantConditions}
        minChars={50}
        onChange={(v) => onChange({ participantConditions: v })}
        onCopyFromPrevious={onCopyFromPrevious}
      />

      <AuctionPlanSubsection
        id="plan-anti-collusion"
        title="III.4 — Giải pháp giám sát, chống thông đồng"
        subtitle="Biện pháp phòng ngừa thông đồng, dìm giá và gian lận trong đấu giá"
        maxScore={3}
        value={auctionPlan.antiCollusionMeasures}
        minChars={100}
        onChange={(v) => onChange({ antiCollusionMeasures: v })}
        onCopyFromPrevious={onCopyFromPrevious}
      />
    </Card>
  )
}
