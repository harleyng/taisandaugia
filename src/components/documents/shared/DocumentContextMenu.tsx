import {
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  Pencil,
  Star,
  StarOff,
  Tag,
  Trash2,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { DocumentListItem } from '@/types/document'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

interface Props {
  doc: DocumentListItem
  docs: UseDocumentsReturn
  onOpen: (id: string) => void
  onRename: (id: string, currentName: string) => void
  onMove: (id: string) => void
  onTag: (id: string) => void
  children: React.ReactNode
}

export function DocumentContextMenu({
  doc,
  docs,
  onOpen,
  onRename,
  onMove,
  onTag,
  children,
}: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onOpen(doc.id)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Mở / xem trước
        </ContextMenuItem>
        <ContextMenuItem onClick={() => docs.downloadDocument(doc.id)}>
          <Download className="h-4 w-4 mr-2" />
          Tải xuống
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onRename(doc.id, doc.displayName)}>
          <Pencil className="h-4 w-4 mr-2" />
          Đổi tên
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onMove(doc.id)}>
          <FolderInput className="h-4 w-4 mr-2" />
          Di chuyển
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onTag(doc.id)}>
          <Tag className="h-4 w-4 mr-2" />
          Sửa tags
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => docs.starDocument(doc.id, !doc.isStarred)}
        >
          {doc.isStarred ? (
            <>
              <StarOff className="h-4 w-4 mr-2" />
              Bỏ đánh dấu
            </>
          ) : (
            <>
              <Star className="h-4 w-4 mr-2" />
              Đánh dấu sao
            </>
          )}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => docs.softDeleteDocument(doc.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Xóa (thùng rác)
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
