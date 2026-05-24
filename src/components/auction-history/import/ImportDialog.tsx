import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImportUploadStep } from './ImportUploadStep'
import { ColumnMappingStep } from './ColumnMappingStep'
import { ImportPreviewStep } from './ImportPreviewStep'
import { ImportProgressStep } from './ImportProgressStep'
import { ImportSuccessStep } from './ImportSuccessStep'
import type { ImportFlowState, DuplicateStrategy } from '@/hooks/useAuctionHistory'
import type { ColumnMapping } from '@/lib/auction-history/import-parser'

const STEP_LABELS: Record<string, string> = {
  upload: '1. Chọn file',
  mapping: '2. Map cột',
  preview: '3. Xem trước',
  progress: '4. Đang cập nhật',
  done: '5. Hoàn thành',
}

interface Props {
  open: boolean
  onClose: () => void
  importFlow: ImportFlowState
  missingPriceCount: number
  onFile: (file: File, headers: string[], rows: Record<string, unknown>[]) => void
  onConfirmMapping: (mapping: ColumnMapping) => void
  onExecuteImport: (strategy: DuplicateStrategy) => void
  onGoToMapping: () => void
  onEnrich: () => void
  setDuplicateStrategy: (s: DuplicateStrategy) => void
}

export function ImportDialog({
  open,
  onClose,
  importFlow,
  missingPriceCount,
  onFile,
  onConfirmMapping,
  onExecuteImport,
  onGoToMapping,
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

        {step === 'mapping' && (
          <ColumnMappingStep
            headers={importFlow.headers}
            mapping={importFlow.mapping}
            onMappingChange={() => {}}
            onBack={() => onGoToMapping()}
            onNext={() => onConfirmMapping(importFlow.mapping)}
          />
        )}

        {step === 'preview' && importFlow.validation && (
          <ImportPreviewStep
            validation={importFlow.validation}
            onBack={onGoToMapping}
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
