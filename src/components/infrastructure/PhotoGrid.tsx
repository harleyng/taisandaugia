import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhotoLightbox } from './PhotoLightbox'
import type { PhotoAttachment } from '@/types/infrastructure'

interface Props {
  photos: PhotoAttachment[]
  onRemove: (id: string) => void
  onReorder: (fromIdx: number, toIdx: number) => void
  onCaptionChange: (id: string, caption: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PhotoGrid({ photos, onRemove, onReorder, onCaptionChange }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  if (photos.length === 0) return null

  function openLightbox(idx: number) {
    setLightboxIndex(idx)
    setLightboxOpen(true)
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo, idx) => (
          <div key={photo.id} className="group relative rounded-xl border bg-muted overflow-hidden">
            <div
              className="relative aspect-square cursor-pointer"
              onClick={() => openLightbox(idx)}
            >
              <img
                src={photo.url ?? photo.storagePath}
                alt={photo.caption ?? photo.fileName}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(photo.id)}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
            >
              <X className="h-3 w-3" />
            </button>

            <div className="flex items-center justify-between px-1 py-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={idx === 0}
                onClick={() => onReorder(idx, idx - 1)}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={idx === photos.length - 1}
                onClick={() => onReorder(idx, idx + 1)}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            <div className="px-2 pb-2">
              <Input
                value={photo.caption ?? ''}
                onChange={(e) => onCaptionChange(photo.id, e.target.value)}
                placeholder="Chú thích..."
                className="h-6 text-xs"
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                {formatBytes(photo.fileSize)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <PhotoLightbox
        photos={photos}
        open={lightboxOpen}
        startIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}
