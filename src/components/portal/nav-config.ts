import {
  LayoutDashboard,
  Building2,
  Info,
  Users,
  Warehouse,
  History,
  Receipt,
  Target,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
}

export interface NavSection {
  label: string
  icon: LucideIcon
  href?: string            // if section itself is a link (no sub-items)
  children?: NavItem[]
  scoreBadge?: boolean     // show capacity score badge
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Tổng quan',
    icon: LayoutDashboard,
    href: '/portal/dashboard',
  },
  {
    label: 'Hồ sơ năng lực',
    icon: Building2,
    scoreBadge: true,
    children: [
      { label: 'Thông tin chung', href: '/portal/nang-luc/thong-tin-chung', icon: Info },
      { label: 'Đấu giá viên', href: '/portal/nang-luc/dau-gia-vien', icon: Users },
      { label: 'Cơ sở vật chất', href: '/portal/nang-luc/co-so-vat-chat', icon: Warehouse },
      { label: 'Lịch sử đấu giá', href: '/portal/nang-luc/lich-su-dau-gia', icon: History },
      { label: 'Tài chính & Thuế', href: '/portal/nang-luc/tai-chinh', icon: Receipt },
    ],
  },
  {
    label: 'Hồ sơ dự tuyển',
    icon: Target,
    href: '/portal/ho-so-du-tuyen',
  },
  {
    label: 'Credit & Thanh toán',
    icon: CreditCard,
    href: '/portal/credits',
  },
]
