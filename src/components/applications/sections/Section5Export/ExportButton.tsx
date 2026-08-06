import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Application, ExportFormat } from '@/types/application'
import { CapacityProfile } from '@/types/capacity-profile'
import { generateExport } from '@/lib/applications/export-docx'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { useCredits } from '@/hooks/useCredits'
import { useServiceCatalog } from '@/hooks/useServiceCatalog'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  app: Application
  profile: CapacityProfile
  format: ExportFormat
  disabled?: boolean
  onExported: () => void
}

export function ExportButton({ app, profile, format, disabled, onExported }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const { balance, chargeExportProfile } = useCredits()
  const { costOf } = useServiceCatalog()
  const { organizationId } = usePortalOrg()
  const EXPORT_COST = costOf('export_profile_company') || 30

  const canAfford = balance >= EXPORT_COST

  async function handleExport() {
    setConfirmOpen(false)
    setIsExporting(true)
    try {
      const r = await chargeExportProfile()
      if (!r.ok) {
        toast.error(`Số dư không đủ. Cần ${EXPORT_COST} credit để xuất file.`)
        return
      }
      await generateExport(app, profile, format, organizationId)
      toast.success('Xuất file thành công! File đang được tải về.')
      onExported()
    } catch (err) {
      toast.error('Có lỗi khi xuất file. Vui lòng thử lại.')
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Button
        size="lg"
        className="gap-2"
        disabled={disabled || isExporting || !canAfford}
        onClick={() => setConfirmOpen(true)}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tạo file...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Xuất file ({EXPORT_COST} credit)
          </>
        )}
      </Button>

      {!canAfford && !isExporting && (
        <p className="text-xs text-destructive mt-1.5">
          Số dư không đủ ({balance} credit). Cần {EXPORT_COST} credit.
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xuất file</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sẽ bị trừ <strong>{EXPORT_COST} credit</strong> để tạo file hồ sơ dự tuyển.
              Số dư hiện tại: <strong>{balance} credit</strong>.
              <br />
              <br />
              Format xuất: <strong>{format === 'SEPARATED' ? 'Tách rời (3 file → .zip)' : 'Tích hợp (1 file .docx)'}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport}>
              Xác nhận, xuất file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
