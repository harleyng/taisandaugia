import { useEffect, useState } from 'react'
import { Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileTypeIcon } from '../shared/FileTypeIcon'
import type { Document } from '@/types/document'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

interface Props {
  doc: Document
  docs: UseDocumentsReturn
}

export function DocumentPreview({ doc, docs }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    docs.getPreviewUrl(doc.id).then((url) => {
      if (!cancelled) {
        setSignedUrl(url)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [doc.id, doc.storagePath, docs])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
        <FileTypeIcon category={doc.mimeCategory} className="h-12 w-12" />
        <p className="text-sm">Không thể tải xem trước</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => docs.downloadDocument(doc.id)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Tải xuống
        </Button>
      </div>
    )
  }

  if (doc.mimeCategory === 'IMAGE') {
    return (
      <div className="rounded-lg overflow-hidden border">
        <img
          src={signedUrl}
          alt={doc.displayName}
          className="max-w-full max-h-96 object-contain mx-auto"
        />
      </div>
    )
  }

  if (doc.mimeCategory === 'PDF') {
    return (
      <div className="rounded-lg overflow-hidden border">
        <iframe
          src={signedUrl}
          title={doc.displayName}
          className="w-full h-96"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
      <FileTypeIcon category={doc.mimeCategory} className="h-12 w-12" />
      <p className="text-sm text-center">
        {doc.originalFilename}
        <br />
        <span className="text-xs">Loại file này không hỗ trợ xem trực tiếp</span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => docs.downloadDocument(doc.id)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Tải xuống
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(signedUrl, '_blank')}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Mở tab mới
        </Button>
      </div>
    </div>
  )
}
