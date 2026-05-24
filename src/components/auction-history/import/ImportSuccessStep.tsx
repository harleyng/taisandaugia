import { Button } from '@/components/ui/button'
import { CheckCircle2, Zap } from 'lucide-react'
import type { ImportSession } from '@/types/auction-record'

interface Props {
  result: ImportSession
  missingPrice: number
  onEnrich: () => void
  onClose: () => void
}

export function ImportSuccessStep({ result, missingPrice, onEnrich, onClose }: Props) {
  return (
    <div className="text-center space-y-5 py-4">
      <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
      <div>
        <h3 className="text-base font-semibold">Bổ sung hoàn tất</h3>
      </div>

      <div className="text-left rounded-lg border border-border divide-y divide-border">
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Đã cập nhật</span>
          <span className="font-semibold text-success">{result.successRows} cuộc</span>
        </div>
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Không tìm thấy khớp</span>
          <span>{result.duplicateRows} cuộc</span>
        </div>
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Lỗi dữ liệu</span>
          <span className={result.errorRows > 0 ? 'text-destructive' : ''}>{result.errorRows} cuộc</span>
        </div>
      </div>

      {missingPrice > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              {missingPrice} cuộc vẫn thiếu giá trúng
            </p>
          </div>
          <p className="text-xs text-amber-700">Bổ sung giá trúng để tăng điểm Mục IV.3-4</p>
          <Button size="sm" className="gap-1.5 w-full" onClick={onEnrich}>
            <Zap className="h-3.5 w-3.5" />Bổ sung ngay →
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onClose} className="w-full">
        {missingPrice > 0 ? 'Để sau' : 'Đóng'}
      </Button>
    </div>
  )
}
