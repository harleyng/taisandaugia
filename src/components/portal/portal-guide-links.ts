/**
 * Trung tâm hướng dẫn (dev/tester) của Cổng tổ chức — cùng khuôn với trung tâm Admin và
 * Trạm Điều Hành: trang tổng quan nhận `#neo` và tự chuyển sang đúng sổ tay.
 * Đổi mã neo ở đây thì phải đổi cả trong tài liệu (và ngược lại).
 */
export const PORTAL_GUIDE_CENTER = 'https://claude.ai/artifact/FxkDtQMEUCG8iKEkm6hzvJ'

/** Gốc route dưới /portal → mã neo. Trang con dùng chung neo với trang gốc. */
const PORTAL_GUIDE_ANCHORS: Record<string, string> = {
  'yeu-cau-ky-gui': 'yeu-cau-ky-gui',
  'phien-dau-gia': 'phien-dau-gia',
  'ho-so-tham-gia': 'ho-so-tham-gia',
  // Menu "Hợp đồng" gộp ký gửi + mua bán; sổ tay hiện mới có mục mua bán.
  'hop-dong': 'hop-dong-mua-ban',
  'hop-dong-mua-ban': 'hop-dong-mua-ban',
}

/** Tab của trang phiên (`/portal/phien-dau-gia/:id/<tab>`) thuộc tính năng khác → neo riêng. */
const SESSION_TAB_ANCHORS: Record<string, string> = {
  'dieu-hanh': 'dieu-hanh-dau-gia',
  'ho-so': 'ho-so-tham-gia',
  'diem-danh': 'ho-so-tham-gia',
}

/** Link hướng dẫn cho trang cổng tổ chức đang mở; undefined nếu trang chưa có mục hướng dẫn. */
export function portalGuideUrl(pathname: string): string | undefined {
  const [, root, first, , tab] = pathname.split('/')
  if (root !== 'portal' || !first) return undefined
  const anchor = PORTAL_GUIDE_ANCHORS[first]
  if (!anchor) return undefined
  if (first === 'phien-dau-gia' && tab) {
    return `${PORTAL_GUIDE_CENTER}#${SESSION_TAB_ANCHORS[tab] ?? anchor}`
  }
  return `${PORTAL_GUIDE_CENTER}#${anchor}`
}
