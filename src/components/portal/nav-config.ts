import {
  LayoutDashboard,
  Building2,
  Info,
  Users,
  IdCard,
  Warehouse,
  History,
  Receipt,
  Target,
  CreditCard,
  Users2,
  UserPlus,
  KeyRound,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  module?: string          // mã quyền (src/lib/orgPermissions.ts) — lọc theo action 'view'
}

export interface NavSection {
  label: string
  icon: LucideIcon
  href?: string            // if section itself is a link (no sub-items)
  children?: NavItem[]
  scoreBadge?: boolean     // show capacity score badge
  module?: string          // mã quyền cho section không có sub-items
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Tổng quan',
    icon: LayoutDashboard,
    href: '/portal/dashboard',
    module: 'tong-quan',
  },
  {
    label: 'Hồ sơ năng lực',
    icon: Building2,
    scoreBadge: true,
    children: [
      { label: 'Thông tin chung', href: '/portal/nang-luc/thong-tin-chung', icon: Info, module: 'nl-thong-tin-chung' },
      { label: 'Đấu giá viên', href: '/portal/nang-luc/dau-gia-vien', icon: Users, module: 'nl-dau-gia-vien' },
      { label: 'Cơ sở vật chất', href: '/portal/nang-luc/co-so-vat-chat', icon: Warehouse, module: 'nl-co-so-vat-chat' },
      { label: 'Lịch sử đấu giá', href: '/portal/nang-luc/lich-su-dau-gia', icon: History, module: 'nl-lich-su-dau-gia' },
      { label: 'Tài chính & Thuế', href: '/portal/nang-luc/tai-chinh', icon: Receipt, module: 'nl-tai-chinh' },
    ],
  },
  {
    label: 'Hồ sơ nhân sự',
    icon: IdCard,
    href: '/portal/nhan-su',
    module: 'nhan-su',
  },
  {
    label: 'Bồi dưỡng chuyên môn',
    icon: GraduationCap,
    href: '/portal/boi-duong',
    module: 'boi-duong',
  },
  {
    label: 'Hồ sơ dự tuyển',
    icon: Target,
    href: '/portal/ho-so-du-tuyen',
    module: 'ho-so-du-tuyen',
  },
  {
    label: 'Credit & Thanh toán',
    icon: CreditCard,
    href: '/portal/credits',
    module: 'credit',
  },
  {
    label: 'Tổ chức',
    icon: Users2,
    children: [
      { label: 'Thành viên', href: '/portal/to-chuc/thanh-vien', icon: UserPlus, module: 'thanh-vien' },
      { label: 'Vai trò', href: '/portal/to-chuc/vai-tro', icon: KeyRound, module: 'vai-tro' },
    ],
  },
]
