import { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { saveDocument, listFolders, seedDefaultFolders } from '@/lib/documents/storage'

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const MAX_SIZE = 10 * 1024 * 1024
const BUCKET = 'org-documents'

interface Props {
  value: string
  onChange: (storagePath: string) => void
  fieldId: string
  label: string
}

function getLegalFolderId(): string | null {
  seedDefaultFolders()
  return listFolders().find((f) => f.name === 'Pháp lý công ty')?.id ?? null
}

function fileNameFromPath(path: string): string {
  return path.split('/').pop() ?? path
}

export function DocFileUpload({ value, onChange, fieldId, label }: Props) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: vượt quá 10MB`)
        return
      }
      try {
        const docId = crypto.randomUUID()
        const ext = file.name.split('.').pop() ?? 'pdf'
        const storagePath = `legal-docs/${fieldId}/${docId}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { upsert: true })

        if (uploadError) throw new Error(uploadError.message)

        const mimeCategory = file.type === 'application/pdf' ? 'PDF' : 'IMAGE'
        const now = new Date().toISOString()

        saveDocument({
          id: docId,
          folderId: getLegalFolderId(),
          displayName: label,
          tags: ['Pháp lý công ty'],
          linkedEntities: [{ type: 'LEGAL_DOC', id: fieldId, label }],
          isStarred: false,
          versions: [{ version: 1, storagePath, sizeBytes: file.size, uploadedAt: now }],
          currentVersion: 1,
          mimeCategory,
          originalFilename: file.name,
          sizeBytes: file.size,
          storagePath,
          createdAt: now,
          updatedAt: now,
        })

        onChange(storagePath)
        toast.success(`Đã tải lên ${file.name}`)
      } catch (err) {
        toast.error(`Lỗi tải lên: ${err instanceof Error ? err.message : 'Không xác định'}`)
      }
    },
    [fieldId, label, onChange],
  )

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return
      setUploading(true)
      await processFile(accepted[0])
      setUploading(false)
    },
    [processFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    disabled: uploading,
    noClick: true,
  })

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{fileNameFromPath(value)}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onChange('')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
        isDragActive ? 'border-primary bg-primary/5' : 'border-border'
      } ${uploading ? 'opacity-60' : ''}`}
    >
      <input {...getInputProps()} ref={inputRef} />

      {uploading ? (
        <div className="flex items-center justify-center gap-2 py-1">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Đang tải lên...</p>
        </div>
      ) : isDragActive ? (
        <div className="flex flex-col items-center gap-1 py-1">
          <Upload className="h-5 w-5 text-primary" />
          <p className="text-xs font-medium text-primary">Thả file vào đây...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">Kéo & thả vào đây, hoặc</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
            Tải lên từ thiết bị
          </Button>
          <p className="text-[11px] text-muted-foreground">PDF, JPG, PNG — tối đa 10MB</p>
        </div>
      )}
    </div>
  )
}
