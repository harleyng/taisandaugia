import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, NAV_SECTIONS, NavItem, NavSection, type CountBadgeKind } from './nav-config'
import { OrgSwitcher } from './OrgSwitcher'
import { useCapacityProfile } from '@/hooks/useCapacityProfile'
import { useOrgServiceRequestCounts } from '@/hooks/useOrgServiceRequests'
import { useChatAttentionCounts } from '@/hooks/useOrgChat'
import { useOrgPermissions } from '@/hooks/useOrgPermissions'
import { useSessionOrg } from '@/hooks/useAuctionSessions'
import { useOrgSaleContractCounts } from '@/hooks/useSaleContracts'
import { orgMatrixHas } from '@/lib/orgPermissions'
import { ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface Props {
  onNavigate?: () => void  // called on mobile to close drawer
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.href}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
            : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )
      }
    >
      <item.icon className="h-3.5 w-3.5 shrink-0" />
      {item.label}
    </NavLink>
  )
}

export function PortalSidebar({ onNavigate }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useCapacityProfile()
  const { isOwner, matrix, ready } = useOrgPermissions()
  const { newCount, contractsActionCount } = useOrgServiceRequestCounts()
  const { awaitingReply } = useChatAttentionCounts()

  // Số đếm động cho badge nav; thêm loại mới thì nối vào CountBadgeKind rồi trả
  // số ở đây. Hỏi đáp chỉ đếm câu CHỜ TRẢ LỜI — cộng thêm sổ chuyển tiếp sẽ đếm
  // trùng cùng một câu hỏi. Ký gửi = yêu cầu mới + hợp đồng tổ chức phải xử lý.
  // Huy hiệu hợp đồng mua bán: chỉ gọi khi người dùng thực sự thấy mục đó, để
  // AGENT không có quyền không phải ăn một lần 403 mỗi lần mở cổng.
  const { organizationId } = useSessionOrg()
  const canViewSale = isOwner || orgMatrixHas(matrix, 'hop-dong-mua-ban', 'view')
  const { data: saleCounts } = useOrgSaleContractCounts(organizationId, ready && canViewSale)

  const badgeCount = (kind?: CountBadgeKind) =>
    kind === 'yeu-cau-ky-gui'
      ? newCount + contractsActionCount
      : kind === 'hoi-dap'
        ? awaitingReply
        : kind === 'hop-dong-mua-ban'
          ? (saleCounts?.action_needed ?? 0) + (saleCounts?.overdue ?? 0)
          : 0

  // Lọc nav theo quyền 'view'. Khi CHƯA nạp xong chỉ hiện mục không gắn module —
  // tránh nháy link mà người dùng không có quyền vào.
  const visibleGroups = useMemo(() => {
    const canView = (m?: string) =>
      !m || isOwner || orgMatrixHas(matrix, m, 'view')

    return NAV_GROUPS.map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => {
          if (!section.children) return section
          return {
            ...section,
            children: section.children.filter((c) => (ready ? canView(c.module) : !c.module)),
          }
        })
        .filter((section) =>
          // Section có children mà bị lọc sạch thì chính nó cũng phải biến mất,
          // nếu không sẽ còn lại một mục xổ xuống rỗng.
          section.children ? section.children.length > 0 : ready ? canView(section.module) : !section.module,
        ),
      // Nhóm không còn mục nào thì bỏ luôn cả tiêu đề in hoa.
    })).filter((group) => group.sections.length > 0)
  }, [isOwner, matrix, ready])

  // Sections with children default to open if any child is active
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    NAV_SECTIONS.forEach((section) => {
      if (section.children) {
        const anyActive = section.children.some((c) => location.pathname.startsWith(c.href))
        initial[section.label] = anyActive
      }
    })
    return initial
  })

  function toggleSection(label: string) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  /** Một mục nav (link thẳng hoặc nhóm con xổ xuống). */
  function renderSection(section: NavSection) {
    // Section is a direct link
    if (section.href && !section.children) {
      const count = badgeCount(section.countBadge)
      return (
        <NavLink
          key={section.label}
          to={section.href}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )
          }
        >
          <section.icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{section.label}</span>
          {count > 0 && (
            <span
              className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground"
              aria-label={`${count} việc cần xử lý`}
            >
              {count}
            </span>
          )}
        </NavLink>
      )
    }

    // Section with children — collapsible
    const isOpen = openSections[section.label] ?? false
    const anyChildActive = section.children?.some((c) => location.pathname.startsWith(c.href))

    return (
      <Collapsible
        key={section.label}
        open={isOpen}
        onOpenChange={() => toggleSection(section.label)}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              anyChildActive
                ? 'bg-sidebar-accent text-sidebar-foreground'
                : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <section.icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>

            {/* Capacity score badge */}
            {section.scoreBadge && (
              <span className="shrink-0 rounded-full bg-sidebar-foreground/10 px-1.5 py-0.5 text-xs font-semibold text-sidebar-foreground">
                {profile.totalCapacityScore}/76
              </span>
            )}

            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/50" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/50" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
            {section.children!.map((item) => (
              <NavItemLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo / Portal name */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary">
          <span className="text-xs font-bold text-sidebar-primary-foreground">ĐG</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-tight">Cổng tổ chức</p>
          <p className="text-[10px] text-sidebar-foreground/60">Đấu giá tài sản</p>
        </div>
      </div>

      {/* Bộ chuyển tổ chức / chi nhánh — trên cùng, tách khỏi danh sách module
          bằng đường kẻ. Tự ẩn khi chỉ thuộc một tổ chức. */}
      <OrgSwitcher className="border-b border-sidebar-border px-3 py-3 shrink-0" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {visibleGroups.map((group, i) => (
          <div key={group.title ?? 'top'} className={i > 0 ? 'mt-4' : ''}>
            {group.title && (
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">{group.sections.map(renderSection)}</div>
          </div>
        ))}
      </nav>

      {/* Bottom: back to marketplace + version */}
      <div className="border-t border-sidebar-border px-3 py-2.5 shrink-0 space-y-2">
        <button
          onClick={() => { onNavigate?.(); navigate('/') }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          Quay lại Marketplace
        </button>
        <p className="px-3 text-[10px] text-sidebar-foreground/50">TT 19/2024/TT-BTP</p>
      </div>
    </aside>
  )
}
