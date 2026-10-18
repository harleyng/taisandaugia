// "Lịch sử thao tác" của một yêu cầu ký gửi (design "Yeu Cau Ky Gui - Cong To Chuc v2").
// Ghép từ mốc thời gian của yêu cầu (RPC org_service_requests) và các mốc chính
// của hợp đồng (RPC org_consignment_contract_list) — chi tiết từng bước ký nằm ở
// trang hợp đồng /portal/hop-dong/ky-gui/:id. Không có bảng nhật ký riêng.

import { feeTotalRequired } from '@/lib/quotePlan'
import { formatVnd } from '@/lib/advertising/slug'
import type { OrgServiceRequest } from '@/types/consignment'
import type { OrgConsignmentContractListRow } from '@/types/consignment-contract'

export type HistoryActor = 'owner' | 'me' | 'sys'
export type HistoryTone = 'ok' | 'err' | null

export interface HistoryEvent {
  /** ISO. */
  at: string
  title: string
  sub: string | null
  who: HistoryActor
  tone: HistoryTone
}

export const HISTORY_ACTOR_LABELS: Record<HistoryActor, string> = {
  owner: 'Chủ tài sản',
  me: 'Tổ chức',
  sys: 'Hệ thống',
}

/** Mới nhất lên đầu. */
export function buildRequestHistory(
  r: OrgServiceRequest,
  contract: Pick<OrgConsignmentContractListRow, 'code' | 'status' | 'created_at' | 'signed_at' | 'updated_at'> | null,
): HistoryEvent[] {
  const events: HistoryEvent[] = []
  const push = (e: HistoryEvent) => events.push(e)

  push({
    at: r.created_at,
    title: 'Chủ tài sản gửi yêu cầu ký gửi',
    sub: r.origin === 'platform' ? 'Qua sàn giới thiệu' : 'Gửi trực tiếp cho tổ chức',
    who: 'owner',
    tone: null,
  })
  if (r.seen_at) push({ at: r.seen_at, title: 'Bạn đã xem yêu cầu', sub: null, who: 'me', tone: null })
  if (r.quoted_at) {
    const total = r.quote_fee_items?.length ? feeTotalRequired(r.quote_fee_items) : r.quote_service_fee
    const parts = [
      r.quote_commission_pct != null ? `${r.quote_commission_pct}%` : null,
      total != null ? `tổng ${formatVnd(total)}` : null,
    ].filter(Boolean)
    push({ at: r.quoted_at, title: 'Bạn gửi báo giá', sub: parts.join(' · ') || null, who: 'me', tone: null })
  }
  if (r.reopened_at) {
    push({
      at: r.reopened_at,
      title: 'Yêu cầu được mở lại',
      sub: 'Hợp đồng với tổ chức được chọn trước đó đã huỷ',
      who: 'sys',
      tone: null,
    })
  }
  if (r.status === 'declined') {
    push({ at: r.updated_at, title: 'Bạn từ chối yêu cầu', sub: r.decline_reason, who: 'me', tone: 'err' })
  }
  if (r.status === 'not_selected') {
    push({ at: r.updated_at, title: 'Chủ tài sản chọn tổ chức khác', sub: null, who: 'owner', tone: null })
  }

  if (contract) {
    push({
      at: contract.created_at,
      title: 'Chủ tài sản chọn tổ chức của bạn',
      sub: contract.code ? `Hợp đồng ${contract.code} được khởi tạo` : null,
      who: 'owner',
      tone: 'ok',
    })
    if (contract.signed_at) {
      push({ at: contract.signed_at, title: 'Hợp đồng có hiệu lực', sub: null, who: 'sys', tone: 'ok' })
    }
    if (contract.status === 'cancelled') {
      push({ at: contract.updated_at, title: 'Hợp đồng ký gửi bị huỷ', sub: null, who: 'sys', tone: 'err' })
    }
  }

  return events.sort((a, b) => b.at.localeCompare(a.at))
}
