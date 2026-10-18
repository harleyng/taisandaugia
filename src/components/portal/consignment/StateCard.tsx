import type { ReactNode } from 'react'
import { ConsignmentCanvas } from './ConsignmentCanvas'

/** Thẻ trạng thái giữa trang (đang tải / không có tổ chức / không tìm thấy). */
export function StateCard({ children }: { children: ReactNode }) {
  return (
    <ConsignmentCanvas>
      <div className="space-y-3 rounded-2xl bg-card p-10 text-center shadow-card">{children}</div>
    </ConsignmentCanvas>
  )
}
