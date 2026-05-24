import { Download, FolderInput, Tag, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

interface Props {
  docs: UseDocumentsReturn
  onMove: () => void
  onTag: () => void
}

export function DocumentBulkBar({ docs, onMove, onTag }: Props) {
  const count = docs.selectedIds.size
  if (count === 0) return null

  const ids = Array.from(docs.selectedIds)

  return (
    <div className="sticky bottom-0 bg-primary text-primary-foreground px-4 py-2.5 flex items-center gap-3 shadow-lg rounded-t-lg mx-4">
      <span className="text-sm font-medium">Đã chọn {count} mục</span>

      <Button
        variant="secondary"
        size="sm"
        className="gap-2 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
        onClick={() => docs.bulkDownload(ids)}
      >
        <Download className="h-4 w-4" />
        Tải ZIP
      </Button>

      <Button
        variant="secondary"
        size="sm"
        className="gap-2 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
        onClick={onMove}
      >
        <FolderInput className="h-4 w-4" />
        Di chuyển
      </Button>

      <Button
        variant="secondary"
        size="sm"
        className="gap-2 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
        onClick={onTag}
      >
        <Tag className="h-4 w-4" />
        Tag
      </Button>

      <Button
        variant="secondary"
        size="sm"
        className="gap-2 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
        onClick={() => docs.bulkSoftDelete(ids)}
      >
        <Trash2 className="h-4 w-4" />
        Xóa
      </Button>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-primary-foreground hover:bg-white/20"
        onClick={docs.clearSelection}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
