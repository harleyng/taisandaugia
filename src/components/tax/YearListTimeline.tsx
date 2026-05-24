import { YearCard } from './YearCard'
import type { TaxRecord } from '@/types/tax'

interface Props {
  records: TaxRecord[]
  targetYear: number
  onEdit: (record: TaxRecord) => void
  onDelete: (id: string) => void
}

export function YearListTimeline({ records, targetYear, onEdit, onDelete }: Props) {
  const sorted = [...records].sort((a, b) => b.year - a.year)

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Lịch sử kê khai
      </p>
      {sorted.map((record) => (
        <YearCard
          key={record.id}
          record={record}
          isTargetYear={record.year === targetYear}
          onEdit={() => onEdit(record)}
          onDelete={() => onDelete(record.id)}
        />
      ))}
    </div>
  )
}
