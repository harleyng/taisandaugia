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
import { useOwnerWorkspace } from '@/hooks/useOwnerWorkspace'
import { useOwnerPortalName } from '@/hooks/useOwnerPortalName'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { ownerWsAccessLabel } from '@/lib/ownerWorkspace/roles'
import { CreditCard, LogOut, Menu, Plus, ChevronRight, ArrowLeft } from 'lucide-react'

type PageMeta = { title: string; parent?: string }

const PAGE_META: Record<string, PageMeta> = {
  '/chu-tai-san/dashboard': { title: 'Tổng quan' },
  '/chu-tai-san/tai-san': { title: 'Tài sản' },
  '/chu-tai-san/ket-qua': { title: 'Kết quả phiên' },
  '/chu-tai-san/dong-tien': { title: 'Dòng tiền' },
  '/chu-tai-san/dang-tai-san': { title: 'Số hoá tài sản' },
  '/chu-tai-san/hop-dong-mua-ban': { title: 'Hợp đồng mua bán' },
  '/chu-tai-san/bao-cao': { title: 'Phân tích danh mục' },
  '/chu-tai-san/bao-cao-dinh-ky': { title: 'Báo cáo định kỳ' },
  '/chu-tai-san/chi-nhanh-amc': { title: 'Chi nhánh' },
  '/chu-tai-san/thanh-vien': { title: 'Thành viên' },
  '/chu-tai-san/lien-ket': { title: 'Liên kết' },
  '/chu-tai-san/credits': { title: 'Credit & Thanh toán' },
}

/** Khớp đường dẫn tĩnh trước, rồi tới các route có tham số (chi tiết hồ sơ). */
function pageMetaFor(pathname: string): PageMeta | undefined {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname.startsWith('/chu-tai-san/dang-tai-san/')) {
    return { title: 'Chi tiết hồ sơ', parent: 'Số hoá tài sản' }
  }
  if (pathname.startsWith('/chu-tai-san/hop-dong-mua-ban/')) {
    return { title: 'Chi tiết hợp đồng', parent: 'Hợp đồng mua bán' }
  }
  if (pathname.startsWith('/chu-tai-san/bao-cao-dinh-ky/')) {
    return { title: 'Chi tiết báo cáo', parent: 'Báo cáo định kỳ' }
  }
  return undefined
}

interface Props {
  onMenuClick: () => void
}

export function OwnerPortalTopBar({ onMenuClick }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { balance } = useCredits()
  const page = pageMetaFor(location.pathname)
  const { userId } = useAuth()
  const { workspace, role, accessVia, isPersonal } = useOwnerWorkspace()
  const [kycNames, setKycNames] = useState<{ org: string; individual: string }>({ org: '', individual: '' })
  // Thành viên (kể cả người được mời) thấy tên đơn vị; tenant Cá nhân thấy tên KYC cá nhân.
  const displayName = isPersonal
    ? kycNames.individual || kycNames.org
    : workspace?.primary_name || kycNames.org || kycNames.individual

  // Tên tab theo trang; rời cổng thì trả lại tiêu đề cũ để không dính sang trang khác.
  useEffect(() => {
    const previous = document.title
    return () => { document.title = previous }
  }, [])

  const portalName = useOwnerPortalName()
  const tabTitle = page ? `${page.title} · ${portalName}` : portalName
  useEffect(() => {
    document.title = tabTitle
  }, [tabTitle])

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
          onClick={() => navigate('/chu-tai-san/credits')}
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
              {isPersonal
                ? <p className="text-xs text-muted-foreground">Cá nhân</p>
                : role && <p className="text-xs text-muted-foreground">{ownerWsAccessLabel(role, accessVia ?? 'member')}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại Marketplace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/chu-tai-san/credits')}>
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
