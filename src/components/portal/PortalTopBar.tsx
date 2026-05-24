import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { CreditCard, LogOut, User, Menu, Plus } from 'lucide-react'

interface Props {
  onMenuClick: () => void  // open mobile drawer
}

export function PortalTopBar({ onMenuClick }: Props) {
  const navigate = useNavigate()
  const { balance } = useCredits()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      setEmail(session.user.email ?? session.user.phone ?? '')
      supabase
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          setDisplayName(data?.name ?? '')
        })
    })
  }, [])

  const initials = displayName
    ? displayName.trim().split(' ').slice(-1)[0].slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase()

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

      {/* Desktop: empty left side (sidebar has logo) */}
      <div className="hidden lg:block" />

      {/* Right: credit balance + user menu */}
      <div className="flex items-center gap-3">
        {/* Credit balance */}
        <button
          className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm transition-colors hover:bg-muted"
          onClick={() => navigate('/portal/credits')}
        >
          <CreditCard className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">{balance.toLocaleString('vi-VN')}</span>
          <span className="text-xs text-muted-foreground">credit</span>
          <Plus className="h-3 w-3 text-primary ml-0.5" />
        </button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials || 'TC'}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium truncate">{displayName || 'Tổ chức đấu giá'}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="h-4 w-4 mr-2" />
              Hồ sơ cá nhân
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/portal/credits')}>
              <CreditCard className="h-4 w-4 mr-2" />
              Credit & Thanh toán
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
