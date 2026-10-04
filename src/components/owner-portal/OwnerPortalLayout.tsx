import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { OwnerPortalSidebar } from './OwnerPortalSidebar'
import { OwnerPortalMobileBar } from './OwnerPortalMobileBar'
import { OwnerPermissionGate } from './OwnerPermissionGate'
import { OwnerGuideButton } from './OwnerGuideButton'
import { ownerPageTitle } from './owner-page-titles'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useOwnerWorkspace } from '@/hooks/useOwnerWorkspace'
import { useOwnerPortalName } from '@/hooks/useOwnerPortalName'
import { useOwnerPageViewTracker } from '@/hooks/useOwnerAuditLog'

export function OwnerPortalLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Đổi không gian ⇒ dựng lại trang con từ đầu, để trạng thái cục bộ (bộ lọc,
  // cờ đã mở khoá báo cáo…) của không gian cũ không dính sang không gian mới.
  // Chỉ khi NGƯỜI DÙNG đổi — lúc danh sách không gian vừa tải xong thì không,
  // kẻo trang đang nhập dở (vd. wizard số hoá) bị dựng lại.
  const { workspaceId, isLoading: wsLoading } = useOwnerWorkspace()
  const portalName = useOwnerPortalName()
  // Nhật ký hoạt động: "Truy cập" một lần / phiên + lượt xem mỗi trang trong cổng.
  useOwnerPageViewTracker()
  const settledWorkspace = useRef<string | null | undefined>(undefined)
  const [outletKey, setOutletKey] = useState('initial')
  useEffect(() => {
    if (wsLoading) return
    if (settledWorkspace.current === undefined) {
      settledWorkspace.current = workspaceId
      return
    }
    if (settledWorkspace.current !== workspaceId) {
      settledWorkspace.current = workspaceId
      setOutletKey(workspaceId ?? 'none')
    }
  }, [wsLoading, workspaceId])

  // Tên tab theo trang; rời cổng thì trả lại tiêu đề cũ để không dính sang trang khác.
  const { pathname } = useLocation()
  const pageTitle = ownerPageTitle(pathname)
  const tabTitle = pageTitle ? `${pageTitle} · ${portalName}` : portalName
  useEffect(() => {
    const previous = document.title
    return () => { document.title = previous }
  }, [])
  useEffect(() => {
    document.title = tabTitle
  }, [tabTitle])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — fixed 240px */}
      <div className="hidden lg:flex lg:w-60 lg:shrink-0">
        <OwnerPortalSidebar />
      </div>

      {/* Mobile sidebar — sheet/drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-60 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <OwnerPortalSidebar onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <OwnerPortalMobileBar onMenuClick={() => setDrawerOpen(true)} />

        {/* Page content — nền xám; thẻ nằm thẳng trên nền bỏ viền, đổ bóng
            (quy tắc .owner-canvas trong index.css). */}
        <main className="owner-canvas flex-1 overflow-y-auto bg-muted">
          {/* Khung trang DUY NHẤT của cổng: lề + bề rộng tối đa đặt ở đây để mọi
              trang con thẳng mép nhau. Trang con KHÔNG tự thêm padding/max-w ở gốc. */}
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
            {/* Tầng 3 — lỗi ở một trang con không xoá sidebar/topbar, người
                dùng vẫn điều hướng đi nơi khác được. */}
            <ErrorBoundary key={outletKey} label={portalName} compact>
              <OwnerPermissionGate>
                <Outlet />
              </OwnerPermissionGate>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <OwnerGuideButton />
    </div>
  )
}
