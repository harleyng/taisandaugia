/**
 * Trung tâm hướng dẫn (dev/tester) của cổng Admin — mỗi nhóm menu một artifact, cùng khuôn
 * với trung tâm Trạm Điều Hành: trang tổng quan nhận `#neo` và tự chuyển sang đúng sổ tay.
 * Đổi mã neo ở đây thì phải đổi cả trong tài liệu (và ngược lại).
 */
export const ADMIN_SALES_GUIDE_CENTER = 'https://claude.ai/artifact/NxiRyrtMjogD962CqQ6qYW'
export const ADMIN_OPS_GUIDE_CENTER = 'https://claude.ai/artifact/Bx4cJiUZnUSdNZ1s9agqZK'

/** Gốc route dưới /admin → [trung tâm, mã neo]. Trang con dùng chung neo với trang gốc. */
const ADMIN_GUIDE_ANCHORS: Record<string, [string, string]> = {
  // Bán hàng
  'khach-hang-tiem-nang': [ADMIN_SALES_GUIDE_CENTER, 'khach-hang-tiem-nang'],
  'co-hoi': [ADMIN_SALES_GUIDE_CENTER, 'co-hoi'],
  'khach-hang': [ADMIN_SALES_GUIDE_CENTER, 'khach-hang'],
  'don-hang': [ADMIN_SALES_GUIDE_CENTER, 'don-hang'],
  'goi-thue-bao': [ADMIN_SALES_GUIDE_CENTER, 'goi-dich-vu'],
  'doi-tac': [ADMIN_SALES_GUIDE_CENTER, 'doi-tac'],
  // Vận hành & Hỗ trợ
  'tai-san': [ADMIN_OPS_GUIDE_CENTER, 'tai-san-tu-nguyen'],
  'yeu-cau-dich-vu': [ADMIN_OPS_GUIDE_CENTER, 'yeu-cau-dich-vu'],
  'dich-vu': [ADMIN_OPS_GUIDE_CENTER, 'dich-vu'],
  'cong-viec': [ADMIN_OPS_GUIDE_CENTER, 'cong-viec'],
  ticket: [ADMIN_OPS_GUIDE_CENTER, 'ticket'],
}

/** Loại yêu cầu dịch vụ (đoạn route chi tiết hoặc `?loai=`) → mã neo riêng trong sổ tay Yêu cầu. */
const SERVICE_REQUEST_ANCHORS: Record<string, string> = {
  'tu-van-phap-ly': 'tu-van-phap-ly',
  'tu-van-dau-gia': 'tu-van-dau-gia',
  'tham-dinh': 'tham-dinh-gia',
  'giam-dinh': 'giam-dinh',
  'vr-tour': 'vr-tour',
  'truyen-thong': 'truyen-thong',
}

/** Link hướng dẫn cho trang admin đang mở; undefined nếu trang chưa có mục hướng dẫn. */
export function adminGuideUrl(pathname: string, search = ''): string | undefined {
  const [, root, first, second] = pathname.split('/')
  if (root !== 'admin' || !first) return undefined
  const entry = ADMIN_GUIDE_ANCHORS[first]
  if (!entry) return undefined
  const [center, anchor] = entry
  if (first === 'yeu-cau-dich-vu') {
    const kind = second ?? new URLSearchParams(search).get('loai') ?? ''
    return `${center}#${SERVICE_REQUEST_ANCHORS[kind] ?? anchor}`
  }
  return `${center}#${anchor}`
}
