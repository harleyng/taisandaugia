// Trạng thái + luật của trang "Gửi báo giá" (/portal/yeu-cau-ky-gui/:id/bao-gia).
//
// Tách khỏi component để các con số trên thanh tổng kết, payload gửi đi và kiểm
// lỗi đọc cùng một công thức.

import { addDays, format } from 'date-fns'
import { FEE_ITEM_PRESETS, FINAL_MILESTONE_KEY, QUOTE_MILESTONES } from '@/constants/quote-plan'
import { emptyQuotePlan, feeTotalRequired, milestonesOutOfOrder, planLeadTimeDays } from '@/lib/quotePlan'
import type { AuctionFormat } from '@/types/asset-posting'
import type { OrgServiceRequest, QuoteFeeItem, QuotePlan, ServiceQuoteInput } from '@/types/consignment'

/** Một dòng chi phí đang nhập: `value` là chuỗi số VNĐ hoặc % tuỳ `unit` (chuỗi để gõ được "1."). */
export interface FeeRow {
  key: string
  label: string
  unit: 'vnd' | '%'
  value: string
  optional: boolean
}

export interface QuoteForm {
  plan: QuotePlan
  /** Ô "Khác" của kênh niêm yết đang bật (kể cả khi chưa gõ tên). */
  otherChannel: boolean
  commissionPct: string
  /** Chỉ dùng khi chủ tài sản nhờ định giá — còn lại giá do chủ tài sản đặt. */
  startingPrice: string
  fees: FeeRow[]
  note: string
  validUntil: string
}

/** Hiệu lực mặc định của một báo giá mới. */
const DEFAULT_VALID_DAYS = 30
const DEFAULT_COMMISSION_PCT = 1.5

export const isoDay = (d: Date) => format(d, 'yyyy-MM-dd')
export const isAppraisal = (r: OrgServiceRequest) => r.pricing_mode === 'appraisal'

const PRESET_BY_LABEL = new Map(FEE_ITEM_PRESETS.map((p) => [p.label.toLowerCase(), p.key]))

/** Gõ trùng nhãn gợi ý thì gán key của gợi ý đó, còn lại là 'khac'. */
export const feeKeyFor = (label: string) => PRESET_BY_LABEL.get(label.trim().toLowerCase()) ?? 'khac'

const toRow = (i: QuoteFeeItem): FeeRow => ({
  key: i.key,
  label: i.label,
  unit: i.unit === '%' ? '%' : 'vnd',
  value: String(i.unit === '%' ? (i.rate ?? '') : (Number(i.amount) || '')),
  optional: i.optional,
})

/** Báo giá mới mở sẵn phương án mặc định; báo giá đã gửi nạp lại nguyên trạng. */
export function initialQuoteForm(r: OrgServiceRequest): QuoteForm {
  const sent = !!r.quoted_at
  const plan: QuotePlan = r.quote_plan ?? {
    ...emptyQuotePlan((r.auction_format as AuctionFormat) ?? null),
    deposit_value: 10,
    channels: ['cong_tsdg', 'website_tc'],
    milestones: { tham_dinh: 7, niem_yet: 10, ban_ho_so: 15, mo_phien: r.quote_lead_time_days ?? 30 },
    scope_included: ['ho_so', 'niem_yet', 'dau_gia_vien'],
  }
  const pct = r.quote_commission_pct ?? (sent ? null : (r.commission_pct ?? DEFAULT_COMMISSION_PCT))

  return {
    plan,
    otherChannel: !!plan.channels_other,
    commissionPct: pct != null ? String(pct) : '',
    startingPrice: r.quote_starting_price != null ? String(r.quote_starting_price) : '',
    fees: r.quote_fee_items
      ? r.quote_fee_items.map(toRow)
      : sent
        ? []
        : [
            { key: 'phi_ho_so', label: 'Phí lập hồ sơ', unit: 'vnd', value: '1000000', optional: false },
            { key: 'phi_niem_yet', label: 'Phí niêm yết & thông báo', unit: 'vnd', value: '2000000', optional: false },
          ],
    note: r.quote_note ?? '',
    validUntil: r.quote_valid_until ?? isoDay(addDays(new Date(), DEFAULT_VALID_DAYS)),
  }
}

/** Giá khởi điểm làm gốc cho thù lao và các khoản theo %. */
export function basePrice(form: QuoteForm, r: OrgServiceRequest): number {
  return isAppraisal(r) ? Number(form.startingPrice) || 0 : (r.starting_price ?? 0)
}

export const feeAmount = (row: FeeRow, base: number) =>
  row.unit === '%' ? Math.round((base * (Number(row.value) || 0)) / 100) : Number(row.value) || 0

export const commissionAmount = (form: QuoteForm, base: number) =>
  Math.round((base * (Number(form.commissionPct) || 0)) / 100)

export function quoteTotals(form: QuoteForm, r: OrgServiceRequest) {
  const base = basePrice(form, r)
  const required = form.fees.filter((f) => !f.optional).reduce((s, f) => s + feeAmount(f, base), 0)
  const optional = form.fees.filter((f) => f.optional).reduce((s, f) => s + feeAmount(f, base), 0)
  const commission = commissionAmount(form, base)
  return { base, required, optional, commission, total: required + commission }
}

// ─── Mốc thời gian: ô nhập là KHOẢNG CÁCH giữa hai mốc, lưu là số ngày luỹ tiến ───

/** Khoảng cách của từng mốc so với mốc có giá trị liền trước (mốc đầu so với ngày ký). */
export function gapsFromMilestones(ms: QuotePlan['milestones']): (number | null)[] {
  let prev = 0
  return QUOTE_MILESTONES.map((m) => {
    const d = ms[m.key as keyof typeof ms]
    if (typeof d !== 'number') return null
    const gap = d - prev
    prev = d
    return gap
  })
}

/** Cộng dồn khoảng cách; ô trống (hoặc 0) thì mốc đó không có. */
export function milestonesFromGaps(gaps: (number | null)[]): QuotePlan['milestones'] {
  const out: QuotePlan['milestones'] = {}
  let acc = 0
  QUOTE_MILESTONES.forEach((m, i) => {
    const g = gaps[i]
    if (g) {
      acc += g
      out[m.key as keyof typeof out] = acc
    }
  })
  return out
}

// ─── Kiểm lỗi + payload ──────────────────────────────────────────────────────

export function validateQuoteForm(form: QuoteForm, r: OrgServiceRequest, today = isoDay(new Date())): string[] {
  const { plan } = form
  const errors: string[] = []
  const pct = Number(form.commissionPct)

  if (!plan.auction_format) errors.push('Chọn hình thức đấu giá đề xuất.')
  if (!plan.price_step) errors.push('Nhập bước giá.')
  if (!plan.deposit_value) errors.push('Nhập tiền đặt trước.')
  if (planLeadTimeDays(plan) == null) errors.push('Nhập mốc "Mở phiên".')
  if (milestonesOutOfOrder(plan)) errors.push('Các mốc thời gian phải tăng dần.')
  if (form.commissionPct.trim() === '' || Number.isNaN(pct)) errors.push('Nhập thù lao (%).')
  else if (pct < 0 || pct > 100) errors.push('Thù lao phải trong khoảng 0–100%.')
  if (isAppraisal(r) && !Number(form.startingPrice)) errors.push('Nhập giá khởi điểm đề xuất.')
  if (form.fees.some((f) => !f.label.trim())) errors.push('Đặt tên cho mọi khoản chi phí.')
  if (!form.validUntil || form.validUntil < today) errors.push('Hiệu lực báo giá phải từ hôm nay trở đi.')

  return errors
}

export function toQuoteInput(form: QuoteForm, r: OrgServiceRequest, docPath: string | null): ServiceQuoteInput {
  const base = basePrice(form, r)
  const feeItems: QuoteFeeItem[] = form.fees.map((f) => ({
    key: f.key,
    label: f.label.trim(),
    amount: feeAmount(f, base),
    optional: f.optional,
    ...(f.unit === '%' ? { unit: '%' as const, rate: Number(f.value) || 0 } : {}),
  }))
  const plan: QuotePlan = {
    ...form.plan,
    venue: form.plan.venue?.trim() || null,
    channels_other: form.otherChannel ? form.plan.channels_other?.trim() || null : null,
  }

  return {
    commission_pct: Number(form.commissionPct),
    // service_fee / lead_time_days là giá trị dẫn xuất — server tính lại từ
    // fee_items và plan.milestones, gửi kèm chỉ để tương thích.
    service_fee: feeTotalRequired(feeItems),
    starting_price: isAppraisal(r) ? Number(form.startingPrice) || null : null,
    lead_time_days: plan.milestones[FINAL_MILESTONE_KEY] ?? null,
    plan,
    fee_items: feeItems,
    note: form.note.trim() || undefined,
    doc_path: docPath ?? r.quote_doc_path ?? undefined,
    valid_until: form.validUntil,
  }
}
