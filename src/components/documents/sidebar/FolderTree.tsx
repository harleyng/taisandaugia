import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { FolderTreeNode } from './FolderTreeNode'
import type { UseFoldersReturn } from '@/hooks/useFolders'

interface Props {
  selectedFolderId: string | null
  onSelect: (id: string | null) => void
  folders: UseFoldersReturn
  onCreateChild: (parentId: string) => void
  onRename: (id: string, currentName: string) => void
  onDelete: (id: string) => void
}

export function FolderTree({
  selectedFolderId,
  onSelect,
  folders,
  onCreateChild,
  onRename,
  onDelete,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const activeFolder = folders.folders.find((f) => f.id === activeId)
    const overFolder = folders.folders.find((f) => f.id === overId)

    if (!activeFolder || !overFolder) return

    // If same parent → reorder
    if (activeFolder.parentId === overFolder.parentId) {
      const siblings = folders
        .getChildren(activeFolder.parentId ?? '')
        .filter((f) => !f.deletedAt)

      const rootSiblings = activeFolder.parentId === null
        ? folders.rootFolders
        : siblings

      const orderedIds = rootSiblings.map((f) => f.id)
      const activeIdx = orderedIds.indexOf(activeId)
      const overIdx = orderedIds.indexOf(overId)
      if (activeIdx !== -1 && overIdx !== -1) {
        orderedIds.splice(activeIdx, 1)
        orderedIds.splice(overIdx, 0, activeId)
        folders.reorderFolders(activeFolder.parentId, orderedIds)
      }
    } else {
      // Different parent → move into over folder's parent
      folders.moveFolder(activeId, overFolder.parentId)
    }
  }

  const rootIds = folders.rootFolders.map((f) => f.id)

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-0.5">
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-2 py-1 text-sm rounded-md transition-colors ${
            selectedFolderId === null
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          Tất cả tài liệu
        </button>

        <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
          {folders.rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              folderId={folder.id}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              depth={0}
              folders={folders}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </div>
    </DndContext>
  )
}
