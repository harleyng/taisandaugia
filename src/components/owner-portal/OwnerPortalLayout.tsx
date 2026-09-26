import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { OwnerPortalSidebar } from './OwnerPortalSidebar'
import { OwnerPortalTopBar } from './OwnerPortalTopBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useOwnerWorkspace } from '@/hooks/useOwnerWorkspace'
import { useOwnerPortalName } from '@/hooks/useOwnerPortalName'

export function OwnerPortalLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Đổi không gian ⇒ dựng lại trang con từ đầu, để trạng thái cục bộ (bộ lọc,
  // cờ đã mở khoá báo cáo…) của không gian cũ không dính sang không gian mới.
  // Chỉ khi NGƯỜI DÙNG đổi — lúc danh sách không gian vừa tải xong thì không,
  // kẻo trang đang nhập dở (vd. wizard số hoá) bị dựng lại.
  const { workspaceId, isLoading: wsLoading } = useOwnerWorkspace()
  const portalName = useOwnerPortalName()
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
        <OwnerPortalTopBar onMenuClick={() => setDrawerOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {/* Khung trang DUY NHẤT của cổng: lề + bề rộng tối đa đặt ở đây để mọi
              trang con thẳng mép nhau. Trang con KHÔNG tự thêm padding/max-w ở gốc. */}
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
            {/* Tầng 3 — lỗi ở một trang con không xoá sidebar/topbar, người
                dùng vẫn điều hướng đi nơi khác được. */}
            <ErrorBoundary key={outletKey} label={portalName} compact>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}
