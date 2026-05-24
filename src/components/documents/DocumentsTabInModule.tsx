import { useState } from 'react'
import { ExternalLink, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { FileTypeIcon } from './shared/FileTypeIcon'
import { ExpiryBadge } from './shared/ExpiryBadge'
import { UploadModal } from './modals/UploadModal'
import { useDocuments } from '@/hooks/useDocuments'
import { useFolders } from '@/hooks/useFolders'
import type { LinkedEntityType } from '@/types/document'
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  entityType: LinkedEntityType
  entityId: string
}

export function DocumentsTabInModule({ entityType, entityId }: Props) {
  const docs = useDocuments()
  const folders = useFolders()
  const navigate = useNavigate()
  const [uploadOpen, setUploadOpen] = useState(false)

  const linked = docs.allDocuments.filter(
    (d) =>
      !d.deletedAt &&
      d.linkedEntities.some(
        (e) => e.type === entityType && e.id === entityId,
      ),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Tài liệu ({linked.length})
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate('/portal/nang-luc/tu-tai-lieu')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Mở tủ tài liệu
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Tải lên
          </Button>
        </div>
      </div>

      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Chưa có tài liệu liên kết.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {linked.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 cursor-pointer"
              onClick={() => navigate('/portal/nang-luc/tu-tai-lieu')}
            >
              <FileTypeIcon category={doc.mimeCategory} className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{doc.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(doc.sizeBytes)} ·{' '}
                  {format(parseISO(doc.updatedAt), 'dd/MM/yyyy', { locale: vi })}
                </p>
              </div>
              <ExpiryBadge expiryDate={doc.expiryDate} />
            </div>
          ))}
        </div>
      )}

      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        docs={docs}
        targetFolder={null}
      />
    </div>
  )
}
