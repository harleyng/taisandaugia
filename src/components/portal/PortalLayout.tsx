import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { OrgProvider } from '@/contexts/OrgContext'
import { PortalSidebar } from './PortalSidebar'
import { PortalTopBar } from './PortalTopBar'
import { PortalNoOrgGate } from './PortalNoOrgGate'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { migrateCapacityFromLocal } from '@/lib/capacity/migrate-from-local'

/**
 * Di trú một lần dữ liệu Hồ sơ năng lực còn sót trong localStorage.
 *
 * Đặt ở layout portal thay vì từng trang: cả 5 module đều nằm dưới /portal, và
 * người dùng có thể vào bất kỳ trang nào trước — chạy ở layout thì đường nào
 * cũng phủ, và chỉ chạy đúng một lần cho mỗi tổ chức.
 */
function CapacityMigrationGate(): null {
  const { organizationId } = usePortalOrg()
  const qc = useQueryClient()
  const ranRef = useRef(false)

  useEffect(() => {
    if (!organizationId || ranRef.current) return
    ranRef.current = true
    migrateCapacityFromLocal(organizationId).then((r) => {
      if (!r.ran) return
      // Làm mới TOÀN BỘ cache của portal: dữ liệu vừa xuất hiện ở nhiều bảng.
      qc.invalidateQueries()
      const parts = [
        r.generalInfo && 'thông tin chung',
        r.taxRecords > 0 && `${r.taxRecords} bản ghi thuế`,
        r.infrastructure && 'cơ sở vật chất',
        r.applications > 0 && `${r.applications} hồ sơ dự tuyển`,
      ].filter(Boolean)
      if (parts.length > 0) {
        toast.success(`Đã chuyển ${parts.join(', ')} lên máy chủ`)
      }
      if (r.errors.length > 0) {
        toast.error(`Còn ${r.errors.length} mục chưa chuyển được — sẽ thử lại lần sau`)
      }
    })
  }, [organizationId, qc])

  return null
}

// OrgProvider mount Ở ĐÂY chứ không phải App.tsx: giữ nguyên thứ tự provider
// hiện có (PaywallProvider phải nằm trong Router) và không ép trang ngoài portal
// phải có org context.
export function PortalLayout() {
  return (
    <OrgProvider>
      <PortalNoOrgGate>
        <CapacityMigrationGate />
        <PortalShell />
      </PortalNoOrgGate>
    </OrgProvider>
  )
}

function PortalShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — fixed 240px */}
      <div className="hidden lg:flex lg:w-60 lg:shrink-0">
        <PortalSidebar />
      </div>

      {/* Mobile sidebar — sheet/drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <PortalSidebar onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <PortalTopBar onMenuClick={() => setDrawerOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {/* Tầng 3 — lỗi ở một trang con không xoá sidebar/topbar, người
              dùng vẫn điều hướng đi nơi khác được. */}
          <ErrorBoundary label='Cổng tổ chức' compact>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
