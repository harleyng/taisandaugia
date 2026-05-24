import { DocumentCard } from './DocumentCard'
import { EmptyState } from './EmptyState'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

interface Props {
  docs: UseDocumentsReturn
  onOpen: (id: string) => void
  onRename: (id: string, currentName: string) => void
  onMove: (id: string) => void
  onTag: (id: string) => void
}

export function DocumentGrid({ docs, onOpen, onRename, onMove, onTag }: Props) {
  const { documents, allDocuments, filter } = docs

  if (documents.length === 0) {
    if (filter.showTrashed) return <EmptyState variant="empty-trash" />
    if (filter.query || filter.tags.length > 0) return <EmptyState variant="no-results" />
    if (allDocuments.length === 0) return <EmptyState variant="all-empty" />
    return <EmptyState variant="empty-folder" />
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
      {documents.map((doc) => (
        <DocumentCard
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
