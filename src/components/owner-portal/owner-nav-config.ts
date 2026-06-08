import {
  LayoutDashboard,
  Package,
  BarChart2,
  GitBranch,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavSection {
  label: string
  icon: LucideIcon
  href: string
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
    label: 'Chi nhánh',
    icon: GitBranch,
    href: '/chu-tai-san/chi-nhanh-amc',
  },
  {
    label: 'Báo cáo',
    icon: BarChart2,
    href: '/chu-tai-san/bao-cao',
  },
]
