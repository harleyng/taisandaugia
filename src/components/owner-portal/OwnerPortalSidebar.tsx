import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { OWNER_NAV_SECTIONS, type OwnerCountBadgeKind } from './owner-nav-config'
import { useOwnerConsignmentSummary } from '@/hooks/useConsignmentContract'
import { ArrowLeft, Home } from 'lucide-react'

interface Props {
  onNavigate?: () => void
}

export function OwnerPortalSidebar({ onNavigate }: Props) {
  const navigate = useNavigate()
  const { data: summary } = useOwnerConsignmentSummary()

  // Số hồ sơ đang chờ chủ tài sản làm gì đó (chọn báo giá, bổ sung địa chỉ,
  // xác nhận hợp đồng). Luật nằm ở RPC owner_consignment_summary.
  const badgeCount = (kind?: OwnerCountBadgeKind) =>
    kind === 'owner-consignment' ? (summary?.actionCount ?? 0) : 0

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo / Portal name */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary">
          <Home className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-tight">Cổng Chủ tài sản</p>
          <p className="text-[10px] text-sidebar-foreground/60">Quản lý tài sản</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {OWNER_NAV_SECTIONS.map((section) => {
          const count = badgeCount(section.countBadge)
          return (
            <NavLink
              key={section.href}
              to={section.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )
              }
            >
              <section.icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
              {count > 0 && (
                <span
                  className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground"
                  aria-label={`${count} hồ sơ cần bạn xử lý`}
                >
                  {count}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom: back to marketplace */}
      <div className="border-t border-sidebar-border px-3 py-2.5 shrink-0">
        <button
          onClick={() => { onNavigate?.(); navigate('/') }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          Quay lại Marketplace
        </button>
      </div>
    </aside>
  )
}
