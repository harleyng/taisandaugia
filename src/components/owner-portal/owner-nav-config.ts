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
  Users,
  Network,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/** Loại số đếm động hiện cạnh mục nav — số trả về ở OwnerPortalSidebar. */
export type OwnerCountBadgeKind =
  | 'owner-consignment'
  | 'owner-sale'
  | 'owner-outcome-due'
  | 'owner-link-requests'

export interface OwnerNavItem {
  label: string
  href: string
  icon: LucideIcon
  countBadge?: OwnerCountBadgeKind
}

/** Nhóm nav theo nghiệp vụ (docs/owner-control-tower-plan.md §A6). */
export type OwnerNavGroupId = 'dieu-hanh' | 'tac-nghiep' | 'phan-tich' | 'thiet-lap'

export interface OwnerNavGroup {
  id: OwnerNavGroupId
  title: string
  items: OwnerNavItem[]
}

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
        countBadge: 'owner-outcome-due',
      },
      { label: 'Tài sản', icon: KanbanSquare, href: '/chu-tai-san/tai-san' },
      { label: 'Kết quả phiên', icon: Gavel, href: '/chu-tai-san/ket-qua' },
      { label: 'Dòng tiền', icon: Wallet, href: '/chu-tai-san/dong-tien' },
      { label: 'Báo cáo định kỳ', icon: FileBarChart, href: '/chu-tai-san/bao-cao-dinh-ky' },
    ],
  },
  {
    id: 'tac-nghiep',
    title: 'Tác nghiệp',
    items: [
      {
        label: 'Số hoá tài sản',
        icon: UploadCloud,
        href: '/chu-tai-san/dang-tai-san',
        countBadge: 'owner-consignment',
      },
      {
        label: 'Hợp đồng mua bán',
        icon: FileSignature,
        href: '/chu-tai-san/hop-dong-mua-ban',
        countBadge: 'owner-sale',
      },
    ],
  },
  {
    id: 'phan-tich',
    title: 'Phân tích',
    items: [{ label: 'Phân tích danh mục', icon: BarChart2, href: '/chu-tai-san/bao-cao' }],
  },
  {
    id: 'thiet-lap',
    title: 'Thiết lập',
    items: [
      { label: 'Chi nhánh', icon: GitBranch, href: '/chu-tai-san/chi-nhanh-amc' },
      { label: 'Thành viên', icon: Users, href: '/chu-tai-san/thanh-vien' },
      {
        label: 'Liên kết',
        icon: Network,
        href: '/chu-tai-san/lien-ket',
        countBadge: 'owner-link-requests',
      },
      { label: 'Credit', icon: CreditCard, href: '/chu-tai-san/credits' },
    ],
  },
]
