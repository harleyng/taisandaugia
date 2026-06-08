import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { OWNER_NAV_SECTIONS } from './owner-nav-config'
import { ArrowLeft, Home } from 'lucide-react'

interface Props {
  onNavigate?: () => void
}

export function OwnerPortalSidebar({ onNavigate }: Props) {
  const navigate = useNavigate()

  return (
    <aside className="flex h-full w-full flex-col bg-white border-r border-border">
      {/* Logo / Portal name */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Home className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">Cổng Chủ tài sản</p>
          <p className="text-[10px] text-muted-foreground">Quản lý tài sản</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {OWNER_NAV_SECTIONS.map((section) => (
          <NavLink
            key={section.href}
            to={section.href}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )
            }
          >
            <section.icon className="h-4 w-4 shrink-0" />
            {section.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: back to marketplace */}
      <div className="border-t border-border px-3 py-2.5 shrink-0">
        <button
          onClick={() => { onNavigate?.(); navigate('/') }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          Quay lại Marketplace
        </button>
      </div>
    </aside>
  )
}
