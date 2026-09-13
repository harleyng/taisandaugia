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
  Inbox,
  Gavel,
  ClipboardCheck,
  BookUser,
  MessagesSquare,
  FileSignature,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  module?: string          // mã quyền (src/lib/orgPermissions.ts) — lọc theo action 'view'
  countBadge?: CountBadgeKind
}

/** Badge số đếm động — PortalSidebar biết lấy số ở hook nào. */
export type CountBadgeKind = 'yeu-cau-ky-gui' | 'hoi-dap' | 'hop-dong-mua-ban'

export interface NavSection {
  label: string
  icon: LucideIcon
  href?: string            // if section itself is a link (no sub-items)
  children?: NavItem[]
  scoreBadge?: boolean     // show capacity score badge
  module?: string          // mã quyền cho section không có sub-items
  countBadge?: CountBadgeKind
}

/**
 * Nhóm menu — tiêu đề in hoa ngăn các mục theo nghiệp vụ, giống sidebar admin.
 * Nhóm không có `title` (nhóm đầu) hiện thẳng, không tiêu đề.
 */
export interface NavGroup {
  title?: string
  sections: NavSection[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    // Nhóm đầu không tiêu đề — vào cổng là thấy ngay Tổng quan.
    sections: [
      {
        label: 'Tổng quan',
        icon: LayoutDashboard,
        href: '/portal/dashboard',
        module: 'tong-quan',
      },
    ],
  },
  {
    // Hồ sơ tổ chức: năng lực, con người và hồ sơ mang đi dự tuyển.
    title: 'Hồ sơ tổ chức',
    sections: [
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
    ],
  },
  {
    // Vòng đời một cuộc đấu giá, đọc từ trên xuống: nhận việc ký gửi → mở phiên
    // → nhận hồ sơ tham gia → ký hợp đồng mua bán.
    title: 'Đấu giá',
    sections: [
      {
        label: 'Yêu cầu ký gửi',
        icon: Inbox,
        href: '/portal/yeu-cau-ky-gui',
        module: 'yeu-cau-ky-gui',
        countBadge: 'yeu-cau-ky-gui',
      },
      {
        label: 'Phiên đấu giá',
        icon: Gavel,
        href: '/portal/phien-dau-gia',
        module: 'phien-dau-gia',
      },
      {
        label: 'Hồ sơ tham gia',
        icon: ClipboardCheck,
        href: '/portal/ho-so-tham-gia',
        module: 'ho-so-tham-gia',
      },
      {
        label: 'Hợp đồng mua bán',
        icon: FileSignature,
        href: '/portal/hop-dong-mua-ban',
        module: 'hop-dong-mua-ban',
        countBadge: 'hop-dong-mua-ban',
      },
    ],
  },
  {
    title: 'Khách hàng',
    sections: [
      {
        label: 'Danh bạ khách hàng',
        icon: BookUser,
        href: '/portal/khach-hang',
        module: 'khach-hang',
      },
      {
        label: 'Hỏi đáp & Omnichat',
        icon: MessagesSquare,
        href: '/portal/hoi-dap',
        module: 'hoi-dap',
        countBadge: 'hoi-dap',
      },
    ],
  },
  {
    title: 'Quản trị',
    sections: [
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
    ],
  },
]

/** Danh sách phẳng — dùng cho các chỗ chỉ cần duyệt mục, không quan tâm nhóm. */
export const NAV_SECTIONS: NavSection[] = NAV_GROUPS.flatMap((g) => g.sections)
