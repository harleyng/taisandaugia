import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, FileText, Loader2 } from 'lucide-react'
import { TEMPLATE_LABELS } from '@/lib/personnel/dossier-templates'
import type { DossierExport } from '@/lib/personnel/exports-repo'

interface Props {
  item: DossierExport | null
  onOpenChange: (open: boolean) => void
  getUrl: (e: DossierExport) => Promise<string | null>
  onDownload: (e: DossierExport) => void
}

/**
 * Xem hồ sơ đã xuất ngay trong trang.
 *
 * Chỉ nhúng được PDF: trình duyệt có sẵn trình đọc PDF, còn .docx thì không —
 * nhúng vào chỉ ra khung trắng, nên mời tải về thay vì giả vờ xem được.
 */
export function DossierPreviewDialog({ item, onOpenChange, getUrl, onDownload }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canEmbed = item?.format === 'PDF'

  useEffect(() => {
    let cancelled = false
    if (!item || !canEmbed) { setUrl(null); return }
    setLoading(true)
    getUrl(item)
      .then((u) => { if (!cancelled) setUrl(u) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [item, canEmbed, getUrl])

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      {/* Gần như tràn màn hình: hồ sơ là A4 3 trang, khung nhỏ phải cuộn liên
          tục mới đọc được một trang. */}
      <DialogContent className="max-w-[96vw] w-[96vw] h-[94vh] flex flex-col gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm">{item?.auctioneerName}</DialogTitle>
          <DialogDescription className="text-xs">
            {item ? `${TEMPLATE_LABELS[item.template]} · ${item.format}` : ''}
          </DialogDescription>
        </DialogHeader>

        {!canEmbed ? (
          <div className="rounded-lg border border-dashed py-12 text-center space-y-3">
            <FileText className="h-9 w-9 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">Không xem trực tiếp được file Word</p>
              <p className="text-xs text-muted-foreground mt-1">
                Trình duyệt chỉ mở sẵn được PDF. Tải về để xem bằng Word, hoặc
                xuất lại ở định dạng PDF.
              </p>
            </div>
            {item && (
              <Button size="sm" className="gap-1.5" onClick={() => onDownload(item)}>
                <Download className="h-4 w-4" />
                Tải về
              </Button>
            )}
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang mở hồ sơ…
          </div>
        ) : url ? (
          <>
            <iframe
              src={url}
              title={`Hồ sơ ${item?.auctioneerName}`}
              className="flex-1 min-h-0 w-full rounded-lg border"
            />
            {item && (
              <div className="flex justify-end shrink-0">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onDownload(item)}>
                  <Download className="h-4 w-4" />
                  Tải về
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Không mở được file. Có thể bản này chưa lưu được lúc xuất.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
