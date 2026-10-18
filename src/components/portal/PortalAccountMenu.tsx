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
import { useOrg } from '@/contexts/OrgContext'
import { supabase } from '@/integrations/supabase/client'
import { Coins } from 'lucide-react'

interface Props {
  /** Đóng drawer trên mobile trước khi chuyển trang. */
  onNavigate?: () => void
}

/**
 * Khối tài khoản ở chân sidebar cổng tổ chức — cùng kiểu với cổng chủ tài sản
 * (OwnerPortalAccountMenu): một dòng hồ sơ gồm tên tổ chức, MST và số dư credit.
 * "Credit & Thanh toán", "Quay lại Marketplace" và đăng xuất nằm trong menu hồ sơ.
 */
export function PortalAccountMenu({ onNavigate }: Props) {
  const navigate = useNavigate()
  const { balance } = useCredits()
  const { currentOrg } = useOrg()

  // Tên lấy từ membership qua OrgContext — thành viên không phải chủ sở hữu cũng thấy.
  const companyName = currentOrg?.name ?? ''
  const licenseInfo = currentOrg?.licenseInfo as Record<string, string> | null | undefined
  const companyIdentifier = licenseInfo?.tax_code ?? licenseInfo?.registrationCode ?? ''

  const initials = companyName
    ? companyName.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'TC'

  function go(path: string) {
    onNavigate?.()
    navigate(path)
  }

  async function handleSignOut() {
    onNavigate?.()
    await supabase.auth.signOut()
    navigate('/')
  }

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
                {companyName || 'Tổ chức đấu giá'}
              </span>
              <span className="block truncate text-[11px] leading-[1.3] text-sidebar-foreground/60">
                {companyIdentifier ? `MST: ${companyIdentifier}` : 'Cổng tổ chức'}
              </span>
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
          <div className="p-[3px]">
            <div className="min-w-0 rounded-md bg-muted px-2 py-1.5">
              <small className="block text-[10.5px] text-muted-foreground">Số dư</small>
              <b className="block truncate text-xs font-semibold">{balanceText} credit</b>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="px-2 py-[5px] text-[13px]" onClick={() => go('/portal/credits')}>
            Credit & Thanh toán
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
