import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCredits } from '@/hooks/useCredits'
import { useOwnerWorkspace } from '@/hooks/useOwnerWorkspace'
import { useOwnerSubscription } from '@/hooks/useOwnerSubscription'
import { EXPIRY_WARNING_DAYS, daysLeft, formatSubDate, vnToday } from '@/lib/ownerSubscription/status'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { ownerWsAccessLabel } from '@/lib/ownerWorkspace/roles'
import { ArrowLeft, BadgeCheck, ChevronsUpDown, CreditCard, LogOut, Plus } from 'lucide-react'

interface Props {
  /** Đóng drawer trên mobile trước khi chuyển trang. */
  onNavigate?: () => void
}

/**
 * Khối tài khoản ở chân sidebar cổng chủ tài sản: số dư credit + hồ sơ người dùng.
 * "Quay lại Marketplace" và đăng xuất nằm trong menu hồ sơ — cổng không còn top bar.
 */
export function OwnerPortalAccountMenu({ onNavigate }: Props) {
  const navigate = useNavigate()
  const { balance } = useCredits()
  const { userId } = useAuth()
  const { workspace, workspaceId, roleName, accessVia, isPersonal } = useOwnerWorkspace()
  // Gói thuê bao của Trạm đang chọn — chỉ hiện dòng khi gói đã / đang có hiệu lực.
  const { data: sub } = useOwnerSubscription(isPersonal ? null : workspaceId)
  const subShown = !!sub && ['active', 'scheduled', 'expired'].includes(sub.status)
  const subDaysLeft = sub ? daysLeft(sub.ends_on, vnToday()) : null
  const subWarn = !!sub && (sub.status === 'expired' || (subDaysLeft !== null && subDaysLeft <= EXPIRY_WARNING_DAYS))
  const [kycNames, setKycNames] = useState<{ org: string; individual: string }>({ org: '', individual: '' })
  // Thành viên (kể cả người được mời) thấy tên đơn vị; tenant Cá nhân thấy tên KYC cá nhân.
  const displayName = isPersonal
    ? kycNames.individual || kycNames.org
    : workspace?.primary_name || kycNames.org || kycNames.individual
  const subtitle = isPersonal ? 'Cá nhân' : roleName ? ownerWsAccessLabel(roleName, accessVia ?? 'member') : null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('asset_owner_org_kyc').select('org_name').eq('created_by', userId).eq('status', 'approved').maybeSingle(),
      supabase.from('asset_owner_kyc').select('full_name').eq('user_id', userId).eq('status', 'approved').maybeSingle(),
    ]).then(([org, ind]) => {
      if (!cancelled) setKycNames({ org: org.data?.org_name ?? '', individual: ind.data?.full_name ?? '' })
    })
    return () => { cancelled = true }
  }, [userId])

  const initials = displayName
    ? displayName.trim().split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()
    : 'CT'

  function go(path: string) {
    onNavigate?.()
    navigate(path)
  }

  async function handleSignOut() {
    onNavigate?.()
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="border-t border-sidebar-border px-3 py-3 shrink-0 space-y-1">
      {subShown && sub && (
        <button
          onClick={() => go('/chu-tai-san/goi-thue-bao')}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <BadgeCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate text-left">Gói</span>
          <span className={subWarn ? 'font-semibold text-warning' : 'text-sidebar-foreground'}>
            {sub.status === 'expired' ? 'Hết hạn' : `đến ${formatSubDate(sub.ends_on)}`}
          </span>
        </button>
      )}
      <button
        onClick={() => go('/chu-tai-san/credits')}
        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <CreditCard className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="min-w-0 flex-1 truncate text-left">Credit</span>
        <span className="font-semibold text-sidebar-foreground">{balance.toLocaleString('vi-VN')}</span>
        <Plus className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60" aria-label="Mua thêm credit" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-sidebar-foreground">
                {displayName || 'Chủ tài sản'}
              </span>
              {subtitle && (
                <span className="block truncate text-xs text-sidebar-foreground/60">{subtitle}</span>
              )}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[14rem]"
        >
          <DropdownMenuItem onClick={() => go('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại Marketplace
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => go('/chu-tai-san/credits')}>
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
  )
}
