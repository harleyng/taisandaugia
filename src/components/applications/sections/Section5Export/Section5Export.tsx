import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Application, ExportFormat } from '@/types/application'
import { CapacityProfile } from '@/types/capacity-profile'
import { validateForExport } from '@/lib/applications/validation'
import { FormatPicker } from './FormatPicker'
import { WarningsList } from './WarningsList'
import { PreviewModal } from './PreviewModal'
import { ExportButton } from './ExportButton'
import { Eye } from 'lucide-react'

interface Props {
  app: Application
  profile: CapacityProfile
  onFormatChange: (format: ExportFormat) => void
  onExported: () => void
}

export function Section5Export({ app, profile, onFormatChange, onExported }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const errors = validateForExport(app)
  const canExport = errors.length === 0 && app.exportFormat !== null

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Kiểm tra & Xuất file</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Chọn format, kiểm tra cảnh báo và xuất hồ sơ dự tuyển
        </p>
      </div>

      {/* Format selection */}
      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Format xuất file
        </p>
        <FormatPicker value={app.exportFormat} onChange={onFormatChange} />
      </div>

      <Separator className="my-4" />

      {/* Warnings */}
      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Kiểm tra trước khi xuất
        </p>
        {errors.length === 0 ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
            <span>✓</span>
            <span>Hồ sơ đầy đủ, sẵn sàng xuất file</span>
          </div>
        ) : (
          <WarningsList errors={errors} />
        )}
      </div>

      <Separator className="my-4" />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          disabled={!app.exportFormat}
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="h-4 w-4" />
          Preview
        </Button>

        <ExportButton
          app={app}
          profile={profile}
          format={app.exportFormat as ExportFormat}
          disabled={!canExport}
          onExported={onExported}
        />
      </div>

      {app.exportedFiles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Lịch sử xuất file</p>
          <div className="space-y-1">
            {app.exportedFiles.map((f, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                <span>📄</span>
                <span>{f.name}</span>
                <span>·</span>
                <span>{new Date(f.exportedAt).toLocaleDateString('vi-VN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {app.exportFormat && (
        <PreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          format={app.exportFormat}
          ownerName={app.announcement.ownerName}
        />
      )}
    </Card>
  )
}
