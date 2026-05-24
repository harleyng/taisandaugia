import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function MOJDirectoryStatusCard() {
  return (
    <Card className="border border-success/30 bg-success/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Có tên trong Danh sách Bộ Tư pháp</p>
            <p className="text-xs text-success">
              Mục I: Đủ điều kiện bắt buộc ✓ · Dữ liệu từ cổng Bộ Tư pháp
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
