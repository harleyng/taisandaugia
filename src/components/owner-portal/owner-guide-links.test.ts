import { describe, expect, it } from 'vitest'
import { OWNER_GUIDES, ownerGuideUrl } from './owner-guide-links'

describe('ownerGuideUrl', () => {
  it('4 trang nhóm Điều hành ⇒ mở thẳng mục của nó', () => {
    expect(ownerGuideUrl('/chu-tai-san/dashboard')).toBe(`${OWNER_GUIDES.dieuHanh}#tong-quan`)
    expect(ownerGuideUrl('/chu-tai-san/chi-tieu')).toBe(`${OWNER_GUIDES.dieuHanh}#chi-tieu`)
    expect(ownerGuideUrl('/chu-tai-san/tai-san')).toBe(`${OWNER_GUIDES.dieuHanh}#tai-san`)
    expect(ownerGuideUrl('/chu-tai-san/ket-qua')).toBe(`${OWNER_GUIDES.dieuHanh}#ket-qua`)
  })

  it('4 trang nhóm Tác nghiệp ⇒ Sổ tay Tác nghiệp', () => {
    expect(ownerGuideUrl('/chu-tai-san/dang-tai-san')).toBe(`${OWNER_GUIDES.tacNghiep}#so-hoa`)
    expect(ownerGuideUrl('/chu-tai-san/ky-gui-dau-gia')).toBe(`${OWNER_GUIDES.tacNghiep}#ky-gui`)
    expect(ownerGuideUrl('/chu-tai-san/hop-dong')).toBe(`${OWNER_GUIDES.tacNghiep}#hop-dong`)
    expect(ownerGuideUrl('/chu-tai-san/thu-tien')).toBe(`${OWNER_GUIDES.tacNghiep}#thu-tien`)
  })

  it('3 trang nhóm Phân tích ⇒ Sổ tay Phân tích', () => {
    expect(ownerGuideUrl('/chu-tai-san/bao-cao')).toBe(`${OWNER_GUIDES.phanTich}#phan-tich`)
    expect(ownerGuideUrl('/chu-tai-san/dong-tien')).toBe(`${OWNER_GUIDES.phanTich}#dong-tien`)
    expect(ownerGuideUrl('/chu-tai-san/bao-cao-dinh-ky')).toBe(`${OWNER_GUIDES.phanTich}#bao-cao-dinh-ky`)
  })

  it('6 trang nhóm Thiết lập ⇒ Sổ tay Thiết lập', () => {
    expect(ownerGuideUrl('/chu-tai-san/chi-nhanh-amc')).toBe(`${OWNER_GUIDES.thietLap}#chi-nhanh`)
    expect(ownerGuideUrl('/chu-tai-san/thanh-vien')).toBe(`${OWNER_GUIDES.thietLap}#thanh-vien`)
    expect(ownerGuideUrl('/chu-tai-san/vai-tro')).toBe(`${OWNER_GUIDES.thietLap}#vai-tro`)
    expect(ownerGuideUrl('/chu-tai-san/lien-ket')).toBe(`${OWNER_GUIDES.thietLap}#lien-ket`)
    expect(ownerGuideUrl('/chu-tai-san/goi-thue-bao')).toBe(`${OWNER_GUIDES.thietLap}#goi-thue-bao`)
    expect(ownerGuideUrl('/chu-tai-san/credits')).toBe(`${OWNER_GUIDES.thietLap}#credit`)
  })

  it('trang con dùng chung mục của trang gốc', () => {
    expect(ownerGuideUrl('/chu-tai-san/chi-tieu/moi')).toBe(`${OWNER_GUIDES.dieuHanh}#chi-tieu`)
    expect(ownerGuideUrl('/chu-tai-san/chi-tieu/abc/sua')).toBe(`${OWNER_GUIDES.dieuHanh}#chi-tieu`)
    expect(ownerGuideUrl('/chu-tai-san/bao-cao-dinh-ky/abc')).toBe(`${OWNER_GUIDES.phanTich}#bao-cao-dinh-ky`)
    expect(ownerGuideUrl('/chu-tai-san/vai-tro/abc')).toBe(`${OWNER_GUIDES.thietLap}#vai-tro`)
  })

  it('trang chưa có hướng dẫn hoặc ngoài cổng ⇒ không có link', () => {
    expect(ownerGuideUrl('/chu-tai-san/khong-co')).toBeUndefined()
    expect(ownerGuideUrl('/chu-tai-san')).toBeUndefined()
    expect(ownerGuideUrl('/portal/dashboard')).toBeUndefined()
  })
})
