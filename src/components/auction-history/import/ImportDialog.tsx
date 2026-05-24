import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImportUploadStep } from './ImportUploadStep'
import { ImportPreviewStep } from './ImportPreviewStep'
import { ImportProgressStep } from './ImportProgressStep'
import { ImportSuccessStep } from './ImportSuccessStep'
import type { ImportFlowState, DuplicateStrategy } from '@/hooks/useAuctionHistory'

const STEP_LABELS: Record<string, string> = {
  upload: '1. Chọn file',
  preview: '2. Xem trước',
  progress: '3. Đang cập nhật',
  done: '4. Hoàn thành',
}

interface Props {
  open: boolean
  onClose: () => void
  importFlow: ImportFlowState
  missingPriceCount: number
  onFile: (file: File, headers: string[], rows: Record<string, unknown>[]) => void
  onExecuteImport: (strategy: DuplicateStrategy) => void
  onBack: () => void
  onEnrich: () => void
  setDuplicateStrategy: (s: DuplicateStrategy) => void
}

export function ImportDialog({
  open,
  onClose,
  importFlow,
  missingPriceCount,
  onFile,
  onExecuteImport,
  onBack,
  onEnrich,
}: Props) {
  const { step } = importFlow
  const isProgress = step === 'progress'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isProgress) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Bổ sung kết quả hàng loạt
            {step !== 'idle' && step !== 'done' && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {STEP_LABELS[step]}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <ImportUploadStep onFile={onFile} />
        )}

        {step === 'preview' && importFlow.validation && (
          <ImportPreviewStep
            validation={importFlow.validation}
            onBack={onBack}
            onExecute={onExecuteImport}
          />
        )}

        {step === 'progress' && (
          <ImportProgressStep
            progress={importFlow.progress}
            total={importFlow.rawRows.length}
          />
        )}

        {step === 'done' && importFlow.result && (
          <ImportSuccessStep
            result={importFlow.result}
            missingPrice={missingPriceCount}
            onEnrich={() => { onClose(); onEnrich() }}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
