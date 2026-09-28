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
import { Coins } from 'lucide-react'

interface Props {
  /** Đóng drawer trên mobile trước khi chuyển trang. */
  onNavigate?: () => void
}

/**
 * Khối tài khoản ở chân sidebar cổng chủ tài sản (design "Sidebar Account Menu" — phương án A):
 * một dòng hồ sơ gộp tên gói (subtitle, đổi màu khi sắp hết hạn / link khi chưa có gói) và số dư
 * credit. Chi tiết gói + credit, "Quay lại Marketplace" và đăng xuất nằm trong menu hồ sơ.
 */
export function OwnerPortalAccountMenu({ onNavigate }: Props) {
  const navigate = useNavigate()
  const { balance } = useCredits()
  const { userId } = useAuth()
  const { workspace, workspaceId, isPersonal } = useOwnerWorkspace()
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

  const subtitleNode = (() => {
    if (isPersonal) return <span className="block truncate text-[11px] leading-[1.3] text-sidebar-foreground/60">Cá nhân</span>
    if (subShown && sub && subWarn) {
      return (
        <span
          className="flex items-center gap-1 truncate text-[11px] font-semibold leading-[1.3] text-warning"
          title={
            sub.status === 'expired'
              ? 'Gói đã hết hạn'
              : `Gói sắp hết hạn${sub.ends_on ? ` (${formatSubDate(sub.ends_on)})` : ''}`
          }
        >
          <i className="inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-warning" />
          <span className="truncate">{sub.plan_name}</span>
        </span>
      )
    }
    if (subShown && sub) {
      return <span className="block truncate text-[11px] leading-[1.3] text-sidebar-foreground/60">{sub.plan_name}</span>
    }
    // Chưa có gói: subtitle là lối tắt tới trang gói — chặn pointerdown để không mở menu.
    return (
      <span
        role="link"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          go('/chu-tai-san/goi-thue-bao')
        }}
        className="block truncate text-[11px] font-medium leading-[1.3] text-[hsl(152_60%_55%)] hover:text-[hsl(152_60%_65%)]"
      >
        Nâng cấp gói
      </span>
    )
  })()

  const balanceText = balance.toLocaleString('vi-VN')

  return (
    <div className="border-t border-sidebar-border p-3 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-[1.3] text-sidebar-foreground">
                {displayName || 'Chủ tài sản'}
              </span>
              {subtitleNode}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1" title={`Số dư ${balanceText} credit`}>
              <Coins className="h-3 w-3 text-warning" />
              <span className="text-xs font-semibold text-sidebar-foreground">{balanceText}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[14rem] p-[3px] text-[13px]"
        >
          <div className={`grid gap-[3px] p-[3px] ${isPersonal ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {!isPersonal && (
              <div className="min-w-0 rounded-md bg-muted px-2 py-1.5">
                <small className="block text-[10.5px] text-muted-foreground">Gói hiện tại</small>
                <b className={`block truncate text-xs font-semibold ${subWarn ? 'text-warning' : ''}`}>
                  {subShown && sub ? sub.plan_name : 'Chưa có gói'}
                </b>
              </div>
            )}
            <div className="min-w-0 rounded-md bg-muted px-2 py-1.5">
              <small className="block text-[10.5px] text-muted-foreground">Số dư</small>
              <b className="block truncate text-xs font-semibold">{balanceText} credit</b>
            </div>
          </div>
          <DropdownMenuSeparator />
          {!isPersonal && (
            <DropdownMenuItem className="px-2 py-[5px] text-[13px]" onClick={() => go('/chu-tai-san/goi-thue-bao')}>
              Quản lý gói dịch vụ
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="px-2 py-[5px] text-[13px]" onClick={() => go('/chu-tai-san/credits')}>
            Mua thêm credit
          </DropdownMenuItem>
          <DropdownMenuItem className="px-2 py-[5px] text-[13px]" onClick={() => go('/')}>
            Quay lại Marketplace
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="px-2 py-[5px] text-[13px] text-destructive focus:text-destructive"
          >
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
