import { useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { CheckCircle2, FileX, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FileTypeIcon } from '../shared/FileTypeIcon'
import type { MimeCategory, UploadFile, UploadSession } from '@/types/document'

const ACCEPTED_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'text/plain': ['.txt'],
}

function mimeToCategory(type: string): MimeCategory {
  if (type === 'application/pdf') return 'PDF'
  if (type.includes('wordprocessingml') || type === 'application/msword') return 'WORD'
  if (type.includes('spreadsheetml') || type === 'application/vnd.ms-excel') return 'EXCEL'
  if (type.startsWith('image/')) return 'IMAGE'
  return 'OTHER'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  session: UploadSession | null
  onFiles: (files: File[]) => void
}

export function UploadDropZone({ session, onFiles }: Props) {
  const folderInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFiles(accepted)
    },
    [onFiles],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME,
    maxSize: 52_428_800,
  })

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    e.target.value = ''
  }

  if (session && session.files.length > 0) {
    const total = session.files.length
    const done = session.files.filter((f) => f.status === 'done').length
    const overallPct = Math.round((done / total) * 100)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Đang tải lên {total} file...</span>
          <span className="text-muted-foreground">{done}/{total}</span>
        </div>
        <Progress value={overallPct} />

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {session.files.map((uf) => (
            <FileUploadRow key={uf.localId} uf={uf} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-secondary/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium text-sm">
          {isDragActive ? 'Thả file vào đây...' : 'Kéo & thả file vào đây'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          hoặc nhấn để chọn từ máy tính
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          PDF, Word, Excel, JPG, PNG — tối đa 50MB/file
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground">hoặc</span>
        <div className="flex-1 border-t" />
      </div>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => folderInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        Tải lên cả thư mục (giữ cấu trúc)
      </Button>
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        // @ts-expect-error webkitdirectory is not in the TS types
        webkitdirectory=""
        multiple
        onChange={handleFolderInput}
      />
    </div>
  )
}

function FileUploadRow({ uf }: { uf: UploadFile }) {
  const category = mimeToCategory(uf.file.type)

  return (
    <div className="flex items-center gap-3 text-sm">
      <FileTypeIcon category={category} className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs">{uf.file.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatBytes(uf.file.size)}
          </span>
        </div>
        {uf.status === 'uploading' && <Progress value={uf.progress} className="h-1 mt-1" />}
        {uf.status === 'error' && (
          <p className="text-xs text-destructive">{uf.error}</p>
        )}
      </div>
      {uf.status === 'done' && (
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
      )}
      {uf.status === 'uploading' && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      )}
      {uf.status === 'error' && (
        <FileX className="h-4 w-4 text-destructive shrink-0" />
      )}
    </div>
  )
}
