import { useState } from 'react'
import { Folder } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UseFoldersReturn } from '@/hooks/useFolders'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  folders: UseFoldersReturn
  excludeIds?: string[]
  onSelect: (folderId: string | null) => void
}

function FolderOption({
  folderId,
  folders,
  selected,
  onSelect,
  depth,
  excludeIds,
}: {
  folderId: string
  folders: UseFoldersReturn
  selected: string | null
  onSelect: (id: string | null) => void
  depth: number
  excludeIds: string[]
}) {
  const folder = folders.folders.find((f) => f.id === folderId)
  const children = folders.getChildren(folderId)
  if (!folder || excludeIds.includes(folderId)) return null

  return (
    <div>
      <button
        onClick={() => onSelect(folderId)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
          selected === folderId
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-secondary',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <Folder className="h-4 w-4 shrink-0" />
        {folder.name}
      </button>
      {children.map((c) => (
        <FolderOption
          key={c.id}
          folderId={c.id}
          folders={folders}
          selected={selected}
          onSelect={onSelect}
          depth={depth + 1}
          excludeIds={excludeIds}
        />
      ))}
    </div>
  )
}

export function MoveFolderDialog({
  open,
  onOpenChange,
  title = 'Di chuyển đến...',
  folders,
  excludeIds = [],
  onSelect,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  const handleConfirm = () => {
    onSelect(selected)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto border rounded-lg p-1 space-y-0.5">
          <button
            onClick={() => setSelected(null)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
              selected === null
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-secondary',
            )}
          >
            <Folder className="h-4 w-4 shrink-0" />
            Tất cả (root)
          </button>
          {folders.rootFolders.map((f) => (
            <FolderOption
              key={f.id}
              folderId={f.id}
              folders={folders}
              selected={selected}
              onSelect={setSelected}
              depth={0}
              excludeIds={excludeIds}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleConfirm}>Di chuyển đến đây</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
