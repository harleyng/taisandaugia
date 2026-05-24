import { useCallback, useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderBreadcrumb } from './FolderBreadcrumb'
import { DocumentToolbar } from './DocumentToolbar'
import { DocumentList } from './DocumentList'
import { DocumentGrid } from './DocumentGrid'
import { DocumentBulkBar } from './DocumentBulkBar'
import { UploadModal } from '../modals/UploadModal'
import { DocumentDetailSheet } from '../modals/DocumentDetailSheet'
import { MoveFolderDialog } from '../modals/MoveFolderDialog'
import { BulkTagDialog } from '../modals/BulkTagDialog'
import { FolderFormDialog } from '../modals/FolderFormDialog'
import type { UseFoldersReturn } from '@/hooks/useFolders'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

function RenameDocumentDialog({
  open,
  onOpenChange,
  currentName,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onSave: (name: string) => void
}) {
  const [value, setValue] = useState(currentName)
  useEffect(() => { if (open) setValue(currentName) }, [open, currentName])
  const handleSave = () => { if (value.trim()) { onSave(value.trim()); onOpenChange(false) } }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Đổi tên tài liệu</DialogTitle></DialogHeader>
        <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Props {
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  folders: UseFoldersReturn
  docs: UseDocumentsReturn
}

export function DocumentMainArea({
  selectedFolderId,
  onSelectFolder,
  folders,
  docs,
}: Props) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [detailDocId, setDetailDocId] = useState<string | null>(null)
  const [moveDocId, setMoveDocId] = useState<string | null>(null)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const [renameState, setRenameState] = useState<{ id: string; name: string } | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)

  const currentFolder = selectedFolderId
    ? folders.folders.find((f) => f.id === selectedFolderId) ?? null
    : null
  const folderPath = selectedFolderId ? folders.getFolderPath(selectedFolderId) : []

  const handleRename = useCallback((id: string, currentName: string) => {
    setRenameState({ id, name: currentName })
  }, [])

  const handleMove = useCallback((id: string) => {
    setMoveDocId(id)
  }, [])

  const handleTag = useCallback((id: string) => {
    docs.toggleSelect(id)
    setBulkTagOpen(true)
  }, [docs])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b space-y-3">
        <FolderBreadcrumb path={folderPath} onNavigate={onSelectFolder} />
        <DocumentToolbar
          docs={docs}
          onUpload={() => setUploadOpen(true)}
          onNewFolder={() => setNewFolderOpen(true)}
        />
      </div>

      {/* File list */}
      <ScrollArea className="flex-1">
        {docs.viewMode === 'list' ? (
          <DocumentList
            docs={docs}
            onOpen={setDetailDocId}
            onRename={handleRename}
            onMove={handleMove}
            onTag={handleTag}
          />
        ) : (
          <DocumentGrid
            docs={docs}
            onOpen={setDetailDocId}
            onRename={handleRename}
            onMove={handleMove}
            onTag={handleTag}
          />
        )}
      </ScrollArea>

      {/* Bulk action bar */}
      <DocumentBulkBar
        docs={docs}
        onMove={() => setBulkMoveOpen(true)}
        onTag={() => setBulkTagOpen(true)}
      />

      {/* Upload modal */}
      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        docs={docs}
        targetFolder={currentFolder}
      />

      {/* Document detail sheet */}
      <DocumentDetailSheet
        docId={detailDocId}
        open={!!detailDocId}
        onOpenChange={(open) => !open && setDetailDocId(null)}
        docs={docs}
      />

      {/* Move single document */}
      <MoveFolderDialog
        open={!!moveDocId}
        onOpenChange={(open) => !open && setMoveDocId(null)}
        title="Di chuyển tài liệu đến..."
        folders={folders}
        onSelect={(folderId) => {
          if (moveDocId) docs.moveDocument(moveDocId, folderId)
        }}
      />

      {/* Bulk move */}
      <MoveFolderDialog
        open={bulkMoveOpen}
        onOpenChange={setBulkMoveOpen}
        title={`Di chuyển ${docs.selectedIds.size} tài liệu đến...`}
        folders={folders}
        onSelect={(folderId) => docs.bulkMove(Array.from(docs.selectedIds), folderId)}
      />

      {/* Bulk tag */}
      <BulkTagDialog
        open={bulkTagOpen}
        onOpenChange={setBulkTagOpen}
        selectedCount={docs.selectedIds.size}
        onApply={(tags) => docs.bulkTag(Array.from(docs.selectedIds), tags)}
      />

      {/* Rename document dialog */}
      {renameState && (
        <RenameDocumentDialog
          open={!!renameState}
          onOpenChange={(open) => !open && setRenameState(null)}
          currentName={renameState.name}
          onSave={(name) => {
            if (renameState) docs.renameDocument(renameState.id, name)
          }}
        />
      )}

      {/* New folder dialog */}
      <FolderFormDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        mode="create"
        parentId={selectedFolderId}
        folders={folders}
      />
    </div>
  )
}
