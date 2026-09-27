import { describe, expect, it } from 'vitest'
import { isConsignmentOwnerAction, ownerActionCount, postingBadge, type OwnerConsignmentSummaryRow } from './postingBadge'

const row = (over: Partial<OwnerConsignmentSummaryRow> = {}): OwnerConsignmentSummaryRow => ({
  posting_id: 'p1',
  quoted_count: 0,
  has_selection: false,
  contract_id: null,
  contract_status: null,
  owner_action: null,
  ...over,
})

describe('postingBadge', () => {
  it('việc cần làm đứng trước trạng thái', () => {
    expect(postingBadge(row({ owner_action: 'confirm_contract', contract_status: 'awaiting_confirmation' }))?.label)
      .toBe('Chờ bạn xác nhận hợp đồng')
    expect(postingBadge(row({ owner_action: 'add_address', contract_status: 'drafting' }))?.needsAction).toBe(true)
    expect(postingBadge(row({ owner_action: 'choose_quote', quoted_count: 3 }))?.label).toBe('Chờ bạn chọn báo giá (3)')
  })

  it('không có việc: hiện trạng thái hợp đồng, huỷ thì không hiện gì', () => {
    expect(postingBadge(row({ contract_status: 'signed' }))).toMatchObject({ label: 'Đã ký hợp đồng', needsAction: false })
    expect(postingBadge(row({ contract_status: 'awaiting_signatures' }))?.label).toBe('Đang lập hợp đồng')
    expect(postingBadge(row({ contract_status: 'cancelled' }))).toBeNull()
    expect(postingBadge(row())).toBeNull()
    expect(postingBadge(undefined)).toBeNull()
  })

  it('badge nav đếm số hồ sơ đang chờ chủ tài sản', () => {
    expect(ownerActionCount([row({ owner_action: 'choose_quote' }), row({ contract_status: 'signed' }), row({ owner_action: 'send_orgs' })])).toBe(2)
  })

  it('việc của hợp đồng (xác nhận bản ký, bổ sung địa chỉ) đếm ở menu Hợp đồng, không ở Ký gửi', () => {
    expect(isConsignmentOwnerAction('confirm_contract')).toBe(false)
    expect(isConsignmentOwnerAction('add_address')).toBe(false)
    expect(ownerActionCount([row({ owner_action: 'confirm_contract' }), row({ owner_action: 'add_address' })])).toBe(0)
  })

  it('chưa gửi / cần gửi thêm cũng là việc của chủ tài sản (thiết kế Ký gửi)', () => {
    expect(postingBadge(row({ owner_action: 'send_orgs' }))).toMatchObject({ label: 'Chưa gửi tổ chức', needsAction: true })
    expect(postingBadge(row({ owner_action: 'add_orgs' }))).toMatchObject({ label: 'Cần gửi thêm tổ chức', needsAction: true })
    expect(isConsignmentOwnerAction('send_orgs')).toBe(true)
    expect(isConsignmentOwnerAction(null)).toBe(false)
    expect(ownerActionCount([row({ owner_action: 'send_orgs' }), row({ owner_action: 'add_orgs' }), row()])).toBe(2)
  })
})
