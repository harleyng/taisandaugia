import { describe, expect, it } from 'vitest'
import { OWNER_NAV_GROUPS, activeOwnerNavChild, ownerModulesForPath, visibleOwnerNavGroups } from './owner-nav-config'
import { HQ_VIEW_MATRIX, VIEWER_DEFAULT_MATRIX, type OwnerModule } from '@/lib/ownerWorkspace/permissions'

const labels = (canView: (m: OwnerModule) => boolean) =>
  visibleOwnerNavGroups(OWNER_NAV_GROUPS, canView).flatMap((g) => g.items.map((i) => i.label))

describe('visibleOwnerNavGroups', () => {
  it('đủ quyền xem ⇒ đủ menu, có mục Vai trò', () => {
    const all = labels(() => true)
    expect(all).toContain('Vai trò')
    expect(all).toHaveLength(OWNER_NAV_GROUPS.flatMap((g) => g.items).length)
  })

  it('vai trò chỉ xem Thu tiền ⇒ chỉ còn Tổng quan, Thu tiền, Nhật ký, Gói dịch vụ, Credit; nhóm rỗng bị bỏ', () => {
    const groups = visibleOwnerNavGroups(OWNER_NAV_GROUPS, (m) => m === 'thu-tien')
    // Nhật ký hoạt động luôn hiện: ai cũng xem được thao tác của chính mình.
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toEqual([
      'Tổng quan',
      'Thu tiền',
      'Nhật ký hoạt động',
      'Gói dịch vụ',
      'Credit',
    ])
    expect(groups.map((g) => g.id)).toEqual(['dieu-hanh', 'tac-nghiep', 'thiet-lap'])
  })

  it('"Hợp đồng" hiện khi xem được một trong ký gửi / mua bán / số hoá', () => {
    expect(labels((m) => m === 'hop-dong-mua-ban')).toContain('Hợp đồng')
    expect(labels((m) => m === 'phan-tich')).not.toContain('Hợp đồng')
  })

  it('"Truyền thông" theo module truyen-thong, nằm trong nhóm Tác nghiệp', () => {
    const groups = visibleOwnerNavGroups(OWNER_NAV_GROUPS, (m) => m === 'truyen-thong')
    expect(groups.map((g) => g.id)).toContain('tac-nghiep')
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toContain('Truyền thông')
    expect(labels((m) => m === 'thu-tien')).not.toContain('Truyền thông')
    expect(labels((m) => !!VIEWER_DEFAULT_MATRIX[m])).toContain('Truyền thông')
  })

  it('"Đối tác của tôi" theo quyền xem Phân tích danh mục, nằm trong nhóm Tác nghiệp', () => {
    const groups = visibleOwnerNavGroups(OWNER_NAV_GROUPS, (m) => m === 'phan-tich')
    expect(groups.find((g) => g.id === 'tac-nghiep')?.items.map((i) => i.label)).toContain('Đối tác của tôi')
    expect(OWNER_NAV_GROUPS.find((g) => g.id === 'phan-tich')?.items.map((i) => i.label)).not.toContain(
      'Đối tác của tôi',
    )
    expect(labels((m) => m === 'dong-tien')).not.toContain('Đối tác của tôi')
    expect(ownerModulesForPath('/chu-tai-san/doi-tac')).toEqual(['phan-tich'])
  })

  it('"Hiệu quả quảng cáo" nằm trong nhóm Phân tích, theo quyền xem Truyền thông', () => {
    const groups = visibleOwnerNavGroups(OWNER_NAV_GROUPS, (m) => m === 'truyen-thong')
    expect(groups.find((g) => g.id === 'phan-tich')?.items.map((i) => [i.label, i.href])).toEqual([
      ['Hiệu quả quảng cáo', '/chu-tai-san/hieu-qua-quang-cao'],
    ])
    expect(labels((m) => m === 'phan-tich')).not.toContain('Hiệu quả quảng cáo')
    expect(ownerModulesForPath('/chu-tai-san/hieu-qua-quang-cao')).toEqual(['truyen-thong'])
  })

  it('trụ sở đã liên kết không thấy Thành viên / Vai trò / Liên kết', () => {
    const hq = labels((m) => !!HQ_VIEW_MATRIX[m])
    expect(hq).not.toContain('Thành viên')
    expect(hq).not.toContain('Vai trò')
    expect(hq).not.toContain('Liên kết')
    expect(labels((m) => !!VIEWER_DEFAULT_MATRIX[m])).toContain('Vai trò')
  })
})

describe('Truyền thông — 3 mục con = 3 tab', () => {
  const mkt = OWNER_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.label === 'Truyền thông')!
  const base = '/chu-tai-san/truyen-thong'

  it('đúng 3 mục con, theo thứ tự tab của trang — "Hiệu quả" đã sang nhóm Phân tích', () => {
    expect(mkt.children?.map((c) => [c.label, c.href])).toEqual([
      ['Chiến dịch', `${base}?tab=chien-dich`],
      ['Giao việc cho sàn', `${base}?tab=giao-viec`],
      ['Link theo dõi', `${base}?tab=link-theo-doi`],
    ])
  })

  it('mục con đang chọn theo ?tab=, mặc định là Chiến dịch', () => {
    expect(activeOwnerNavChild(mkt, base, '')).toBe(`${base}?tab=chien-dich`)
    expect(activeOwnerNavChild(mkt, base, '?tab=link-theo-doi&kenh=zalo')).toBe(`${base}?tab=link-theo-doi`)
    expect(activeOwnerNavChild(mkt, base, '?tab=giao-viec&dat=x')).toBe(`${base}?tab=giao-viec`)
  })

  it('trang con: chi tiết chiến dịch ⇒ Chiến dịch; Dữ liệu đi đâu / trang khác ⇒ không mục nào', () => {
    expect(activeOwnerNavChild(mkt, `${base}/chien-dich/123`, '')).toBe(`${base}?tab=chien-dich`)
    expect(activeOwnerNavChild(mkt, `${base}/giao-viec/123`, '')).toBe(`${base}?tab=giao-viec`)
    expect(activeOwnerNavChild(mkt, `${base}/du-lieu`, '')).toBeNull()
    expect(activeOwnerNavChild(mkt, '/chu-tai-san/thu-tien', '?tab=chien-dich')).toBeNull()
  })
})

describe('ownerModulesForPath', () => {
  it('trang danh sách ⇒ module của nó', () => {
    expect(ownerModulesForPath('/chu-tai-san/thu-tien')).toEqual(['thu-tien'])
    expect(ownerModulesForPath('/chu-tai-san/bao-cao')).toEqual(['phan-tich'])
    expect(ownerModulesForPath('/chu-tai-san/bao-cao-dinh-ky')).toEqual(['bao-cao-dinh-ky'])
    expect(ownerModulesForPath('/chu-tai-san/vai-tro')).toEqual(['vai-tro'])
    expect(ownerModulesForPath('/chu-tai-san/truyen-thong')).toEqual(['truyen-thong'])
  })

  it('trang theo không gian đang chọn có tham số vẫn chặn (chỉ tiêu, vai trò)', () => {
    expect(ownerModulesForPath('/chu-tai-san/vai-tro/abc')).toEqual(['vai-tro'])
    expect(ownerModulesForPath('/chu-tai-san/chi-tieu/moi')).toEqual(['chi-tieu'])
  })

  it('Tổng quan, Credit và trang chi tiết mở theo bản ghi ⇒ không chặn', () => {
    expect(ownerModulesForPath('/chu-tai-san/dashboard')).toBeNull()
    expect(ownerModulesForPath('/chu-tai-san/credits')).toBeNull()
    expect(ownerModulesForPath('/chu-tai-san/goi-thue-bao')).toBeNull()
    expect(ownerModulesForPath('/chu-tai-san/dang-tai-san/123')).toBeNull()
    expect(ownerModulesForPath('/chu-tai-san/hop-dong/mua-ban/123')).toBeNull()
    expect(ownerModulesForPath('/chu-tai-san/bao-cao-dinh-ky/123')).toBeNull()
    expect(ownerModulesForPath('/portal/dashboard')).toBeNull()
  })
})
