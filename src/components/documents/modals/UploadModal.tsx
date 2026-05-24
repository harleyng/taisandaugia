import { CheckCircle2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { UploadDropZone } from './UploadDropZone'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'
import type { Folder } from '@/types/document'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  docs: UseDocumentsReturn
  targetFolder: Folder | null
}

export function UploadModal({ open, onOpenChange, docs, targetFolder }: Props) {
  const { uploadSession, startUpload, clearUploadSession } = docs

  const allDone =
    uploadSession &&
    uploadSession.files.length > 0 &&
    uploadSession.files.every((f) => f.status === 'done' || f.status === 'error')

  const handleClose = () => {
    if (allDone) clearUploadSession()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            Tải file lên
            {targetFolder && (
              <span className="font-normal text-muted-foreground">
                {' '}→ {targetFolder.name}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {allDone ? (
            <UploadSuccess
              doneCount={uploadSession.files.filter((f) => f.status === 'done').length}
              errorCount={uploadSession.files.filter((f) => f.status === 'error').length}
              onClose={handleClose}
            />
          ) : (
            <UploadDropZone
              session={uploadSession}
              onFiles={(files) => startUpload(files, targetFolder?.id ?? null)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function UploadSuccess({
  doneCount,
  errorCount,
  onClose,
}: {
  doneCount: number
  errorCount: number
  onClose: () => void
}) {
  return (
    <div className="text-center space-y-4 py-8">
      <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
      <div>
        <p className="font-medium">Upload hoàn tất</p>
        <p className="text-sm text-muted-foreground mt-1">
          {doneCount} file thành công
          {errorCount > 0 && `, ${errorCount} file lỗi`}
        </p>
      </div>
      <Button onClick={onClose} className="w-full">
        Đóng
      </Button>
    </div>
  )
}
