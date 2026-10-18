import type { ReactNode } from 'react'

/**
 * Nền xám kiểu Trạm Điều Hành (thẻ trắng đổ bóng) + khung trang 1280px — dùng cho danh sách và chi tiết.
 * `footer` nằm NGOÀI khung 1280px để thanh dính đáy trải hết bề ngang vùng nội dung.
 */
export function ConsignmentCanvas({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="owner-canvas min-h-full bg-muted">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-4 md:px-8 md:py-6">{children}</div>
      {footer}
    </div>
  )
}
