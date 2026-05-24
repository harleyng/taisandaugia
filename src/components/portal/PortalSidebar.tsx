import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS, NavItem } from './nav-config'
import { useCapacityProfile } from '@/hooks/useCapacityProfile'
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
          'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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

  return (
    <aside className="flex h-full w-full flex-col bg-white border-r border-border">
      {/* Logo / Portal name */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">ĐG</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">Cổng tổ chức</p>
          <p className="text-[10px] text-muted-foreground">Đấu giá tài sản</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_SECTIONS.map((section) => {
          // Section is a direct link
          if (section.href && !section.children) {
            return (
              <NavLink
                key={section.label}
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
                    anyChildActive ? 'text-primary' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <section.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{section.label}</span>

                  {/* Capacity score badge */}
                  {section.scoreBadge && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                      {profile.totalCapacityScore}/76
                    </span>
                  )}

                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-3">
                  {section.children!.map((item) => (
                    <NavItemLink key={item.href} item={item} onNavigate={onNavigate} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </nav>

      {/* Bottom: back to marketplace + version */}
      <div className="border-t border-border px-3 py-2.5 shrink-0 space-y-2">
        <button
          onClick={() => { onNavigate?.(); navigate('/') }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          Quay lại Marketplace
        </button>
        <p className="px-3 text-[10px] text-muted-foreground">TT 19/2024/TT-BTP</p>
      </div>
    </aside>
  )
}
