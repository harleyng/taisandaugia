import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { PhotoAttachment } from '@/types/infrastructure'

interface Props {
  photos: PhotoAttachment[]
  open: boolean
  startIndex: number
  onClose: () => void
}

export function PhotoLightbox({ photos, open, startIndex, onClose }: Props) {
  const slides = photos.map((p) => ({
    src: p.url ?? p.storagePath,
    alt: p.caption ?? p.fileName,
  }))

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={startIndex}
      slides={slides}
    />
  )
}
