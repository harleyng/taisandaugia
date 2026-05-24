import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { MoreHorizontal, Star } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileTypeIcon } from '../shared/FileTypeIcon'
import { ExpiryBadge } from '../shared/ExpiryBadge'
import { TagBadge } from '../shared/TagBadge'
import { DocumentContextMenu } from '../shared/DocumentContextMenu'
import type { DocumentListItem } from '@/types/document'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  doc: DocumentListItem
  docs: UseDocumentsReturn
  onOpen: (id: string) => void
  onRename: (id: string, currentName: string) => void
  onMove: (id: string) => void
  onTag: (id: string) => void
}

export function DocumentCard({
  doc,
  docs,
  onOpen,
  onRename,
  onMove,
  onTag,
}: Props) {
  const isSelected = docs.selectedIds.has(doc.id)

  return (
    <DocumentContextMenu
      doc={doc}
      docs={docs}
      onOpen={onOpen}
      onRename={onRename}
      onMove={onMove}
      onTag={onTag}
    >
      <div
        className={`group relative flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm hover:border-primary/30 ${
          isSelected ? 'bg-primary/5 border-primary/40' : 'bg-card hover:bg-secondary/30'
        }`}
        onClick={() => onOpen(doc.id)}
      >
        {/* Selection checkbox */}
        <div
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => docs.toggleSelect(doc.id)}
          />
        </div>

        {/* Star + menu */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => docs.starDocument(doc.id, !doc.isStarred)}
          >
            <Star
              className={`h-3 w-3 ${doc.isStarred ? 'fill-amber-400 text-amber-400' : ''}`}
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(doc.id)}>
                Mở / xem trước
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => docs.downloadDocument(doc.id)}>
                Tải xuống
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRename(doc.id, doc.displayName)}>
                Đổi tên
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(doc.id)}>
                Di chuyển
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => docs.softDeleteDocument(doc.id)}
              >
                Xóa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Icon */}
        <div className="flex justify-center py-3">
          <FileTypeIcon category={doc.mimeCategory} className="h-10 w-10" />
        </div>

        {/* Name */}
        <p className="text-sm font-medium text-center truncate leading-snug">
          {doc.displayName}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatBytes(doc.sizeBytes)}</span>
          <span>
            {format(parseISO(doc.updatedAt), 'dd/MM', { locale: vi })}
          </span>
        </div>

        {/* Tags */}
        {doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {doc.tags.slice(0, 2).map((t) => (
              <TagBadge key={t} tag={t} />
            ))}
          </div>
        )}

        {/* Expiry */}
        <ExpiryBadge expiryDate={doc.expiryDate} />
      </div>
    </DocumentContextMenu>
  )
}
