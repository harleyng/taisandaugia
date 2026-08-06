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
import { useOrg } from '@/contexts/OrgContext'
import { supabase } from '@/integrations/supabase/client'
import { CreditCard, LogOut, Menu, Plus, ChevronRight, ArrowLeft } from 'lucide-react'

const PAGE_META: Record<string, { title: string; parent?: string }> = {
  '/portal/dashboard': { title: 'Tổng quan' },
  '/portal/nang-luc/thong-tin-chung': { title: 'Thông tin chung', parent: 'Hồ sơ năng lực' },
  '/portal/nang-luc/dau-gia-vien': { title: 'Đấu giá viên', parent: 'Hồ sơ năng lực' },
  '/portal/nhan-su': { title: 'Hồ sơ nhân sự' },
  '/portal/nang-luc/tu-tai-lieu': { title: 'Tủ tài liệu', parent: 'Hồ sơ năng lực' },
  '/portal/nang-luc/co-so-vat-chat': { title: 'Cơ sở vật chất', parent: 'Hồ sơ năng lực' },
  '/portal/nang-luc/lich-su-dau-gia': { title: 'Lịch sử đấu giá', parent: 'Hồ sơ năng lực' },
  '/portal/nang-luc/tai-chinh': { title: 'Tài chính & Thuế', parent: 'Hồ sơ năng lực' },
  '/portal/ho-so-du-tuyen': { title: 'Hồ sơ dự tuyển' },
  '/portal/ho-so-du-tuyen/new': { title: 'Lập hồ sơ dự tuyển', parent: 'Hồ sơ dự tuyển' },
  '/portal/credits': { title: 'Credit & Thanh toán' },
  '/portal/to-chuc/thanh-vien': { title: 'Thành viên', parent: 'Tổ chức' },
  '/portal/to-chuc/vai-tro': { title: 'Vai trò', parent: 'Tổ chức' },
}

// Route động (/vai-tro/:id, /ho-so-du-tuyen/:id) không có khóa khớp chính xác —
// lùi về mục cha dài nhất thay vì để breadcrumb trống.
function resolvePage(pathname: string) {
  const exact = PAGE_META[pathname]
  if (exact) return exact
  const prefix = Object.keys(PAGE_META)
    .filter((k) => pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return prefix ? PAGE_META[prefix] : undefined
}

interface Props {
  onMenuClick: () => void  // open mobile drawer
}

export function PortalTopBar({ onMenuClick }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { balance } = useCredits()
  const { currentOrg } = useOrg()
  const page = resolvePage(location.pathname)

  // Trước đây tên công ty được query bằng owner_id ⇒ thành viên không phải chủ
  // sở hữu luôn thấy trống. Nay lấy từ membership qua OrgContext.
  const companyName = currentOrg?.name ?? ''
  const licenseInfo = currentOrg?.licenseInfo as Record<string, string> | null | undefined
  const companyIdentifier = licenseInfo?.tax_code ?? licenseInfo?.registrationCode ?? ''

  const initials = companyName
    ? companyName.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'TC'

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

      {/* Desktop: page breadcrumb — bộ chuyển tổ chức đã dời sang đầu sidebar */}
      <nav className="hidden lg:flex flex-1 items-center gap-1 text-sm min-w-0">
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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium truncate">{companyName || 'Tổ chức đấu giá'}</p>
              {companyIdentifier && (
                <p className="text-xs text-muted-foreground truncate">MST: {companyIdentifier}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại Marketplace
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
