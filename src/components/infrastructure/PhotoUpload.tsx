import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'
import { ImagePlus, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { saveDocument, listFolders, seedDefaultFolders } from '@/lib/documents/storage'
import type { PhotoAttachment } from '@/types/infrastructure'

const ACCEPTED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const BUCKET = 'org-documents'

interface Props {
  photos: PhotoAttachment[]
  sectionId: string
  sectionLabel: string
  label?: string
  hint?: string
  onAdd: (photo: PhotoAttachment) => void
}

async function getInfraFolderId(): Promise<string | null> {
  seedDefaultFolders()
  const folders = listFolders()
  return folders.find((f) => f.name === 'Cơ sở vật chất')?.id ?? null
}

export function PhotoUpload({ photos, sectionId, sectionLabel, label, hint, onAdd }: Props) {
  const [uploading, setUploading] = useState(false)

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: vượt quá 10MB`)
        return
      }

      try {
        // Compress
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        })

        // Get image dimensions
        const blobUrl = URL.createObjectURL(compressed)
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
          img.src = blobUrl
        })
        URL.revokeObjectURL(blobUrl)

        const photoId = crypto.randomUUID()
        const ext = file.name.split('.').pop() ?? 'jpg'
        const storagePath = `infrastructure/${sectionId}/${photoId}.${ext}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, compressed, { upsert: true })

        if (uploadError) throw new Error(uploadError.message)

        // Get signed URL (24h)
        const { data: signedData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, 86400)

        const signedUrl = signedData?.signedUrl

        // Create Document record in Tủ tài liệu
        const folderId = await getInfraFolderId()
        const now = new Date().toISOString()
        const docId = crypto.randomUUID()

        saveDocument({
          id: docId,
          folderId,
          displayName: file.name,
          tags: ['Cơ sở vật chất'],
          linkedEntities: [
            {
              type: 'INFRASTRUCTURE_SECTION',
              id: sectionId,
              label: sectionLabel,
            },
          ],
          isStarred: false,
          versions: [{ version: 1, storagePath, sizeBytes: compressed.size, uploadedAt: now }],
          currentVersion: 1,
          mimeCategory: 'IMAGE',
          originalFilename: file.name,
          sizeBytes: compressed.size,
          storagePath,
          createdAt: now,
          updatedAt: now,
        })

        onAdd({
          id: photoId,
          documentId: docId,
          storagePath,
          url: signedUrl ?? undefined,
          fileName: file.name,
          fileSize: compressed.size,
          uploadedAt: now,
          width: dims.width,
          height: dims.height,
        })
      } catch (err) {
        toast.error(`Lỗi tải lên: ${err instanceof Error ? err.message : 'Không xác định'}`)
      }
    },
    [sectionId, sectionLabel, onAdd],
  )

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return
      setUploading(true)
      for (const file of accepted) {
        await processFile(file)
      }
      setUploading(false)
    },
    [processFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    disabled: uploading,
  })

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          {photos.length > 0 && (
            <span className="text-xs text-muted-foreground">{photos.length} ảnh</span>
          )}
        </div>
      )}

      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/40 hover:bg-secondary/40'
        } ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Đang tải lên...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {isDragActive ? 'Thả ảnh vào đây...' : 'Kéo & thả ảnh hoặc nhấn để chọn'}
            </p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, HEIC — tối đa 10MB/ảnh</p>
          </div>
        )}
      </div>

      {hint && (
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <span>💡</span>
          {hint}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>(
              `[data-section="${sectionId}"] input[type="file"]`,
            )
            input?.click()
          }}
        >
          <Upload className="h-3.5 w-3.5" />
          Tải lên
        </Button>
      </div>
    </div>
  )
}
