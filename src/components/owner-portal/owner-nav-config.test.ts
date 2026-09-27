import { describe, expect, it } from 'vitest'
import { OWNER_NAV_GROUPS, ownerModulesForPath, visibleOwnerNavGroups } from './owner-nav-config'
import { HQ_VIEW_MATRIX, VIEWER_DEFAULT_MATRIX, type OwnerModule } from '@/lib/ownerWorkspace/permissions'

const labels = (canView: (m: OwnerModule) => boolean) =>
  visibleOwnerNavGroups(OWNER_NAV_GROUPS, canView).flatMap((g) => g.items.map((i) => i.label))

describe('visibleOwnerNavGroups', () => {
  it('đủ quyền xem ⇒ đủ menu, có mục Vai trò', () => {
    const all = labels(() => true)
    expect(all).toContain('Vai trò')
    expect(all).toHaveLength(OWNER_NAV_GROUPS.flatMap((g) => g.items).length)
  })

  it('vai trò chỉ xem Thu tiền ⇒ chỉ còn Tổng quan, Thu tiền, Gói thuê bao, Credit; nhóm rỗng bị bỏ', () => {
    const groups = visibleOwnerNavGroups(OWNER_NAV_GROUPS, (m) => m === 'thu-tien')
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toEqual(['Tổng quan', 'Thu tiền', 'Gói thuê bao', 'Credit'])
    expect(groups.map((g) => g.id)).toEqual(['dieu-hanh', 'tac-nghiep', 'thiet-lap'])
  })

  it('"Hợp đồng" hiện khi xem được một trong ký gửi / mua bán / số hoá', () => {
    expect(labels((m) => m === 'hop-dong-mua-ban')).toContain('Hợp đồng')
    expect(labels((m) => m === 'phan-tich')).not.toContain('Hợp đồng')
  })

  it('trụ sở đã liên kết không thấy Thành viên / Vai trò / Liên kết', () => {
    const hq = labels((m) => !!HQ_VIEW_MATRIX[m])
    expect(hq).not.toContain('Thành viên')
    expect(hq).not.toContain('Vai trò')
    expect(hq).not.toContain('Liên kết')
    expect(labels((m) => !!VIEWER_DEFAULT_MATRIX[m])).toContain('Vai trò')
  })
})

describe('ownerModulesForPath', () => {
  it('trang danh sách ⇒ module của nó', () => {
    expect(ownerModulesForPath('/chu-tai-san/thu-tien')).toEqual(['thu-tien'])
    expect(ownerModulesForPath('/chu-tai-san/bao-cao')).toEqual(['phan-tich'])
    expect(ownerModulesForPath('/chu-tai-san/bao-cao-dinh-ky')).toEqual(['bao-cao-dinh-ky'])
    expect(ownerModulesForPath('/chu-tai-san/vai-tro')).toEqual(['vai-tro'])
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
