import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Download,
  ExternalLink,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Star,
  Tag,
  Trash2,
} from 'lucide-react'
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

export function DocumentRow({
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
        className={`group flex items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer ${
          isSelected ? 'bg-primary/5' : ''
        }`}
        onClick={() => onOpen(doc.id)}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => docs.toggleSelect(doc.id)}
          />
        </div>

        <FileTypeIcon category={doc.mimeCategory} className="h-5 w-5" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{doc.displayName}</span>
            {doc.isStarred && (
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
            )}
          </div>
          {doc.tags.length > 0 && (
            <div className="flex gap-1 mt-0.5">
              {doc.tags.slice(0, 3).map((t) => (
                <TagBadge key={t} tag={t} />
              ))}
              {doc.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{doc.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <ExpiryBadge expiryDate={doc.expiryDate} />

        <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
          {formatBytes(doc.sizeBytes)}
        </span>

        <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
          {format(parseISO(doc.updatedAt), 'dd/MM/yyyy', { locale: vi })}
        </span>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100"
            onClick={() => docs.starDocument(doc.id, !doc.isStarred)}
          >
            <Star
              className={`h-3.5 w-3.5 ${doc.isStarred ? 'fill-amber-400 text-amber-400' : ''}`}
            />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(doc.id)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Mở / xem trước
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => docs.downloadDocument(doc.id)}>
                <Download className="h-4 w-4 mr-2" />
                Tải xuống
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRename(doc.id, doc.displayName)}>
                <Pencil className="h-4 w-4 mr-2" />
                Đổi tên
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(doc.id)}>
                <FolderInput className="h-4 w-4 mr-2" />
                Di chuyển
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTag(doc.id)}>
                <Tag className="h-4 w-4 mr-2" />
                Sửa tags
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {doc.deletedAt ? (
                <>
                  <DropdownMenuItem onClick={() => docs.restoreDocument(doc.id)}>
                    Khôi phục
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => docs.hardDeleteDocument(doc.id)}
                  >
                    Xóa vĩnh viễn
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => docs.softDeleteDocument(doc.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Xóa (thùng rác)
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </DocumentContextMenu>
  )
}
