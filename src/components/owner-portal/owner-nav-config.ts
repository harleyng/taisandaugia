import {
  LayoutDashboard,
  Package,
  BarChart2,
  GitBranch,
  UploadCloud,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

/** Loại số đếm động hiện cạnh mục nav — số trả về ở OwnerPortalSidebar. */
export type OwnerCountBadgeKind = 'owner-consignment'

export interface NavSection {
  label: string
  icon: LucideIcon
  href: string
  countBadge?: OwnerCountBadgeKind
}

export const OWNER_NAV_SECTIONS: NavSection[] = [
  {
    label: 'Tổng quan',
    icon: LayoutDashboard,
    href: '/chu-tai-san/dashboard',
  },
  {
    label: 'Tài sản',
    icon: Package,
    href: '/chu-tai-san/tai-san',
  },
  {
    label: 'Số hoá tài sản',
    icon: UploadCloud,
    href: '/chu-tai-san/dang-tai-san',
    countBadge: 'owner-consignment',
  },
  {
    label: 'Chi nhánh',
    icon: GitBranch,
    href: '/chu-tai-san/chi-nhanh-amc',
  },
  {
    label: 'Báo cáo',
    icon: BarChart2,
    href: '/chu-tai-san/bao-cao',
  },
  {
    label: 'Credit',
    icon: CreditCard,
    href: '/chu-tai-san/credits',
  },
]
