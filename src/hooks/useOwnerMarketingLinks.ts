import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isTrackingCode } from "@/lib/ownerMarketing/links";

// Link theo dõi /l/:code CŨ (Phase M1). Từ 20261004210000 mọi link là link Hồ sơ online
// /hs/:code — link /l/ đã gửi đi được chuyển (giữ nguyên id) và chỉ còn việc tra mã mới.

export type LegacyLinkResult = { ok: true; code: string } | { ok: false };

/** /l/<mã 8 ký tự> ⇒ mã Hồ sơ online. Lượt mở được đếm ở /hs/ (get_shared_posting). */
export function useResolveLegacyLink(code: string | undefined) {
  return useQuery({
    queryKey: ["legacy-share-link", code],
    enabled: isTrackingCode(code),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<LegacyLinkResult> => {
      const { data, error } = await supabase.rpc("resolve_legacy_share_link", { p_code: code! });
      if (error) throw error;
      const d = (data ?? {}) as { ok?: unknown; code?: unknown };
      return d.ok === true && typeof d.code === "string" ? { ok: true, code: d.code } : { ok: false };
    },
  });
}
