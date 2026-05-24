import { Star, Pencil, Trash2, Paperclip } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AmountDisplay } from './AmountDisplay'
import type { TaxRecord } from '@/types/tax'
import { TAX_RECORD_TYPE_LABELS } from '@/types/tax'

interface Props {
  record: TaxRecord
  isTargetYear: boolean
  onEdit: () => void
  onDelete: () => void
}

export function YearCard({ record, isTargetYear, onEdit, onDelete }: Props) {
  const handleDelete = () => {
    if (window.confirm(`Xoá dữ liệu thuế năm ${record.year}?`)) {
      onDelete()
    }
  }

  const scoreColor =
    record.scoreContribution === 3
      ? 'bg-green-100 text-green-700'
      : record.scoreContribution > 0
      ? 'bg-amber-100 text-amber-700'
      : 'bg-muted text-muted-foreground'

  return (
    <Card
      className={`p-4 ${
        isTargetYear
          ? 'border-blue-400 ring-1 ring-blue-200'
          : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{record.year}</span>
            {isTargetYear && (
              <Badge className="gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                <Star className="h-3 w-3" />
                Năm tính điểm
              </Badge>
            )}
            {!record.isFinalized && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                Tạm tính
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {TAX_RECORD_TYPE_LABELS[record.recordType]}
          </p>
          <AmountDisplay amount={record.amount} />
          {record.supportingDocuments.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Paperclip className="h-3 w-3" />
              {record.supportingDocuments.length} tài liệu
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreColor}`}
          >
            {record.scoreContribution}/3đ
          </span>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onEdit}
              aria-label="Sửa"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={handleDelete}
              aria-label="Xoá"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
