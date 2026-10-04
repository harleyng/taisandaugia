/**
 * Trung tâm hướng dẫn (dev/tester) của Trạm Điều Hành — một artifact gồm trang tổng quan và
 * bốn sổ tay theo nhóm menu. Trang tổng quan nhận `#neo` của tính năng và tự chuyển sang
 * đúng sổ tay, nên mọi màn chỉ cần một URL gốc + mã neo.
 * Đổi mã neo ở đây thì phải đổi cả trong tài liệu (và ngược lại).
 */
export const OWNER_GUIDE_CENTER = 'https://claude.ai/artifact/CkpHPjZFPQ2tV1HfLDDmth'

/** Gốc route → mã neo. Trang con (chi tiết, form, trang in) dùng chung neo với trang gốc. */
const OWNER_GUIDE_ANCHORS: Record<string, string> = {
  // Điều hành
  dashboard: 'tong-quan',
  'chi-tieu': 'chi-tieu',
  'tai-san': 'tai-san',
  'ket-qua': 'ket-qua',
  // Tác nghiệp
  'dang-tai-san': 'so-hoa',
  'ky-gui-dau-gia': 'ky-gui',
  'truyen-thong': 'truyen-thong',
  'hop-dong': 'hop-dong',
  'thu-tien': 'thu-tien',
  'doi-tac': 'doi-tac',
  // Phân tích
  'bao-cao': 'phan-tich',
  'dong-tien': 'dong-tien',
  'hieu-qua-quang-cao': 'hieu-qua-quang-cao',
  'bao-cao-dinh-ky': 'bao-cao-dinh-ky',
  // Thiết lập
  'chi-nhanh-amc': 'chi-nhanh',
  'thanh-vien': 'thanh-vien',
  'vai-tro': 'vai-tro',
  'lien-ket': 'lien-ket',
  'nhat-ky': 'nhat-ky',
  'goi-thue-bao': 'goi-thue-bao',
  credits: 'credit',
}

/** Link hướng dẫn cho trang đang mở; undefined nếu trang chưa có mục hướng dẫn. */
export function ownerGuideUrl(pathname: string): string | undefined {
  const [, root, first] = pathname.split('/')
  if (root !== 'chu-tai-san' || !first) return undefined
  const anchor = OWNER_GUIDE_ANCHORS[first]
  return anchor ? `${OWNER_GUIDE_CENTER}#${anchor}` : undefined
}
