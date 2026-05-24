import { Card } from '@/components/ui/card'
import { Hash, CheckCircle2, TrendingUp, Zap } from 'lucide-react'
import type { AuctionHistoryScore } from '@/types/auction-record'

interface Props {
  score: AuctionHistoryScore
}

export function AuctionStatsCards({ score }: Props) {
  const cards = [
    {
      icon: Hash,
      label: 'Tổng số cuộc (IV.1)',
      value: score.iv1.count,
      sub: `${score.iv1.score}/${score.iv1.max} điểm — Mục IV.1`,
      highlight: score.iv1.score >= 4,
    },
    {
      icon: CheckCircle2,
      label: 'Cuộc thành công (IV.2)',
      value: score.iv2.count,
      sub: `${score.iv2.score}/${score.iv2.max} điểm — Mục IV.2`,
      highlight: score.iv2.score >= 4,
    },
    {
      icon: TrendingUp,
      label: 'Có chênh lệch giá (IV.3)',
      value: score.iv3.count,
      sub: `${score.iv3.score}/${score.iv3.max} điểm — Mục IV.3`,
      highlight: score.iv3.score >= 4,
    },
    {
      icon: Zap,
      label: 'Chênh lệch ≥10% (IV.4)',
      value: score.iv4.count,
      sub: `${score.iv4.score}/${score.iv4.max} điểm — Mục IV.4`,
      highlight: score.iv4.score >= 4,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground leading-tight">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.highlight ? 'text-primary' : 'text-foreground'}`}>
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
            </div>
            <card.icon className={`h-5 w-5 shrink-0 ${card.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
        </Card>
      ))}
    </div>
  )
}
