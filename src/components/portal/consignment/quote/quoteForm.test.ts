import { describe, expect, it } from 'vitest'
import type { OrgServiceRequest } from '@/types/consignment'
import {
  gapsFromMilestones, initialQuoteForm, milestonesFromGaps, quoteTotals, toQuoteInput, validateQuoteForm,
} from './quoteForm'

const req = (over: Partial<OrgServiceRequest> = {}) =>
  ({
    id: 'r1', status: 'seen', quoted_at: null, pricing_mode: 'fixed', starting_price: 2_000_000_000,
    auction_format: 'truc_tuyen', commission_pct: 1.8, quote_plan: null, quote_fee_items: null,
    quote_commission_pct: null, quote_starting_price: null, quote_lead_time_days: null, quote_note: null,
    quote_doc_path: null, quote_valid_until: null, ...over,
  }) as OrgServiceRequest

describe('mốc thời gian', () => {
  it('khoảng cách ↔ số ngày luỹ tiến khứ hồi được', () => {
    const ms = { tham_dinh: 7, niem_yet: 10, ban_ho_so: 15, mo_phien: 30 }
    expect(gapsFromMilestones(ms)).toEqual([7, 3, 5, 15])
    expect(milestonesFromGaps([7, 3, 5, 15])).toEqual(ms)
  })

  it('mốc trống ở giữa: khoảng sau tính từ mốc có giá trị liền trước', () => {
    const ms = { tham_dinh: 7, mo_phien: 30 }
    expect(gapsFromMilestones(ms)).toEqual([7, null, null, 23])
    expect(milestonesFromGaps(gapsFromMilestones(ms))).toEqual(ms)
  })
})

describe('initialQuoteForm', () => {
  it('báo giá mới mở sẵn mặc định của design, thù lao theo mức chủ TS chấp nhận', () => {
    const f = initialQuoteForm(req())
    expect(f.commissionPct).toBe('1.8')
    expect(f.plan.milestones.mo_phien).toBe(30)
    expect(f.fees).toHaveLength(2)
    expect(validateQuoteForm({ ...f, plan: { ...f.plan, price_step: 1_000_000 } }, req(), '2026-10-10')).toEqual([])
  })
})

describe('chi phí', () => {
  it('khoản theo % quy ra VNĐ theo giá khởi điểm, giữ rate để sửa lại', () => {
    const r = req()
    const f = { ...initialQuoteForm(r), fees: [{ key: 'khac', label: 'Phí x', unit: '%' as const, value: '0.5', optional: false }] }
    expect(quoteTotals(f, r)).toMatchObject({ required: 10_000_000, commission: 36_000_000, total: 46_000_000 })
    const input = toQuoteInput(f, r, null)
    expect(input.fee_items).toEqual([{ key: 'khac', label: 'Phí x', amount: 10_000_000, optional: false, unit: '%', rate: 0.5 }])
    expect(input.service_fee).toBe(10_000_000)
    expect(input.starting_price).toBeNull()
    expect(initialQuoteForm({ ...r, quoted_at: 'x', quote_fee_items: input.fee_items! }).fees[0].value).toBe('0.5')
  })

  it('nhờ định giá: bắt nhập giá khởi điểm và dùng nó làm gốc', () => {
    const r = req({ pricing_mode: 'appraisal', starting_price: null })
    const f = { ...initialQuoteForm(r), plan: { ...initialQuoteForm(r).plan, price_step: 1 } }
    expect(validateQuoteForm(f, r, '2026-10-10')).toContain('Nhập giá khởi điểm đề xuất.')
    expect(toQuoteInput({ ...f, startingPrice: '500000000' }, r, null).starting_price).toBe(500_000_000)
  })
})
