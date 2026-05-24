import { Card } from '@/components/ui/card'
import { Users, Award, Clock, TrendingUp } from 'lucide-react'
import type { AuctioneerScoreDetail } from '@/lib/auctioneers/scoring'
import type { AuctioneerWithComputed } from '@/types/auctioneer'

interface Props {
  auctioneers: AuctioneerWithComputed[]
  score: AuctioneerScoreDetail
}

export function AuctioneerStatsCards({ auctioneers, score }: Props) {
  const activeCount = auctioneers.filter((a) => a.isActive).length

  const cards = [
    {
      icon: Users,
      label: 'ĐGV đang hành nghề',
      value: activeCount,
      sub: `${score.scoreIV6}/4 điểm IV.6`,
      highlight: score.scoreIV6 === 4,
    },
    {
      icon: TrendingUp,
      label: 'Người ≥ 5 năm KN',
      value: score.peopleWithFiveYears,
      sub: `${score.scoreIV8}/5 điểm IV.8`,
      highlight: score.scoreIV8 === 5,
    },
    {
      icon: Award,
      label: 'ĐGV là giám đốc',
      value: score.directorYears !== null ? `${score.directorYears} năm KN` : '—',
      sub: `${score.scoreIV7}/4 điểm IV.7`,
      highlight: score.scoreIV7 === 4,
    },
    {
      icon: Clock,
      label: 'Tổng điểm IV.6–8',
      value: `${score.total}/13`,
      sub: 'Điểm năng lực ĐGV',
      highlight: score.total >= 11,
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
