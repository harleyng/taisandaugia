// Logic thuần của danh sách "Yêu cầu ký gửi" (design "Yeu Cau Ky Gui - Cong To Chuc v2"):
// tab, trạng thái gộp, việc cần làm, sắp xếp, tìm kiếm. Tách khỏi JSX để bảng và
// trang dùng chung một luật.

import { CHILD_NAME, PARENT_NAME } from '@/constants/category.constants'
import { stripViDiacritics } from '@/lib/normalizeVi'
import { todayIso } from '@/lib/ownerOutcomeReport'
import type { OrgServiceRequest, ServiceRequestStatus } from '@/types/consignment'

export type RequestTab = 'tat-ca' | 'can-xu-ly' | 'bao-gia' | 'hop-dong' | 'da-dong'
export type StatusTone = 'open' | 'wait' | 'ok' | 'closed'

const CLOSED: Partial<Record<ServiceRequestStatus, string>> = {
  declined: 'Đã từ chối',
  not_selected: 'Không được chọn',
  withdrawn: 'Chủ TS đã thu hồi',
  contract_cancelled: 'Huỷ hợp đồng',
}

export const isOpen = (r: OrgServiceRequest) => r.status === 'sent' || r.status === 'seen'

/** Việc của tổ chức: còn phải báo giá, hoặc hợp đồng chờ tổ chức soạn / xác nhận. */
export const needsAction = (r: OrgServiceRequest) =>
  isOpen(r) || r.contract_status === 'drafting' || r.contract_status === 'awaiting_confirmation'

export const REQUEST_TABS: { key: RequestTab; label: string; match: (r: OrgServiceRequest) => boolean }[] = [
  { key: 'tat-ca', label: 'Tất cả', match: () => true },
  { key: 'can-xu-ly', label: 'Cần bạn xử lý', match: needsAction },
  { key: 'bao-gia', label: 'Đã báo giá', match: (r) => r.status === 'quoted' },
  // Cả 'accepted' (dòng cũ) để yêu cầu đã trúng không rơi khỏi mọi tab riêng.
  { key: 'hop-dong', label: 'Hợp đồng', match: (r) => r.status === 'selected' || r.status === 'accepted' },
  { key: 'da-dong', label: 'Đã đóng', match: (r) => !!CLOSED[r.status] },
]

/** "08/10" */
export const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Số ngày từ hôm nay (giờ máy) tới ngày `iso` (yyyy-MM-dd). */
export function daysUntil(iso: string): number {
  const at = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((at(iso.slice(0, 10)) - at(todayIso())) / 86_400_000)
}

export function requestStatus(r: OrgServiceRequest): { label: string; tone: StatusTone } {
  if (isOpen(r)) return { label: 'Chờ báo giá', tone: 'open' }
  if (r.status === 'quoted') return { label: 'Đã báo giá', tone: 'wait' }
  if (CLOSED[r.status] || r.contract_status === 'cancelled') {
    return { label: CLOSED[r.status] ?? 'Huỷ hợp đồng', tone: 'closed' }
  }
  if (r.contract_status === 'signed') return { label: 'Đã ký hợp đồng', tone: 'ok' }
  if (r.contract_status) return { label: 'Đang ký hợp đồng', tone: 'open' }
  return { label: r.status === 'accepted' ? 'Đã tiếp nhận' : 'Đã trúng', tone: 'closed' }
}

export interface RequestTodo {
  title: string
  /** Dòng phụ (hạn chót) — chỉ việc có hạn mới có. */
  due: string | null
  urgent: boolean
}

export function requestTodo(r: OrgServiceRequest): RequestTodo | null {
  if (isOpen(r)) {
    const d = daysUntil(r.respond_by)
    const tail = d < 0 ? ' · quá hạn' : d === 0 ? ' · hôm nay' : ` · còn ${d} ngày`
    return { title: 'Gửi báo giá', due: `Hạn ${dayMonth(r.respond_by)}${tail}`, urgent: d <= 2 }
  }
  switch (r.contract_status) {
    case 'drafting':
      return { title: 'Soạn và chia sẻ dự thảo', due: null, urgent: false }
    case 'awaiting_signatures':
      return { title: 'Tải bản đã ký', due: null, urgent: false }
    case 'awaiting_confirmation':
      return { title: 'Xác nhận bản đã ký', due: null, urgent: false }
    default:
      return null
  }
}

export const requestLocation = (r: OrgServiceRequest) => [r.district, r.province].filter(Boolean).join(', ')

const updatedAt = (r: OrgServiceRequest) => r.quoted_at ?? r.created_at

/** Việc của bạn lên đầu → hạn báo giá gần nhất → cập nhật mới nhất. */
export function compareRequests(a: OrgServiceRequest, b: OrgServiceRequest): number {
  const need = Number(needsAction(b)) - Number(needsAction(a))
  if (need) return need
  const dueA = isOpen(a) ? a.respond_by : '9'
  const dueB = isOpen(b) ? b.respond_by : '9'
  if (dueA !== dueB) return dueA < dueB ? -1 : 1
  return updatedAt(b).localeCompare(updatedAt(a))
}

export function matchesQuery(r: OrgServiceRequest, folded: string): boolean {
  if (!folded) return true
  const hay = [
    r.posting_code,
    r.title,
    PARENT_NAME[r.parent_slug],
    CHILD_NAME[r.child_slug],
    requestLocation(r),
    r.contract_code,
  ]
    .filter(Boolean)
    .join(' ')
  return stripViDiacritics(hay).includes(folded)
}
