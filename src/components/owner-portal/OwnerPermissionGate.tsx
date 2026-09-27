import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useOwnerWorkspace } from '@/hooks/useOwnerWorkspace'
import { ownerModulesForPath } from './owner-nav-config'

const OWNER_HOME_HREF = '/chu-tai-san/dashboard'

/**
 * Chặn trang của Trạm Điều Hành mà vai trò không có quyền "Xem" (gõ thẳng URL, link
 * cũ) ⇒ về Tổng quan. Một chỗ duy nhất trong layout thay vì bọc từng route: bảng
 * đường dẫn → module ở ownerModulesForPath (trang chi tiết mở theo bản ghi không
 * chặn ở đây). Chỉ là lớp UI — dữ liệu ghi do RLS / RPC (owner_ws_has) chặn.
 * Tenant Cá nhân, chưa có không gian, đang tải ⇒ cho qua.
 */
export function OwnerPermissionGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { workspaceId, isPersonal, can, isLoading } = useOwnerWorkspace()
  const modules = ownerModulesForPath(pathname)

  if (!modules || isLoading || isPersonal || !workspaceId) return <>{children}</>
  if (modules.some((m) => can(m, 'view'))) return <>{children}</>
  return <Navigate to={OWNER_HOME_HREF} replace />
}
