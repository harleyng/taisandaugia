import {
  Activity,
  KanbanSquare,
  Gavel,
  FileBarChart,
  BarChart2,
  GitBranch,
  UploadCloud,
  CreditCard,
  FileSignature,
  Handshake,
  HandCoins,
  Users,
  Network,
  Wallet,
  Target,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { OwnerModule } from '@/lib/ownerWorkspace/permissions'

/** Loại số đếm động hiện cạnh mục nav — số trả về ở OwnerPortalSidebar. */
export type OwnerCountBadgeKind =
  | 'owner-consignment'
  | 'owner-contracts'
  | 'owner-link-requests'
  | 'owner-found-claims'
  | 'owner-awaiting-payment'

export interface OwnerNavItem {
  label: string
  href: string
  icon: LucideIcon
  countBadge?: OwnerCountBadgeKind
  /**
   * Module của ma trận vai trò (src/lib/ownerWorkspace/permissions.ts) — mục chỉ hiện
   * khi vai trò có quyền "Xem" ở ít nhất một module. Không có = luôn hiện (Tổng quan, Credit).
   */
  module?: OwnerModule | readonly OwnerModule[]
}

/** Nhóm nav theo nghiệp vụ (docs/owner-control-tower-plan.md §A6). */
export type OwnerNavGroupId = 'dieu-hanh' | 'tac-nghiep' | 'phan-tich' | 'thiet-lap'

export interface OwnerNavGroup {
  id: OwnerNavGroupId
  title: string
  items: OwnerNavItem[]
}

/** "Hợp đồng" gộp ký gửi (với tổ chức) · mua bán (với người trúng) · dịch vụ (với sàn). */
const CONTRACT_MODULES: readonly OwnerModule[] = ['ky-gui', 'hop-dong-mua-ban', 'so-hoa']

/** Chỉ liệt kê mục đã có route; mục mới thêm vào đúng nhóm theo §A6. */
export const OWNER_NAV_GROUPS: OwnerNavGroup[] = [
  {
    id: 'dieu-hanh',
    title: 'Điều hành',
    items: [
      {
        label: 'Tổng quan',
        icon: Activity,
        href: '/chu-tai-san/dashboard',
      },
      { label: 'Chỉ tiêu', icon: Target, href: '/chu-tai-san/chi-tieu', module: 'chi-tieu' },
      {
        label: 'Tài sản',
        icon: KanbanSquare,
        href: '/chu-tai-san/tai-san',
        countBadge: 'owner-found-claims',
        module: 'tai-san',
      },
      { label: 'Kết quả phiên', icon: Gavel, href: '/chu-tai-san/ket-qua', module: 'ket-qua' },
    ],
  },
  {
    id: 'tac-nghiep',
    title: 'Tác nghiệp',
    items: [
      { label: 'Số hoá tài sản', icon: UploadCloud, href: '/chu-tai-san/dang-tai-san', module: 'so-hoa' },
      {
        // Số việc ký gửi chờ chủ tài sản (chọn báo giá, bổ sung địa chỉ, xác nhận
        // hợp đồng) nằm ở đây — đó là việc của ký gửi, không phải của số hoá.
        label: 'Ký gửi đấu giá',
        icon: Handshake,
        href: '/chu-tai-san/ky-gui-dau-gia',
        countBadge: 'owner-consignment',
        module: 'ky-gui',
      },
      {
        // Ký gửi (với tổ chức) · mua bán (với người trúng) · dịch vụ (với sàn).
        label: 'Hợp đồng',
        icon: FileSignature,
        href: '/chu-tai-san/hop-dong',
        countBadge: 'owner-contracts',
        module: CONTRACT_MODULES,
      },
      {
        // Thao tác thu tiền (tính đến hôm nay); báo cáo theo kỳ là "Dòng tiền" ở nhóm Phân tích.
        // Huy hiệu = dòng "Chờ thu tiền" của "Việc cần làm" trên Tổng quan (cùng danh sách).
        label: 'Thu tiền',
        icon: HandCoins,
        href: '/chu-tai-san/thu-tien',
        countBadge: 'owner-awaiting-payment',
        module: 'thu-tien',
      },
    ],
  },
  {
    id: 'phan-tich',
    title: 'Phân tích',
    items: [
      { label: 'Phân tích danh mục', icon: BarChart2, href: '/chu-tai-san/bao-cao', module: 'phan-tich' },
      { label: 'Dòng tiền', icon: Wallet, href: '/chu-tai-san/dong-tien', module: 'dong-tien' },
      { label: 'Báo cáo định kỳ', icon: FileBarChart, href: '/chu-tai-san/bao-cao-dinh-ky', module: 'bao-cao-dinh-ky' },
    ],
  },
  {
    id: 'thiet-lap',
    title: 'Thiết lập',
    items: [
      { label: 'Chi nhánh', icon: GitBranch, href: '/chu-tai-san/chi-nhanh-amc', module: 'chi-nhanh' },
      { label: 'Thành viên', icon: Users, href: '/chu-tai-san/thanh-vien', module: 'thanh-vien' },
      { label: 'Vai trò', icon: ShieldCheck, href: '/chu-tai-san/vai-tro', module: 'vai-tro' },
      {
        label: 'Liên kết',
        icon: Network,
        href: '/chu-tai-san/lien-ket',
        countBadge: 'owner-link-requests',
        module: 'lien-ket',
      },
      { label: 'Credit', icon: CreditCard, href: '/chu-tai-san/credits' },
    ],
  },
]

const asList = (m: OwnerModule | readonly OwnerModule[]): readonly OwnerModule[] =>
  typeof m === 'string' ? [m] : m

/** Bỏ mục mà vai trò không có quyền "Xem"; nhóm rỗng thì bỏ cả nhóm. */
export function visibleOwnerNavGroups(
  groups: readonly OwnerNavGroup[],
  canView: (module: OwnerModule) => boolean,
): OwnerNavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.module || asList(i.module).some(canView)) }))
    .filter((g) => g.items.length > 0)
}

/**
 * Trang DANH SÁCH / trang theo không gian đang chọn → module cần quyền "Xem" (có một là
 * đủ). null = không chặn: Tổng quan, Credit, và trang chi tiết mở theo bản ghi (hồ sơ,
 * ký gửi, hợp đồng, báo cáo) — những trang đó tự xét quyền theo không gian CỦA BẢN GHI.
 */
export function ownerModulesForPath(pathname: string): readonly OwnerModule[] | null {
  const [, root, first, ...rest] = pathname.split('/')
  if (root !== 'chu-tai-san' || !first) return null
  const PER_WORKSPACE: Record<string, readonly OwnerModule[]> = {
    'chi-tieu': ['chi-tieu'],
    'vai-tro': ['vai-tro'],
  }
  if (PER_WORKSPACE[first]) return PER_WORKSPACE[first]
  if (rest.length > 0) return null
  const LIST: Record<string, readonly OwnerModule[]> = {
    'tai-san': ['tai-san'],
    'ket-qua': ['ket-qua'],
    'dang-tai-san': ['so-hoa'],
    'ky-gui-dau-gia': ['ky-gui'],
    'hop-dong': CONTRACT_MODULES,
    'thu-tien': ['thu-tien'],
    'bao-cao': ['phan-tich'],
    'dong-tien': ['dong-tien'],
    'bao-cao-dinh-ky': ['bao-cao-dinh-ky'],
    'chi-nhanh-amc': ['chi-nhanh'],
    'thanh-vien': ['thanh-vien'],
    'lien-ket': ['lien-ket'],
  }
  return LIST[first] ?? null
}
