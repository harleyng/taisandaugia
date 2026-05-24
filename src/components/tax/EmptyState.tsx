import { Receipt, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  targetYear: number
  onAdd: () => void
}

export function EmptyState({ targetYear, onAdd }: Props) {
  return (
    <Card className="p-10 text-center space-y-4">
      <Receipt className="h-9 w-9 text-muted-foreground mx-auto" />
      <div className="space-y-1">
        <p className="text-sm font-semibold">Chưa có dữ liệu thuế</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Mục IV.9 chỉ cần 1 số tiền — gần như mọi công ty đều dễ đạt tối đa 3 điểm.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800 max-w-sm mx-auto text-left space-y-1">
        <p className="font-medium">Bạn cần chuẩn bị:</p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-700">
          <li>Số thuế TNDN năm {targetYear} (đã trừ VAT)</li>
          <li>File tờ khai quyết toán (tuỳ chọn)</li>
        </ul>
        <p className="text-amber-600 mt-1">⏱ Mất khoảng 1 phút</p>
      </div>
      <Button size="sm" onClick={onAdd} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Nhập dữ liệu năm {targetYear}
      </Button>
    </Card>
  )
}
