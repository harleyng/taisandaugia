/**
 * Trung tâm hướng dẫn (dev/tester) của Cổng tổ chức — cùng khuôn với trung tâm Admin và
 * Trạm Điều Hành: trang tổng quan nhận `#neo` và tự chuyển sang đúng sổ tay.
 * Đổi mã neo ở đây thì phải đổi cả trong tài liệu (và ngược lại). Neo của màn phiên /
 * hồ sơ tham gia / điều hành nằm ở nút "?" của Sàn đấu giá trực tuyến (repo taisanviet,
 * `components/auction-org/guide-links.ts`) từ Phase 5.
 */
export const PORTAL_GUIDE_CENTER = 'https://claude.ai/artifact/FxkDtQMEUCG8iKEkm6hzvJ'

/** Gốc route dưới /portal → mã neo. Trang con dùng chung neo với trang gốc. */
const PORTAL_GUIDE_ANCHORS: Record<string, string> = {
  'yeu-cau-ky-gui': 'yeu-cau-ky-gui',
  // Menu "Hợp đồng" gộp ký gửi + mua bán; sổ tay hiện mới có mục mua bán.
  'hop-dong': 'hop-dong-mua-ban',
}

/** Link hướng dẫn cho trang cổng tổ chức đang mở; undefined nếu trang chưa có mục hướng dẫn. */
export function portalGuideUrl(pathname: string): string | undefined {
  const [, root, first] = pathname.split('/')
  if (root !== 'portal' || !first) return undefined
  const anchor = PORTAL_GUIDE_ANCHORS[first]
  return anchor ? `${PORTAL_GUIDE_CENTER}#${anchor}` : undefined
}
