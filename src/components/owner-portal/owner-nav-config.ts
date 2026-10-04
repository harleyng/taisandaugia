import {
  Activity,
  KanbanSquare,
  Gavel,
  FileBarChart,
  BarChart2,
  GitBranch,
  UploadCloud,
  BadgeCheck,
  BookUser,
  CreditCard,
  FileSignature,
  Handshake,
  HandCoins,
  Users,
  Network,
  Wallet,
  Target,
  ShieldCheck,
  Megaphone,
  History,
  Send,
  Link2,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import type { OwnerModule } from '@/lib/ownerWorkspace/permissions'
import {
  OWNER_AD_PERFORMANCE_HREF,
  OWNER_MARKETING_TABS,
  ownerMarketingTabHref,
  type OwnerMarketingTab,
} from '@/lib/ownerMarketing/routes'

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
   * khi vai trò có quyền "Xem" ở ít nhất một module. Không có = luôn hiện (Tổng quan, Gói dịch vụ, Credit).
   */
  module?: OwnerModule | readonly OwnerModule[]
  /**
   * Mục con = các tab của trang (href dạng `<href>?tab=<giá trị>`); mục cha khi đó chỉ
   * xổ/thu, không tự điều hướng. Mục con thừa quyền của mục cha.
   */
  children?: OwnerNavSubItem[]
}

export interface OwnerNavSubItem {
  label: string
  href: string
  icon: LucideIcon
}

/** Nhóm nav theo nghiệp vụ (docs/owner-control-tower-plan.md §A6). */
export type OwnerNavGroupId = 'dieu-hanh' | 'tac-nghiep' | 'phan-tich' | 'thiet-lap'

export interface OwnerNavGroup {
  id: OwnerNavGroupId
  title: string
  items: OwnerNavItem[]
}

const MARKETING_TAB_ICONS: Record<OwnerMarketingTab, LucideIcon> = {
  'chien-dich': Send,
  'giao-viec': Handshake,
  'link-theo-doi': Link2,
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
        // Quảng bá tài sản qua kênh RIÊNG của đơn vị (link theo dõi), chiến dịch, giao việc cho sàn.
        label: 'Truyền thông',
        icon: Megaphone,
        href: '/chu-tai-san/truyen-thong',
        module: 'truyen-thong',
        children: OWNER_MARKETING_TABS.map((t) => ({
          label: t.label,
          href: ownerMarketingTabHref(t.value),
          icon: MARKETING_TAB_ICONS[t.value],
        })),
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
      {
        // So đối tác tự nhập trong hồ sơ số hoá (thẩm định / pháp lý / tổ chức đấu giá) trên kết
        // quả phiên. Nằm ở Tác nghiệp nhưng chỉ đọc nên vẫn dùng quyền "Xem" của Phân tích danh
        // mục, không thêm module. Icon BookUser (không phải Handshake như plan §A8): Handshake đã
        // là "Ký gửi đấu giá".
        label: 'Đối tác của tôi',
        icon: BookUser,
        href: '/chu-tai-san/doi-tac',
        module: 'phan-tich',
      },
    ],
  },
  {
    id: 'phan-tich',
    title: 'Phân tích',
    items: [
      { label: 'Phân tích danh mục', icon: BarChart2, href: '/chu-tai-san/bao-cao', module: 'phan-tich' },
      { label: 'Dòng tiền', icon: Wallet, href: '/chu-tai-san/dong-tien', module: 'dong-tien' },
      {
        // Phễu kênh quảng bá (trước là tab "Hiệu quả" của Truyền thông) — số đo của module
        // truyen-thong nên vẫn theo quyền "Xem" của module đó, không thêm module.
        label: 'Hiệu quả quảng cáo',
        icon: BarChart3,
        href: OWNER_AD_PERFORMANCE_HREF,
        module: 'truyen-thong',
      },
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
      {
        // Không gắn module: ai cũng xem được thao tác của chính mình; nhat-ky:view mới
        // thấy của người khác (tầng xem do RPC owner_audit_context quyết).
        label: 'Nhật ký hoạt động',
        icon: History,
        href: '/chu-tai-san/nhat-ky',
      },
      { label: 'Gói dịch vụ', icon: BadgeCheck, href: '/chu-tai-san/goi-thue-bao' },
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

const tabOfHref = (href: string) => new URLSearchParams(href.split('?')[1] ?? '').get('tab')

/** Đang ở trong trang của mục (kể cả trang con, vd. /truyen-thong/chien-dich/:id). */
export const isInOwnerNavItem = (item: OwnerNavItem, pathname: string) =>
  pathname === item.href || pathname.startsWith(`${item.href}/`)

/**
 * Mục con đang chọn: theo `?tab=` (không có ⇒ mục con đầu — tab mặc định của trang);
 * trang con `<href>/<tab>/…` thuộc mục con cùng tên (chi tiết chiến dịch ⇒ "Chiến dịch").
 * Trang con không trùng tab nào (vd. "Dữ liệu đi đâu") ⇒ không mục con nào sáng.
 */
export function activeOwnerNavChild(item: OwnerNavItem, pathname: string, search: string): string | null {
  if (!item.children?.length || !isInOwnerNavItem(item, pathname)) return null
  const sub = pathname.slice(item.href.length).split('/')[1]
  const tab = sub || new URLSearchParams(search).get('tab') || tabOfHref(item.children[0].href)
  return item.children.find((c) => tabOfHref(c.href) === tab)?.href ?? null
}

/**
 * Trang DANH SÁCH / trang theo không gian đang chọn → module cần quyền "Xem" (có một là
 * đủ). null = không chặn: Tổng quan, Gói dịch vụ, Credit, và trang chi tiết mở theo bản ghi (hồ sơ,
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
    'truyen-thong': ['truyen-thong'],
    'hieu-qua-quang-cao': ['truyen-thong'],
    'bao-cao': ['phan-tich'],
    'doi-tac': ['phan-tich'],
    'dong-tien': ['dong-tien'],
    'bao-cao-dinh-ky': ['bao-cao-dinh-ky'],
    'chi-nhanh-amc': ['chi-nhanh'],
    'thanh-vien': ['thanh-vien'],
    'lien-ket': ['lien-ket'],
  }
  return LIST[first] ?? null
}
