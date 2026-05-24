import { Card } from '@/components/ui/card'
import { Shield, Camera, Globe, HardDrive } from 'lucide-react'
import type { InfrastructureScoreBreakdown } from '@/types/infrastructure'

interface Props {
  breakdown: InfrastructureScoreBreakdown
}

export function InfraScoreCards({ breakdown }: Props) {
  const csvc = breakdown.II_1_1 + breakdown.II_1_2
  const sections = [
    { label: 'CSVC đảm bảo', muc: 'Mục II.1', val: csvc, max: 3, Icon: Shield },
    { label: 'Trang bị', muc: 'Mục II.2', val: breakdown.II_2_1 + breakdown.II_2_2, max: 4, Icon: Camera },
    { label: 'Website', muc: 'Mục II.3-4', val: breakdown.II_3 + breakdown.II_4, max: 8, Icon: Globe },
    { label: 'Lưu trữ', muc: 'Mục II.5', val: breakdown.II_5, max: 4, Icon: HardDrive },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {sections.map((s) => {
        const isMax = s.val >= s.max
        return (
          <Card key={s.muc} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${isMax ? 'text-primary' : 'text-foreground'}`}>
                  {s.val}<span className="text-sm font-normal text-muted-foreground">/{s.max}đ</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.muc}</p>
              </div>
              <s.Icon className={`h-5 w-5 shrink-0 ${isMax ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
          </Card>
        )
      })}
    </div>
  )
}
