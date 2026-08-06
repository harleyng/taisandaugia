import { useQuery } from '@tanstack/react-query'
import * as repo from '@/lib/applications/supabase-repo'
import { qk } from '@/lib/queryKeys'
import { usePortalOrg } from '@/hooks/usePortalOrg'

/**
 * Danh sách hồ sơ dự tuyển của tổ chức.
 *
 * Tách thành hook riêng vì ba nơi cùng cần (trang Hồ sơ, Dashboard, modal "Sao
 * chép từ hồ sơ trước) và trước đây cả ba gọi listApplications() ĐỒNG BỘ ngay
 * trong thân render — không còn làm được khi dữ liệu đi qua mạng.
 */
export function useApplicationsList() {
  const { organizationId } = usePortalOrg()

  const { data: applications = [], isLoading } = useQuery({
    queryKey: qk.orgApplications.list(organizationId),
    enabled: !!organizationId,
    queryFn: () => repo.listApplications(organizationId!),
  })

  return { applications, isLoading }
}
