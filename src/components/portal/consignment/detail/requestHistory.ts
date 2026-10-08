// "Lịch sử thao tác" của một yêu cầu ký gửi (design "Yeu Cau Ky Gui - Cong To Chuc v2").
// Ghép từ mốc thời gian của yêu cầu (RPC org_service_requests) và sự kiện hợp
// đồng (RPC org_consignment_contract) — không có bảng nhật ký riêng.

import { feeTotalRequired } from '@/lib/quotePlan'
import { formatVnd } from '@/lib/advertising/slug'
import { contractFileName } from '@/lib/consignment/contractFiles'
import type { OrgServiceRequest } from '@/types/consignment'
import type { ContractEvent, OrgContractDetail } from '@/types/consignment-contract'

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

const pathOf = (e: ContractEvent) => (typeof e.data?.path === 'string' ? contractFileName(e.data.path) : null)

function contractEvent(e: ContractEvent, detail: OrgContractDetail): HistoryEvent | null {
  const c = detail.contract
  const mine = e.side === 'org'
  const who: HistoryActor = e.side === 'org' ? 'me' : e.side === 'owner' ? 'owner' : 'sys'
  switch (e.action) {
    case 'created':
      return {
        at: e.created_at,
        title: 'Chủ tài sản chọn tổ chức của bạn',
        sub: c.code ? `Hợp đồng ${c.code} được khởi tạo` : null,
        who: 'owner',
        tone: 'ok',
      }
    case 'draft_shared':
      return { at: e.created_at, title: 'Bạn chia sẻ dự thảo hợp đồng', sub: pathOf(e), who: 'me', tone: null }
    case 'signed_uploaded':
      return {
        at: e.created_at,
        title: mine ? 'Bạn tải bản đã ký' : 'Chủ tài sản tải bản đã ký',
        sub: pathOf(e),
        who,
        tone: null,
      }
    case 'confirmed':
      return {
        at: e.created_at,
        title: mine ? 'Bạn xác nhận bản đã ký' : 'Chủ tài sản xác nhận bản đã ký',
        sub: null,
        who,
        tone: null,
      }
    case 'signed':
      return {
        at: e.created_at,
        title: 'Hợp đồng có hiệu lực',
        sub: c.contract_no ? `Số ${c.contract_no}` : null,
        who: 'sys',
        tone: 'ok',
      }
    case 'cancelled': {
      const reason = typeof e.data?.reason === 'string' ? e.data.reason : null
      return { at: e.created_at, title: 'Hợp đồng ký gửi bị huỷ', sub: reason, who, tone: 'err' }
    }
    default:
      return null
  }
}

/** Mới nhất lên đầu. */
export function buildRequestHistory(r: OrgServiceRequest, detail: OrgContractDetail | null): HistoryEvent[] {
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

  if (detail) {
    const fromEvents = detail.events.map((e) => contractEvent(e, detail)).filter((e): e is HistoryEvent => !!e)
    // Hợp đồng dựng trước khi có bảng sự kiện thì không có dòng 'created'.
    if (!detail.events.some((e) => e.action === 'created')) {
      fromEvents.push(contractEvent({ action: 'created', side: null, created_at: detail.contract.created_at, data: null }, detail)!)
    }
    events.push(...fromEvents)
  }

  return events.sort((a, b) => b.at.localeCompare(a.at))
}
