import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { ColumnMapping, ColumnKey } from '@/lib/auction-history/import-parser'

const FIELD_OPTIONS: Array<{ key: ColumnKey; label: string; required?: boolean; recommended?: boolean }> = [
  { key: 'auctionDate', label: 'Ngày đấu giá', required: true },
  { key: 'auctionNumber', label: 'Số phiên' },
  { key: 'assetDescription', label: 'Mô tả tài sản', required: true },
  { key: 'assetCategory', label: 'Loại tài sản' },
  { key: 'assetLocation', label: 'Địa chỉ tài sản' },
  { key: 'ownerName', label: 'Người có tài sản', required: true },
  { key: 'contractNumber', label: 'Số HĐ dịch vụ' },
  { key: 'startingPrice', label: 'Giá khởi điểm', required: true },
  { key: 'winningPrice', label: 'Giá trúng ★', recommended: true },
  { key: 'isSuccessful', label: 'Trạng thái ★', recommended: true },
  { key: 'failureReason', label: 'Lý do không thành' },
  { key: 'auctionFormat', label: 'Hình thức đấu giá ★', recommended: true },
  { key: 'bidStep', label: 'Bước giá ★', recommended: true },
  { key: 'maxRounds', label: 'Số vòng tối đa' },
  { key: 'actualRounds', label: 'Số vòng thực tế' },
  { key: 'numberOfParticipants', label: 'Số người tham gia' },
  { key: 'depositPercentage', label: 'Tiền đặt trước (%)' },
  { key: 'internalNotes', label: 'Ghi chú' },
]

interface Props {
  headers: string[]
  mapping: ColumnMapping
  onMappingChange: (mapping: ColumnMapping) => void
  onBack: () => void
  onNext: () => void
}

export function ColumnMappingStep({ headers, mapping, onMappingChange, onBack, onNext }: Props) {
  const setField = (key: ColumnKey, col: string) => {
    const next = { ...mapping }
    if (col === '__none__') {
      delete next[key]
    } else {
      next[key] = col
    }
    onMappingChange(next)
  }

  const requiredMapped = FIELD_OPTIONS.filter((f) => f.required).every((f) => mapping[f.key])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Chúng tôi đã tự động nhận diện cột. Kiểm tra và điều chỉnh nếu cần.
      </p>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {FIELD_OPTIONS.map(({ key, label, required, recommended }) => (
          <div key={key} className="grid grid-cols-2 gap-3 items-center">
            <span className="text-sm">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
              {recommended && !required && <span className="text-amber-500 ml-1 text-xs">(khuyến nghị)</span>}
            </span>
            <Select
              value={mapping[key] ?? '__none__'}
              onValueChange={(v) => setField(key, v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="— Không map —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Không map —</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />Quay lại
        </Button>
        <Button size="sm" onClick={onNext} disabled={!requiredMapped} className="gap-1.5">
          Xem trước <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
