import { describe, expect, it } from 'vitest'
import { OWNER_GUIDE_CENTER, ownerGuideUrl } from './owner-guide-links'

const at = (anchor: string) => `${OWNER_GUIDE_CENTER}#${anchor}`

describe('ownerGuideUrl', () => {
  it('nhóm Điều hành ⇒ mở thẳng mục của nó', () => {
    expect(ownerGuideUrl('/chu-tai-san/dashboard')).toBe(at('tong-quan'))
    expect(ownerGuideUrl('/chu-tai-san/chi-tieu')).toBe(at('chi-tieu'))
    expect(ownerGuideUrl('/chu-tai-san/tai-san')).toBe(at('tai-san'))
    expect(ownerGuideUrl('/chu-tai-san/ket-qua')).toBe(at('ket-qua'))
  })

  it('nhóm Tác nghiệp, gồm Truyền thông và Đối tác của tôi', () => {
    expect(ownerGuideUrl('/chu-tai-san/dang-tai-san')).toBe(at('so-hoa'))
    expect(ownerGuideUrl('/chu-tai-san/ky-gui-dau-gia')).toBe(at('ky-gui'))
    expect(ownerGuideUrl('/chu-tai-san/truyen-thong')).toBe(at('truyen-thong'))
    expect(ownerGuideUrl('/chu-tai-san/hop-dong')).toBe(at('hop-dong'))
    expect(ownerGuideUrl('/chu-tai-san/thu-tien')).toBe(at('thu-tien'))
    expect(ownerGuideUrl('/chu-tai-san/doi-tac')).toBe(at('doi-tac'))
  })

  it('nhóm Phân tích, gồm Hiệu quả quảng cáo', () => {
    expect(ownerGuideUrl('/chu-tai-san/bao-cao')).toBe(at('phan-tich'))
    expect(ownerGuideUrl('/chu-tai-san/dong-tien')).toBe(at('dong-tien'))
    expect(ownerGuideUrl('/chu-tai-san/hieu-qua-quang-cao')).toBe(at('hieu-qua-quang-cao'))
    expect(ownerGuideUrl('/chu-tai-san/bao-cao-dinh-ky')).toBe(at('bao-cao-dinh-ky'))
  })

  it('nhóm Thiết lập, gồm Nhật ký hoạt động', () => {
    expect(ownerGuideUrl('/chu-tai-san/chi-nhanh-amc')).toBe(at('chi-nhanh'))
    expect(ownerGuideUrl('/chu-tai-san/thanh-vien')).toBe(at('thanh-vien'))
    expect(ownerGuideUrl('/chu-tai-san/vai-tro')).toBe(at('vai-tro'))
    expect(ownerGuideUrl('/chu-tai-san/lien-ket')).toBe(at('lien-ket'))
    expect(ownerGuideUrl('/chu-tai-san/nhat-ky')).toBe(at('nhat-ky'))
    expect(ownerGuideUrl('/chu-tai-san/goi-thue-bao')).toBe(at('goi-thue-bao'))
    expect(ownerGuideUrl('/chu-tai-san/credits')).toBe(at('credit'))
  })

  it('trang con dùng chung mục của trang gốc', () => {
    expect(ownerGuideUrl('/chu-tai-san/chi-tieu/moi')).toBe(at('chi-tieu'))
    expect(ownerGuideUrl('/chu-tai-san/chi-tieu/abc/sua')).toBe(at('chi-tieu'))
    expect(ownerGuideUrl('/chu-tai-san/bao-cao-dinh-ky/abc')).toBe(at('bao-cao-dinh-ky'))
    expect(ownerGuideUrl('/chu-tai-san/vai-tro/abc')).toBe(at('vai-tro'))
    expect(ownerGuideUrl('/chu-tai-san/truyen-thong/chien-dich/abc')).toBe(at('truyen-thong'))
    expect(ownerGuideUrl('/chu-tai-san/goi-thue-bao/cac-goi')).toBe(at('goi-thue-bao'))
  })

  it('trang chưa có hướng dẫn hoặc ngoài cổng ⇒ không có link', () => {
    expect(ownerGuideUrl('/chu-tai-san/khong-co')).toBeUndefined()
    expect(ownerGuideUrl('/chu-tai-san')).toBeUndefined()
    expect(ownerGuideUrl('/portal/dashboard')).toBeUndefined()
  })
})
