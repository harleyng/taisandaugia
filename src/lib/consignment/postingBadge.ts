// Chip "việc đang chờ" trên danh sách hồ sơ + badge nav của chủ tài sản.
//
// Bên QUYẾT ĐỊNH là RPC owner_consignment_summary (migration 20260912000007):
// nó tính `owner_action`. File này chỉ đổi kết quả đó ra nhãn — thêm loại hành
// động mới thì thêm ở CẢ HAI nơi.

import type { ConsignmentContractStatus } from '@/types/consignment-contract'

export type OwnerAction = 'confirm_contract' | 'add_address' | 'choose_quote' | 'add_orgs' | 'send_orgs'

/**
 * Việc được đếm vào số của menu "Ký gửi đấu giá" và tab "Cần bạn xử lý".
 * Hai việc hợp đồng (confirm_contract, add_address) còn ở đây cho tới khi menu
 * "Hợp đồng" có trang hợp đồng ký gửi — khi đó bỏ khỏi danh sách này.
 */
// confirm_contract / add_address là việc của HỢP ĐỒNG — đếm ở menu "Hợp đồng"
// (useOwnerContractActionCount), không đếm lại ở menu Ký gửi.
const CONSIGNMENT_OWNER_ACTIONS: readonly OwnerAction[] = [
  'choose_quote',
  'add_orgs',
  'send_orgs',
]

export function isConsignmentOwnerAction(action: OwnerAction | null | undefined): action is OwnerAction {
  return !!action && CONSIGNMENT_OWNER_ACTIONS.includes(action)
}

export interface OwnerConsignmentSummaryRow {
  posting_id: string
  quoted_count: number
  has_selection: boolean
  contract_id: string | null
  contract_status: ConsignmentContractStatus | null
  owner_action: OwnerAction | null
}

export interface PostingBadge {
  label: string
  className: string
  /** Chủ tài sản đang phải làm gì đó — đếm vào badge nav. */
  needsAction: boolean
}

export function postingBadge(row: OwnerConsignmentSummaryRow | null | undefined): PostingBadge | null {
  if (!row) return null
  switch (row.owner_action) {
    case 'confirm_contract':
      return { label: 'Chờ bạn xác nhận hợp đồng', className: 'bg-warning/10 text-warning', needsAction: true }
    case 'add_address':
      return { label: 'Cần bổ sung địa chỉ', className: 'bg-warning/10 text-warning', needsAction: true }
    case 'choose_quote':
      return {
        label: `Chờ bạn chọn báo giá (${row.quoted_count})`,
        className: 'bg-accent/20 text-foreground',
        needsAction: true,
      }
    case 'add_orgs':
      return { label: 'Cần gửi thêm tổ chức', className: 'bg-destructive/10 text-destructive', needsAction: true }
    case 'send_orgs':
      return { label: 'Chưa gửi tổ chức', className: 'bg-warning/10 text-warning', needsAction: true }
  }
  if (row.contract_status === 'signed') {
    return { label: 'Đã ký hợp đồng', className: 'bg-success/10 text-success', needsAction: false }
  }
  if (row.contract_status && row.contract_status !== 'cancelled') {
    return { label: 'Đang lập hợp đồng', className: 'bg-primary/10 text-primary', needsAction: false }
  }
  return null
}

export function ownerActionCount(rows: OwnerConsignmentSummaryRow[]): number {
  return rows.filter((r) => isConsignmentOwnerAction(r.owner_action)).length
}
