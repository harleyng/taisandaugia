import { Link, NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import {
  OWNER_NAV_GROUPS,
  activeOwnerNavChild,
  isInOwnerNavItem,
  visibleOwnerNavGroups,
  type OwnerCountBadgeKind,
  type OwnerNavItem,
} from './owner-nav-config'
import { useOwnerConsignmentSummary } from '@/hooks/useConsignmentContract'
import { useOwnerContractActionCount } from '@/hooks/useOwnerContracts'
import { usePendingClaimCount } from '@/hooks/useAssetOwnerWorkspace'
import { useOwnerPulse } from '@/hooks/useOwnerPulse'
import { useOwnerWorkspace } from '@/hooks/useOwnerWorkspace'
import { usePendingLinkRequestCount } from '@/hooks/useOwnerWorkspaceLinks'
import { useOwnerPortalName } from '@/hooks/useOwnerPortalName'
import { OwnerWorkspaceSwitcher } from './OwnerWorkspaceSwitcher'
import { OwnerPortalAccountMenu } from './OwnerPortalAccountMenu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, Home } from 'lucide-react'

interface Props {
  onNavigate?: () => void
}

export function OwnerPortalSidebar({ onNavigate }: Props) {
  const { data: summary } = useOwnerConsignmentSummary()
  // Hợp đồng: bản ký / bàn giao chờ xác nhận + báo giá dịch vụ chờ đồng ý.
  const contractActionCount = useOwnerContractActionCount()
  const { workspaceId, can, isPersonal, isLoading: wsLoading } = useOwnerWorkspace()
  const portalName = useOwnerPortalName()
  // Mục chỉ hiện khi vai trò có quyền "Xem" module của nó. Tenant Cá nhân / chưa có
  // không gian / đang tải: hiện đủ như trước (trang tự nói "chưa có không gian").
  const navGroups = useMemo(
    () =>
      wsLoading || isPersonal || !workspaceId
        ? OWNER_NAV_GROUPS
        : visibleOwnerNavGroups(OWNER_NAV_GROUPS, (m) => can(m, 'view')),
    [wsLoading, isPersonal, workspaceId, can],
  )
  // Liên kết: yêu cầu của trụ sở chờ người có quyền Liên kết của chi nhánh trả lời (Phase 14).
  const { data: linkRequestCount = 0 } = usePendingLinkRequestCount(workspaceId, can('lien-ket', 'update'))
  // Thu tiền: tài sản đã bán còn chờ thu — cùng danh sách dòng "Chờ thu tiền" trên Tổng quan.
  const awaitingPaymentCount = useOwnerPulse().awaitingPayment.length
  // Tài sản: tin sàn tìm thấy chờ xác nhận (tab "Sàn tìm thấy").
  const { data: foundClaimCount = 0 } = usePendingClaimCount(workspaceId)

  // Mục có mục con (Truyền thông): mở sẵn khi đang ở trong trang của nó, và tự mở lại
  // mỗi lần đi vào từ chỗ khác (link trên Tổng quan…); người dùng vẫn thu lại được.
  const location = useLocation()
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  const currentParent = OWNER_NAV_GROUPS.flatMap((g) => g.items).find(
    (i) => i.children && isInOwnerNavItem(i, location.pathname),
  )?.href
  useEffect(() => {
    if (currentParent) setOpenItems((prev) => ({ ...prev, [currentParent]: true }))
  }, [currentParent])

  // Số hồ sơ đang chờ chủ tài sản làm gì đó (chọn báo giá, bổ sung địa chỉ,
  // xác nhận hợp đồng). Luật nằm ở RPC owner_consignment_summary.
  const badgeCount = (kind?: OwnerCountBadgeKind) =>
    kind === 'owner-consignment'
      ? (summary?.actionCount ?? 0)
      : kind === 'owner-contracts'
        ? contractActionCount
          : kind === 'owner-link-requests'
            ? linkRequestCount
            : kind === 'owner-awaiting-payment'
              ? awaitingPaymentCount
              : kind === 'owner-found-claims'
                ? foundClaimCount
                : 0

  const badgeLabel = (kind: OwnerCountBadgeKind | undefined, count: number) =>
    kind === 'owner-link-requests'
        ? `${count} yêu cầu liên kết chờ bạn trả lời`
        : kind === 'owner-awaiting-payment'
          ? `${count} tài sản chờ thu tiền`
          : kind === 'owner-contracts'
            ? `${count} hợp đồng cần bạn xử lý`
            : kind === 'owner-found-claims'
              ? `${count} tin sàn tìm thấy chờ bạn xác nhận`
              : `${count} hồ sơ cần bạn xử lý`

  const itemClass = (active: boolean) =>
    cn(
      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'
    )

  const countPill = (item: OwnerNavItem) => {
    const count = badgeCount(item.countBadge)
    if (count <= 0) return null
    return (
      <span
        className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground"
        aria-label={badgeLabel(item.countBadge, count)}
      >
        {count}
      </span>
    )
  }

  const renderItem = (item: OwnerNavItem) => {
    if (!item.children?.length) {
      return (
        <NavLink
          key={item.href}
          to={item.href}
          onClick={onNavigate}
          className={({ isActive }) => itemClass(isActive)}
        >
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {countPill(item)}
        </NavLink>
      )
    }

    // Mục con là tab (?tab=) — NavLink không xét query (sẽ sáng cả 4) nên dùng Link + tự tính.
    const activeChild = activeOwnerNavChild(item, location.pathname, location.search)
    const isOpen = openItems[item.href] ?? false
    return (
      <Collapsible
        key={item.href}
        open={isOpen}
        onOpenChange={(open) => setOpenItems((prev) => ({ ...prev, [item.href]: open }))}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isInOwnerNavItem(item, location.pathname)
                ? 'bg-sidebar-accent text-sidebar-foreground'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
            {countPill(item)}
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" aria-hidden="true" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
            {item.children.map((child) => {
              const active = child.href === activeChild
              return (
                <Link
                  key={child.href}
                  to={child.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(itemClass(active), 'py-1.5 font-normal', active && 'font-medium')}
                >
                  <child.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1 truncate">{child.label}</span>
                </Link>
              )
            })}
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
          <Home className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-tight">{portalName}</p>
          <p className="text-[10px] text-sidebar-foreground/60">Cổng chủ tài sản</p>
        </div>
      </div>

      {/* Bộ chuyển không gian / Cá nhân — trên cùng, tách khỏi danh sách module
          bằng đường kẻ như cổng tổ chức. Tự ẩn khi chỉ có một tenant. */}
      <OwnerWorkspaceSwitcher className="border-b border-sidebar-border px-3 py-3 shrink-0" />

      {/* Nav — nhóm theo nghiệp vụ, tiêu đề nhóm nhỏ và mờ */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {navGroups.map((group, i) => (
          <div
            key={group.id}
            role="group"
            aria-labelledby={`owner-nav-${group.id}`}
            className={i > 0 ? 'mt-4' : ''}
          >
            <p
              id={`owner-nav-${group.id}`}
              className="px-3 mb-1 text-xs font-medium text-sidebar-foreground/55"
            >
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* Chân sidebar: credit + hồ sơ (menu có "Quay lại Marketplace", đăng xuất) */}
      <OwnerPortalAccountMenu onNavigate={onNavigate} />
    </aside>
  )
}
