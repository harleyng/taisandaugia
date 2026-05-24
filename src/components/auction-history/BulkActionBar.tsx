import { Button } from '@/components/ui/button'
import { Trash2, Pencil, Download } from 'lucide-react'

interface Props {
  selectedCount: number
  onBulkFill: () => void
  onBulkDelete: () => void
  onExport: () => void
}

export function BulkActionBar({ selectedCount, onBulkFill, onBulkDelete, onExport }: Props) {
  if (selectedCount === 0) return null
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
      <span className="text-sm font-medium text-primary">Đã chọn {selectedCount} cuộc</span>
      <div className="flex gap-2 ml-auto">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onBulkFill}>
          <Pencil className="h-3.5 w-3.5" />Bổ sung giá trúng
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onExport}>
          <Download className="h-3.5 w-3.5" />Export
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={onBulkDelete}>
          <Trash2 className="h-3.5 w-3.5" />Xóa
        </Button>
      </div>
    </div>
  )
}
