import { describe, expect, it } from 'vitest'
import { BLANK, buildContractDocDefinition } from './document'
import { buildContractPdfInput, contractDraftFileName, type ContractPdfInput } from './input'
import { formatVnd } from '@/lib/advertising/slug'
import type { OrgContractDetail } from '@/types/consignment-contract'

/** Gom mọi chuỗi văn bản trong cây nội dung (text + mục ul). */
function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node)
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((n) => texts(n, out))
    return out
  }
  if (node && typeof node === 'object') {
    Object.values(node as Record<string, unknown>).forEach((v) => texts(v, out))
  }
  return out
}

const base: ContractPdfInput = {
  code: 'HDKG000007',
  contractNo: null,
  owner: { kind: 'individual', full_name: 'Trần Thị B', id_type: 'cccd', id_number: '012345678901', phone: '0912345678', email: 'b@example.com', address: null },
  org: {
    name: 'Công ty Đấu giá Hợp danh X', tax_code: '0101010101', address: '1 Tràng Tiền', ward: null, district: null,
    province: 'Hà Nội', phone: '024 000', email: 'x@dg.vn', legal_rep_name: 'Lê Văn C', legal_rep_position: 'Giám đốc',
  },
  asset: {
    title: 'Căn hộ 2PN tầng 12', parent_slug: 'bat-dong-san', child_slug: 'can-ho', address: '12 Lê Lợi', ward: null,
    district: 'Quận 1', province: 'TP. Hồ Chí Minh', starting_price: 3_000_000_000, pricing_mode: 'self',
    auction_format: 'truc_tiep', has_dispute: false, has_mortgage: true, is_seized: null, right_to_sell: true, legal_notes: null,
  },
  terms: {
    commission_pct: 1.5,
    // CỐ Ý khác tổng các khoản bắt buộc (3,000,000): bản in phải in số server đã chốt.
    service_fee: 2_500_000,
    starting_price: null,
    lead_time_days: 30,
    plan: {
      auction_format: 'truc_tiep', price_step: 10_000_000, deposit_mode: 'percent', deposit_value: 10, venue: 'Trụ sở Bên B',
      channels: [], channels_other: null, milestones: { mo_phien: 30 }, scope_included: [], scope_excluded: [],
    },
    fee_items: [
      { key: 'phi_ho_so', label: 'Phí hồ sơ', amount: 1_000_000, optional: false },
      { key: 'phi_niem_yet', label: 'Phí niêm yết', amount: 2_000_000, optional: false },
      { key: 'khac', label: 'Quảng cáo mở rộng', amount: 5_000_000, optional: true },
    ],
    note: null,
    quote_doc_path: null,
    quoted_at: '2026-09-01T00:00:00Z',
  },
  categoryLabel: 'Căn hộ',
  generatedAt: new Date('2026-09-11T03:00:00Z'),
}

const all = (i: ContractPdfInput) => {
  const dd = buildContractDocDefinition(i)
  return { dd, strings: texts(dd.content) }
}

describe('buildContractDocDefinition', () => {
  it('có tiêu đề, hai bên, người ký và dấu DỰ THẢO', () => {
    const { dd, strings } = all(base)
    expect(strings).toContain('HỢP ĐỒNG DỊCH VỤ ĐẤU GIÁ TÀI SẢN')
    expect(strings).toContain('Trần Thị B')
    expect(strings).toContain('Công ty Đấu giá Hợp danh X'.toUpperCase())
    expect(strings.filter((s) => s === 'Lê Văn C').length).toBeGreaterThanOrEqual(2) // Bên B + chữ ký
    expect((dd.watermark as { text: string }).text).toBe('DỰ THẢO')
  })

  it('tổng chi phí in đúng số server đã chốt, KHÔNG tự cộng lại', () => {
    const { strings } = all(base)
    expect(strings).toContain(`Tổng chi phí bắt buộc: ${formatVnd(2_500_000)}`)
    expect(strings.some((s) => s.includes(formatVnd(3_000_000)) && s.includes('Tổng'))).toBe(false)
    expect(strings).toContain('Tuỳ chọn')
  })

  it('giá khởi điểm lấy từ báo giá, thiếu thì lùi về hồ sơ', () => {
    expect(all(base).strings).toContain(`Giá khởi điểm của tài sản: ${formatVnd(3_000_000_000)}.`)
    const proposed = { ...base, terms: { ...base.terms, starting_price: 2_800_000_000 } }
    expect(all(proposed).strings).toContain(`Giá khởi điểm của tài sản: ${formatVnd(2_800_000_000)}.`)
  })

  it('mốc thời gian tính từ ngày ký hợp đồng', () => {
    expect(all(base).strings.some((s) => s.includes('trong vòng 30 ngày kể từ ngày ký hợp đồng'))).toBe(true)
  })

  it('thiếu dữ liệu thì để chỗ trống điền tay, không in "null"', () => {
    const { strings } = all(base)
    expect(strings).toContain(BLANK) // địa chỉ Bên A
    expect(strings.some((s) => /null|undefined/.test(s))).toBe(false)
    expect(strings.some((s) => s.startsWith('Số: ……/……/HĐDV'))).toBe(true)
  })

  it('chủ tài sản là tổ chức ⇒ in người đại diện và ký thay', () => {
    const orgOwner: ContractPdfInput = {
      ...base,
      owner: { kind: 'organization', org_name: 'Ngân hàng Y', tax_code: '0300', rep_full_name: 'Phạm D', rep_title: 'Giám đốc chi nhánh', address: '5 Nguyễn Huệ', province: 'TP. HCM' },
    }
    const { strings } = all(orgOwner)
    expect(strings).toContain('Ngân hàng Y')
    expect(strings.filter((s) => s === 'Phạm D').length).toBeGreaterThanOrEqual(2)
  })
})

describe('buildContractPdfInput', () => {
  const detail = {
    contract: { code: 'HDKG000007', contract_no: 'HĐ-01', terms: base.terms, org_party: base.org },
    owner_party: base.owner,
    asset: base.asset,
  } as unknown as OrgContractDetail

  it('dựng từ bản chiếu hợp đồng', () => {
    const input = buildContractPdfInput(detail, { categoryLabel: 'Căn hộ', now: base.generatedAt })
    expect(input.contractNo).toBe('HĐ-01')
    expect(input.owner.full_name).toBe('Trần Thị B')
    expect(contractDraftFileName(input)).toBe('Du-thao-HDDV_HDKG000007.pdf')
  })

  it('hợp đồng đã huỷ (không còn thấy chủ tài sản) thì không dựng', () => {
    expect(() => buildContractPdfInput({ ...detail, owner_party: null })).toThrow(/không tạo được/)
  })
})
