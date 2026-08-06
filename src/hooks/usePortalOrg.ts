import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export interface PortalOrg {
  organizationId: string | null
  auctionOrgId: string | null
  orgName: string | null
  kycStatus: string | null
}

const EMPTY: PortalOrg = {
  organizationId: null,
  auctionOrgId: null,
  orgName: null,
  kycStatus: null,
}

/**
 * Tổ chức mà user đang đăng nhập sở hữu, dùng cho mọi ghi/đọc trong /portal.
 *
 * Đây là thứ thay thế hằng số `orgId: 'default'` từng hardcode trong
 * useAuctioneers/AuctioneerForm. `auctionOrgId` là cầu nối sang danh bạ công
 * khai (auction_organizations) — cùng cách resolve như ThongTinChungPage.
 */
export function usePortalOrg() {
  const { userId } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['portal-org', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PortalOrg> => {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('id, name, kyc_status, license_info')
        .eq('owner_id', userId!)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error
      const org = orgs?.[0]
      if (!org) return EMPTY

      const licenseInfo = (org.license_info ?? {}) as Record<string, unknown>
      const auctionOrgId = (licenseInfo.auction_org_id as string | undefined) ?? null

      return {
        organizationId: org.id,
        auctionOrgId,
        orgName: org.name ?? null,
        kycStatus: org.kyc_status ?? null,
      }
    },
  })

  return {
    ...(data ?? EMPTY),
    isLoading,
    /** Chưa xác thực tổ chức ⇒ chưa ghi được gì vào /portal. */
    hasOrg: !!data?.organizationId,
  }
}
