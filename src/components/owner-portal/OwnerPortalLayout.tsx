import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { OwnerPortalSidebar } from './OwnerPortalSidebar'
import { OwnerPortalTopBar } from './OwnerPortalTopBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function OwnerPortalLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — fixed 240px */}
      <div className="hidden lg:flex lg:w-60 lg:shrink-0">
        <OwnerPortalSidebar />
      </div>

      {/* Mobile sidebar — sheet/drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <OwnerPortalSidebar onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <OwnerPortalTopBar onMenuClick={() => setDrawerOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {/* Tầng 3 — lỗi ở một trang con không xoá sidebar/topbar, người
              dùng vẫn điều hướng đi nơi khác được. */}
          <ErrorBoundary label='Cổng chủ tài sản' compact>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
