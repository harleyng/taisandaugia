import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCredits } from '@/hooks/useCredits'
import { supabase } from '@/integrations/supabase/client'
import { CreditCard, LogOut, Menu, Plus, ChevronRight, ArrowLeft } from 'lucide-react'

const PAGE_META: Record<string, { title: string; parent?: string }> = {
  '/chu-tai-san/dashboard': { title: 'Tổng quan' },
  '/chu-tai-san/tai-san': { title: 'Danh sách tài sản' },
  '/chu-tai-san/bao-cao': { title: 'Báo cáo' },
}

interface Props {
  onMenuClick: () => void
}

export function OwnerPortalTopBar({ onMenuClick }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { balance } = useCredits()
  const page = PAGE_META[location.pathname]
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const uid = session.user.id
      // Try org KYC first, fall back to individual KYC
      supabase
        .from('asset_owner_org_kyc')
        .select('org_name')
        .eq('created_by', uid)
        .eq('status', 'approved')
        .maybeSingle()
        .then(({ data: orgData }) => {
          if (orgData?.org_name) {
            setDisplayName(orgData.org_name)
            return
          }
          supabase
            .from('asset_owner_kyc')
            .select('full_name')
            .eq('user_id', uid)
            .eq('status', 'approved')
            .maybeSingle()
            .then(({ data: indData }) => {
              if (indData?.full_name) setDisplayName(indData.full_name)
            })
        })
    })
  }, [])

  const initials = displayName
    ? displayName.trim().split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()
    : 'CT'

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 shrink-0">
      {/* Mobile: hamburger */}
      <button
        className="lg:hidden flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        onClick={onMenuClick}
        aria-label="Mở menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop: page breadcrumb */}
      <nav className="hidden lg:flex items-center gap-1 text-sm min-w-0">
        {page?.parent && (
          <>
            <span className="text-muted-foreground truncate">{page.parent}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        {page?.title && (
          <span className="font-medium text-foreground truncate">{page.title}</span>
        )}
      </nav>

      {/* Right: credit balance + user menu */}
      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm transition-colors hover:bg-muted"
          onClick={() => navigate('/buy-credits')}
        >
          <CreditCard className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">{balance.toLocaleString('vi-VN')}</span>
          <span className="text-xs text-muted-foreground">credit</span>
          <Plus className="h-3 w-3 text-primary ml-0.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium truncate">{displayName || 'Chủ tài sản'}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại Marketplace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/buy-credits')}>
              <CreditCard className="h-4 w-4 mr-2" />
              Mua thêm credit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
