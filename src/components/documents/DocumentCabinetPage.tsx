import { useState } from 'react'
import { useFolders } from '@/hooks/useFolders'
import { useDocuments } from '@/hooks/useDocuments'
import { FolderSidebar } from './sidebar/FolderSidebar'
import { DocumentMainArea } from './main/DocumentMainArea'
import { OnboardingView } from './OnboardingView'
import { FolderFormDialog } from './modals/FolderFormDialog'
import { listFolders, seedDefaultFolders } from '@/lib/documents/storage'

export function DocumentCabinetPage() {
  const folders = useFolders()
  const docs = useDocuments()
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(
    () => listFolders().length === 0,
  )
  const [renameFolder, setRenameFolder] = useState<{
    id: string
    name: string
  } | null>(null)
  const [createChildParentId, setCreateChildParentId] = useState<string | null | undefined>(undefined)

  const handleStart = () => {
    seedDefaultFolders()
    folders.reload?.()
    setShowOnboarding(false)
  }

  if (showOnboarding && folders.folders.length === 0) {
    return <OnboardingView onStart={handleStart} />
  }

  return (
    <div className="flex h-full">
      {/* Sidebar — fixed 240px */}
      <div className="w-60 shrink-0 flex flex-col h-full">
        <FolderSidebar
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          folders={folders}
          docs={docs}
          onCreateFolder={(parentId) => setCreateChildParentId(parentId)}
          onRenameFolder={(id, name) => setRenameFolder({ id, name })}
          onDeleteFolder={(id) => {
            folders.deleteFolder(id)
            if (selectedFolderId === id) setSelectedFolderId(null)
          }}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <DocumentMainArea
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          folders={folders}
          docs={docs}
        />
      </div>

      {/* Rename folder dialog */}
      <FolderFormDialog
        open={!!renameFolder}
        onOpenChange={(open) => !open && setRenameFolder(null)}
        mode="rename"
        folderId={renameFolder?.id}
        currentName={renameFolder?.name ?? ''}
        folders={folders}
      />

      {/* Create child folder dialog */}
      <FolderFormDialog
        open={createChildParentId !== undefined}
        onOpenChange={(open) => !open && setCreateChildParentId(undefined)}
        mode="create"
        parentId={createChildParentId ?? null}
        folders={folders}
      />
    </div>
  )
}
