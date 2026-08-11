import { describe, it, expect } from 'vitest'
import { buildDocDefinition } from './document'
import type { DossierBundle } from '../dossier-bundle'
import type { DossierImages } from './images'
import { DEFAULT_SECTIONS, SECTION_ORDER, type DossierSectionId } from '../dossier-templates'
import type { Auctioneer } from '@/types/auctioneer'

const person = {
  id: 'a1', orgId: 'o1', source: 'MANUAL', isVerifiedByPublicSource: false,
  fullName: 'Nguyễn Văn A', professionalCertNumber: 'CC-1', licenseNumber: 'ĐGV-1234',
  licenseIssuedDate: '2015-03-01', joinedDate: '2016-01-01',
  fieldSources: {} as Auctioneer['fieldSources'], overrides: [],
  position: 'AUCTIONEER', contractType: 'OFFICIAL', isActive: true, attachedDocuments: [],
  createdAt: '2020-01-01', updatedAt: '2020-01-01',
} as Auctioneer

const bundle: DossierBundle = { person, documents: [], events: [], auctions: [] }
const img: DossierImages = { portrait: null, docScans: {} }

/** Gom toàn bộ chuỗi văn bản trong cây nội dung để dò tiêu đề mục. */
function texts(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) { node.forEach((n) => texts(n, out)); return out }
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    if (typeof o.text === 'string') out.push(o.text)
    Object.values(o).forEach((v) => { if (v && typeof v === 'object') texts(v, out) })
  }
  return out
}

const has = (dd: ReturnType<typeof buildDocDefinition>, needle: string) =>
  texts(dd.content).some((t) => t.toUpperCase().includes(needle.toUpperCase()))

const breaks = (dd: ReturnType<typeof buildDocDefinition>) =>
  (dd.content as unknown as Array<Record<string, unknown>>).filter((c) => c?.pageBreak === 'before').length

describe('buildDocDefinition', () => {
  it('in đủ tám mục khi chọn hết', () => {
    const dd = buildDocDefinition(bundle, 'CTĐG X', img, {
      template: 'FULL', sections: [...SECTION_ORDER],
    })
    expect(has(dd, 'Sở trường tài sản')).toBe(true)
    expect(has(dd, 'Bồi dưỡng nghiệp vụ')).toBe(true)
    expect(has(dd, 'Thông tin hành nghề')).toBe(true)
    expect(has(dd, 'Phụ lục')).toBe(true)
    // Mẫu Năng lực: trang 1 · trang bồi dưỡng · phụ lục ⇒ hai lần ngắt trang.
    expect(breaks(dd)).toBe(2)
  })

  it('bỏ mục thì không dựng mục đó', () => {
    const dd = buildDocDefinition(bundle, 'CTĐG X', img, {
      template: 'FULL', sections: ['identity', 'practice'],
    })
    expect(has(dd, 'Bồi dưỡng nghiệp vụ')).toBe(false)
    expect(has(dd, 'Phụ lục')).toBe(false)
    expect(has(dd, 'Thông tin định danh')).toBe(true)
  })

  it('bỏ hết mục của một nhóm thì KHÔNG ngắt trang (không để trang trắng)', () => {
    // Chỉ còn mục thuộc nhóm trang 1 ⇒ file một mạch, không ngắt.
    const only1 = buildDocDefinition(bundle, 'CTĐG X', img, {
      template: 'FULL', sections: ['strengths', 'education'],
    })
    expect(breaks(only1)).toBe(0)

    // Bỏ cả nhóm 2, giữ phụ lục ⇒ đúng MỘT lần ngắt cho phụ lục.
    const skipMid = buildDocDefinition(bundle, 'CTĐG X', img, {
      template: 'FULL', sections: ['strengths', 'annex'],
    })
    expect(breaks(skipMid)).toBe(1)
  })

  it('hero và dải chỉ số luôn có, kể cả khi không tick mục nào', () => {
    const dd = buildDocDefinition(bundle, 'CTĐG X', img, { template: 'FULL', sections: [] })
    expect(has(dd, 'Nguyễn Văn A')).toBe(true)
    expect(has(dd, 'Cuộc đã điều hành')).toBe(true)
    expect(breaks(dd)).toBe(0)
  })

  it('mẫu Hành chính đánh số La Mã theo thứ tự mục ĐÃ CHỌN', () => {
    const dd = buildDocDefinition(bundle, 'CTĐG X', img, {
      template: 'FORMAL', sections: ['notable', 'identity'],
    })
    const all = texts(dd.content)
    expect(all.some((t) => t.startsWith('I. CUỘC ĐẤU GIÁ TIÊU BIỂU'))).toBe(true)
    expect(all.some((t) => t.startsWith('II. THÔNG TIN ĐỊNH DANH'))).toBe(true)
  })

  it('thứ tự in theo SECTION_ORDER, không theo thứ tự người dùng tick', () => {
    const dd = buildDocDefinition(bundle, 'CTĐG X', img, {
      template: 'FORMAL', sections: ['practice', 'strengths'] as DossierSectionId[],
    })
    const all = texts(dd.content)
    const iStrength = all.findIndex((t) => t.includes('SỞ TRƯỜNG'))
    const iPractice = all.findIndex((t) => t.includes('THÔNG TIN HÀNH NGHỀ'))
    expect(iStrength).toBeGreaterThanOrEqual(0)
    expect(iStrength).toBeLessThan(iPractice)
  })

  it('chỉ mẫu Năng lực vẽ nền hero tràn lề', () => {
    const bg = (tpl: 'FULL' | 'FORMAL' | 'COMPACT') => {
      const dd = buildDocDefinition(bundle, 'CTĐG X', img, {
        template: tpl, sections: [...DEFAULT_SECTIONS[tpl]],
      })
      return typeof dd.background === 'function' ? dd.background(1, { width: 0, height: 0, orientation: 'portrait' }) : dd.background
    }
    expect(bg('FULL')).not.toBe('')
    expect(bg('FORMAL')).toBe('')
    expect(bg('COMPACT')).toBe('')
  })

  it('mẫu Tối giản mặc định bỏ phụ lục', () => {
    expect(DEFAULT_SECTIONS.COMPACT).not.toContain('annex')
    const dd = buildDocDefinition(bundle, 'CTĐG X', img, {
      template: 'COMPACT', sections: [...DEFAULT_SECTIONS.COMPACT],
    })
    expect(has(dd, 'Phụ lục')).toBe(false)
    expect(breaks(dd)).toBe(0)
  })
})
