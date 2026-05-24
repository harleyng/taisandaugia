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
}

export function Section5Export({ app, profile, onFormatChange }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const errors = validateForExport(app)
  const canExport = errors.length === 0 && app.exportFormat !== null

  return (
    <Card className="p-5">
      {/* Format selection */}
      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Format xuất file
        </p>
        <FormatPicker value={app.exportFormat} onChange={onFormatChange} />
      </div>

      {errors.length > 0 && (
        <>
          <Separator className="my-4" />
          <div className="mb-4">
            <WarningsList errors={errors} />
          </div>
        </>
      )}

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
          onExported={() => {}}
        />
      </div>

      {app.exportFormat && (
        <PreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          format={app.exportFormat}
          app={app}
          profile={profile}
        />
      )}
    </Card>
  )
}
