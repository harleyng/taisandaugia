import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Document } from '@/types/document'
import { downloadFile } from '@/lib/documents/supabase-storage'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  doc: Document
}

export function VersionHistoryPanel({ doc }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Lịch sử phiên bản
      </p>
      {[...doc.versions].reverse().map((v) => (
        <div
          key={v.version}
          className="flex items-center gap-3 p-2.5 rounded-lg border bg-secondary/30"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">v{v.version}</span>
              {v.version === doc.currentVersion && (
                <Badge variant="secondary" className="text-xs">Hiện tại</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(parseISO(v.uploadedAt), "dd/MM/yyyy 'lúc' HH:mm", { locale: vi })}
              {' · '}
              {formatBytes(v.sizeBytes)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() =>
              downloadFile(v.storagePath, `${doc.originalFilename}_v${v.version}`)
            }
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}
