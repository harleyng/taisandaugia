import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { MyOrg } from "@/types/orgRbac";
import { qk } from "@/lib/queryKeys";

/**
 * Các tổ chức mà user đang đăng nhập là thành viên ACTIVE, kèm vai trò của họ.
 *
 * Đây là NGUỒN DUY NHẤT để resolve "tổ chức của tôi". Trước đây 5 chỗ tự query
 * `organizations.eq('owner_id', ...)` — cách đó bỏ sót mọi thành viên không phải
 * chủ sở hữu (họ vào portal thấy trống trơn). Tách khỏi OrgContext để dùng được
 * cả ngoài /portal (Header, /profile) mà không cần provider.
 */
export function useMyOrganizations() {
  const { userId } = useAuth();

  return useQuery<MyOrg[]>({
    queryKey: qk.myOrgs.byUser(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_memberships")
        .select(
          "id, role_id, organizations!inner(id,name,kyc_status,license_info,owner_id,created_at), org_roles!inner(id,name,code)",
        )
        .eq("user_id", userId!)
        .eq("status", "ACTIVE");
      if (error) throw error;

      return (data ?? [])
        .map((row): MyOrg | null => {
          const org = row.organizations as unknown as {
            id: string;
            name: string;
            kyc_status: string;
            license_info: Record<string, unknown> | null;
            owner_id: string;
            created_at: string;
          } | null;
          const role = row.org_roles as unknown as {
            id: string;
            name: string;
            code: string;
          } | null;
          if (!org || !role) return null;
          return {
            id: org.id,
            name: org.name,
            kycStatus: org.kyc_status,
            licenseInfo: org.license_info,
            ownerId: org.owner_id,
            createdAt: org.created_at,
            membershipId: row.id,
            roleId: role.id,
            roleCode: role.code,
            roleName: role.name,
          };
        })
        .filter((o): o is MyOrg => o !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  });
}
