import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import type { ValidationResult } from '@/lib/auction-history/import-parser'
import { exportErrorRows } from '@/lib/auction-history/import-parser'
import type { DuplicateStrategy } from '@/hooks/useAuctionHistory'

interface Props {
  validation: ValidationResult
  onBack: () => void
  onExecute: (strategy: DuplicateStrategy) => void
}

export function ImportPreviewStep({ validation, onBack, onExecute }: Props) {
  const [showErrors, setShowErrors] = useState(false)
  const totalValid = validation.validRows.length + validation.warningRows.length
  const unmatchedCount = validation.duplicateRows.length

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
        File này sẽ <strong>bổ sung thông tin kết quả</strong> cho các cuộc đấu giá đã được đồng bộ. Hệ thống sẽ khớp theo Ngày + Người có tài sản (hoặc Số phiên).
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
          <CheckCircle2 className="h-4 w-4 text-success mx-auto mb-1" />
          <p className="text-lg font-bold text-success">{totalValid}</p>
          <p className="text-xs text-muted-foreground">Sẽ cập nhật</p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-center">
          <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-amber-600">{validation.warningRows.length}</p>
          <p className="text-xs text-muted-foreground">Cảnh báo</p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
          <XCircle className="h-4 w-4 text-destructive mx-auto mb-1" />
          <p className="text-lg font-bold text-destructive">{validation.errorRows.length}</p>
          <p className="text-xs text-muted-foreground">Lỗi nghiêm trọng</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <Info className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-lg font-bold">{unmatchedCount}</p>
          <p className="text-xs text-muted-foreground">Không khớp</p>
        </div>
      </div>

      {unmatchedCount > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5 text-amber-600" />
          {unmatchedCount} dòng không tìm thấy cuộc đấu giá tương ứng trong hệ thống và sẽ bị bỏ qua.
        </div>
      )}

      {validation.validRows.slice(0, 3).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Preview 3 dòng đầu tiên hợp lệ:</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {validation.validRows.slice(0, 3).map((row, i) => (
              <div key={i} className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 truncate">
                {row.auctionDate} · {row.ownerName}{row.winningPrice ? ` · ${row.winningPrice.toLocaleString('vi-VN')} VND` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {validation.errorRows.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowErrors((p) => !p)}
          >
            {showErrors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Xem chi tiết {validation.errorRows.length} lỗi
          </button>
          {showErrors && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {validation.errorRows.map((e) => (
                <div key={e.row} className="text-xs bg-destructive/5 border border-destructive/20 rounded px-2 py-1">
                  <span className="font-medium text-destructive">Dòng {e.row}:</span>{' '}
                  {e.errors.join('; ')}
                </div>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs gap-1.5"
            onClick={() => exportErrorRows(validation.errorRows, validation.headers)}
          >
            Tải file lỗi
          </Button>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />Quay lại
        </Button>
        <Button
          size="sm"
          onClick={() => onExecute('SKIP')}
          disabled={totalValid === 0}
        >
          Cập nhật {totalValid} cuộc
        </Button>
      </div>
    </div>
  )
}
