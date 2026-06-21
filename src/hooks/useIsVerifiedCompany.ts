import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Có phải user sở hữu một tổ chức đã KYC APPROVED không (để hiện badge công ty
 * đã xác thực ở Header). Tách thành React Query để cache + dedupe thay vì fetch
 * thủ công trong useEffect mỗi lần Header mount.
 */
export function useIsVerifiedCompany(userId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["is-verified-company", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", userId!)
        .eq("kyc_status", "APPROVED")
        .limit(1)
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  return data ?? false;
}
