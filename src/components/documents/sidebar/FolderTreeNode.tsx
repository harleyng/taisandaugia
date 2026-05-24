import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { UseFoldersReturn } from '@/hooks/useFolders'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  folderId: string
  selectedFolderId: string | null
  onSelect: (id: string) => void
  depth: number
  folders: UseFoldersReturn
  onCreateChild: (parentId: string) => void
  onRename: (id: string, currentName: string) => void
  onDelete: (id: string) => void
}

export function FolderTreeNode({
  folderId,
  selectedFolderId,
  onSelect,
  depth,
  folders,
  onCreateChild,
  onRename,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(depth === 0)
  const folder = folders.folders.find((f) => f.id === folderId)
  const children = folders.getChildren(folderId)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folderId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (!folder) return null

  const isActive = selectedFolderId === folderId
  const hasChildren = children.length > 0

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-sm select-none',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(folderId)}
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50 hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className="shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground"
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
        </button>

        {isActive && expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}

        <span className="flex-1 truncate">{folder.name}</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background/50 rounded"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onCreateChild(folderId)}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo folder con
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(folderId, folder.name)}>
              <Pencil className="h-4 w-4 mr-2" />
              Đổi tên
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(folderId)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folderId={child.id}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              depth={depth + 1}
              folders={folders}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
