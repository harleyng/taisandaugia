import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { UseFoldersReturn } from '@/hooks/useFolders'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'
import { FolderTree } from './FolderTree'
import { QuickFilters } from './QuickFilters'
import { StorageUsageBar } from './StorageUsageBar'
import { TagCloud } from './TagCloud'
import { differenceInDays, parseISO } from 'date-fns'

interface Props {
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  folders: UseFoldersReturn
  docs: UseDocumentsReturn
  onCreateFolder: (parentId: string | null) => void
  onRenameFolder: (id: string, currentName: string) => void
  onDeleteFolder: (id: string) => void
}

export function FolderSidebar({
  selectedFolderId,
  onSelectFolder,
  folders,
  docs,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const expiringCount = docs.allDocuments.filter((d) => {
    if (!d.expiryDate || d.deletedAt) return false
    const days = differenceInDays(parseISO(d.expiryDate), new Date())
    return days >= 0 && days <= 30
  }).length

  const allTags = docs.getAllTags()

  return (
    <div className="flex flex-col h-full border-r bg-background">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm tài liệu..."
            className="pl-8 h-8 text-sm"
            value={docs.filter.query}
            onChange={(e) => docs.setFilter({ query: e.target.value })}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          <div>
            <QuickFilters
              filter={docs.filter}
              setFilter={docs.setFilter}
              expiringCount={expiringCount}
            />
          </div>

          <Separator />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 px-2 uppercase tracking-wide">
              Folders
            </p>
            <FolderTree
              selectedFolderId={selectedFolderId}
              onSelect={onSelectFolder}
              folders={folders}
              onCreateChild={onCreateFolder}
              onRename={onRenameFolder}
              onDelete={onDeleteFolder}
            />
          </div>

          {allTags.length > 0 && (
            <>
              <Separator />
              <TagCloud tags={allTags} filter={docs.filter} setFilter={docs.setFilter} />
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <StorageUsageBar usedBytes={docs.usedBytes} />
      </div>
    </div>
  )
}
