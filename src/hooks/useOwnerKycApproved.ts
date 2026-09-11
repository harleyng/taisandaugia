import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Người dùng đã được duyệt KYC chủ tài sản (cá nhân HOẶC tổ chức) chưa.
 *
 * Cổng của khu số hoá tài sản. Để trong React Query thay vì useEffect tại trang
 * để danh sách ↔ chi tiết hồ sơ (hai route) không kiểm lại và nháy loader mỗi
 * lần chuyển.
 */
export function useOwnerKycApproved() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["owner-kyc-approved", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [ind, org] = await Promise.all([
        supabase
          .from("asset_owner_kyc")
          .select("status")
          .eq("user_id", userId!)
          .eq("status", "approved")
          .maybeSingle(),
        supabase
          .from("asset_owner_org_kyc")
          .select("status")
          .eq("created_by", userId!)
          .eq("status", "approved")
          .maybeSingle(),
      ]);
      if (ind.error) throw ind.error;
      if (org.error) throw org.error;
      return !!ind.data || !!org.data;
    },
  });
}
