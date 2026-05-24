import { Checkbox } from '@/components/ui/checkbox'
import { DocumentRow } from './DocumentRow'
import { EmptyState } from './EmptyState'
import type { DocumentListItem } from '@/types/document'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

interface Props {
  docs: UseDocumentsReturn
  onOpen: (id: string) => void
  onRename: (id: string, currentName: string) => void
  onMove: (id: string) => void
  onTag: (id: string) => void
}

export function DocumentList({ docs, onOpen, onRename, onMove, onTag }: Props) {
  const { documents, allDocuments, filter } = docs

  if (documents.length === 0) {
    if (filter.showTrashed) return <EmptyState variant="empty-trash" />
    if (filter.query || filter.tags.length > 0) return <EmptyState variant="no-results" />
    if (allDocuments.length === 0) return <EmptyState variant="all-empty" />
    return <EmptyState variant="empty-folder" />
  }

  const allSelected =
    documents.length > 0 && documents.every((d) => docs.selectedIds.has(d.id))

  return (
    <div className="flex flex-col">
      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-secondary/30">
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => (allSelected ? docs.clearSelection() : docs.selectAll())}
        />
        <span className="w-5" /> {/* icon placeholder */}
        <span className="flex-1">Tên</span>
        <span className="w-24">Hết hạn</span>
        <span className="w-16 text-right">Kích thước</span>
        <span className="w-24 text-right">Cập nhật</span>
        <span className="w-16" />
      </div>

      {documents.map((doc) => (
        <DocumentRow
          key={doc.id}
          doc={doc}
          docs={docs}
          onOpen={onOpen}
          onRename={onRename}
          onMove={onMove}
          onTag={onTag}
        />
      ))}
    </div>
  )
}
