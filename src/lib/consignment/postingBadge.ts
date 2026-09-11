// Chip "việc đang chờ" trên danh sách hồ sơ + badge nav của chủ tài sản.
//
// Bên QUYẾT ĐỊNH là RPC owner_consignment_summary (migration 20260912000007):
// nó tính `owner_action`. File này chỉ đổi kết quả đó ra nhãn — thêm loại hành
// động mới thì thêm ở CẢ HAI nơi.

import type { ConsignmentContractStatus } from '@/types/consignment-contract'

export type OwnerAction = 'confirm_contract' | 'add_address' | 'choose_quote'

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
  return rows.filter((r) => r.owner_action !== null).length
}
