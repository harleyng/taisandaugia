import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useFolders } from '@/hooks/useFolders'
import { useDocuments } from '@/hooks/useDocuments'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { migrateDocumentsFromLocal } from '@/lib/documents/migrate-from-local'
import { FolderSidebar } from './sidebar/FolderSidebar'
import { DocumentMainArea } from './main/DocumentMainArea'
import { OnboardingView } from './OnboardingView'
import { FolderFormDialog } from './modals/FolderFormDialog'

export function DocumentCabinetPage() {
  const folders = useFolders()
  const docs = useDocuments()
  const { organizationId } = usePortalOrg()

  // Di trú một lần dữ liệu cũ trong localStorage. Chạy nền, không chặn UI; hàm
  // tự đóng dấu đã xong nên lần sau không lặp lại.
  const migratedRef = useRef(false)
  useEffect(() => {
    if (!organizationId || migratedRef.current) return
    migratedRef.current = true
    migrateDocumentsFromLocal(organizationId).then((r) => {
      if (!r.ran) return
      folders.reload()
      docs.reload()
      toast.success(`Đã chuyển ${r.folders} thư mục và ${r.documents} tài liệu lên máy chủ`)
      if (r.documentsWithUnreachableFile > 0) {
        // Nói thẳng thay vì để user tự phát hiện lúc bấm tải về.
        toast.warning(
          `${r.documentsWithUnreachableFile} tài liệu chỉ còn thông tin, tệp gốc không còn trên máy chủ — vui lòng tải lên lại.`,
        )
      }
      if (r.errors.length > 0) toast.error(`Còn ${r.errors.length} mục chưa chuyển được`)
    })
  }, [organizationId, folders, docs])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  // Onboarding suy từ dữ liệu THẬT chứ không từ state khởi tạo một lần: lúc mount
  // truy vấn còn đang chạy nên chưa biết tổ chức có thư mục hay không.
  const [dismissedOnboarding, setDismissedOnboarding] = useState(false)
  const [renameFolder, setRenameFolder] = useState<{
    id: string
    name: string
  } | null>(null)
  const [createChildParentId, setCreateChildParentId] = useState<string | null | undefined>(undefined)

  const handleStart = async () => {
    await folders.seedDefaults()
    setDismissedOnboarding(true)
  }

  // Chỉ hiện khi ĐÃ tải xong và thật sự chưa có thư mục nào — nếu không, tổ chức
  // đã có tài liệu vẫn thấy màn onboarding nhấp nháy ở mỗi lần vào trang.
  if (!dismissedOnboarding && !folders.isLoading && folders.folders.length === 0) {
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
