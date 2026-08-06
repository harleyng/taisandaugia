import { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import * as docsRepo from '@/lib/documents/supabase-repo'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import type { PhotoAttachment } from '@/types/infrastructure'

const ACCEPTED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
}

const MAX_SIZE = 10 * 1024 * 1024
const BUCKET = 'org-documents'

interface Props {
  photos: PhotoAttachment[]
  sectionId: string
  sectionLabel: string
  label?: string
  hint?: string
  onAdd: (photo: PhotoAttachment) => void
}

async function getInfraFolderId(organizationId: string): Promise<string | null> {
  // Seed rồi tra cứu: tổ chức mới chưa có thư mục nào, và seedDefaultFolders là
  // idempotent nên gọi mỗi lần tải lên vẫn an toàn.
  await docsRepo.seedDefaultFolders(organizationId)
  const folders = await docsRepo.listFolders(organizationId)
  return folders.find((f) => f.name === 'Cơ sở vật chất')?.id ?? null
}

export function PhotoUpload({ photos, sectionId, sectionLabel, label, hint, onAdd }: Props) {
  const { organizationId } = usePortalOrg()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      // Chặn sớm: đường dẫn Storage bắt đầu bằng organization_id nên thiếu nó
      // sẽ dựng ra "undefined/..." và bị policy bucket từ chối.
      if (!organizationId) {
        toast.error('Chưa xác định được tổ chức. Vui lòng tải lại trang.')
        return
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: vượt quá 10MB`)
        return
      }
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        })

        const blobUrl = URL.createObjectURL(compressed)
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
          img.src = blobUrl
        })
        URL.revokeObjectURL(blobUrl)

        const photoId = crypto.randomUUID()
        const ext = file.name.split('.').pop() ?? 'jpg'
        // Segment đầu PHẢI là organization_id — policy bucket gate theo nó
        // (migration 20260806000030). Prefix cũ bị TỪ CHỐI.
        const storagePath = `${organizationId}/infrastructure/${sectionId}/${photoId}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, compressed, { upsert: true })

        if (uploadError) throw new Error(uploadError.message)

        const { data: signedData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, 86400)

        const now = new Date().toISOString()
        const docId = crypto.randomUUID()

        await docsRepo.saveDocument({
          id: docId,
          folderId: await getInfraFolderId(organizationId),
          displayName: file.name,
          tags: ['Cơ sở vật chất'],
          linkedEntities: [{ type: 'INFRASTRUCTURE_SECTION', id: sectionId, label: sectionLabel }],
          isStarred: false,
          versions: [{ version: 1, storagePath, sizeBytes: compressed.size, uploadedAt: now }],
          currentVersion: 1,
          mimeCategory: 'IMAGE',
          originalFilename: file.name,
          sizeBytes: compressed.size,
          storagePath,
          createdAt: now,
          updatedAt: now,
        }, organizationId)

        onAdd({
          id: photoId,
          documentId: docId,
          storagePath,
          url: signedData?.signedUrl ?? undefined,
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
    [organizationId, sectionId, sectionLabel, onAdd],
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
    noClick: true,
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
        className={`border-2 border-dashed rounded-xl p-5 transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border'
        } ${uploading ? 'opacity-60' : ''}`}
      >
        <input {...getInputProps()} ref={inputRef} />

        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Đang tải lên...</p>
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center gap-1 py-2">
            <Upload className="h-6 w-6 text-primary" />
            <p className="text-sm font-medium text-primary">Thả ảnh vào đây...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Kéo & thả ảnh vào đây, hoặc chọn từ bên dưới
            </p>
            <p className="text-[11px] text-muted-foreground">
              JPG, PNG, WEBP, HEIC — tối đa 10MB/ảnh
            </p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Tải lên từ thiết bị
              </Button>

            </div>
          </div>
        )}
      </div>

      {hint && (
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <span>💡</span>
          {hint}
        </p>
      )}

    </div>
  )
}
