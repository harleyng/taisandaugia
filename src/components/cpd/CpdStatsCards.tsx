import { Card } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, ShieldOff, Users } from 'lucide-react'
import type { CpdSummary } from '@/lib/personnel/cpd'

interface Props {
  summary: CpdSummary
  year: number
}

export function CpdStatsCards({ summary, year }: Props) {
  const cards = [
    { label: 'Thuộc diện áp dụng', value: summary.total, icon: Users, tone: 'text-muted-foreground' },
    { label: 'Đã hoàn thành', value: summary.met, icon: CheckCircle2, tone: 'text-success' },
    {
      label: 'Chưa hoàn thành',
      value: summary.short + summary.overdue,
      icon: AlertTriangle,
      tone: summary.overdue > 0 ? 'text-destructive' : 'text-warning',
    },
    { label: 'Được miễn', value: summary.exempt, icon: ShieldOff, tone: 'text-muted-foreground' },
  ]

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.tone}`} />
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
            <p className="text-2xl font-semibold mt-1.5">{c.value}</p>
          </Card>
        ))}
      </div>

      {/* Cờ phụ nằm ngoài 4 thẻ kết luận: nhắc nghiệp vụ, không phải vi phạm. */}
      {summary.missingProof > 0 && (
        <p className="text-xs text-muted-foreground">
          Năm {year}: {summary.missingProof} hồ sơ thiếu giấy tờ xác nhận (Điều 27.1).
          Cần bổ sung trước khi nộp Sở Tư pháp.
        </p>
      )}
    </div>
  )
}
