// Bộ chọn cho hai hành động liên kết của kế hoạch đấu giá (Phase 5):
// "Liên kết hồ sơ số hoá" và "Liên kết tin đăng".
//
// ⚠️ Cả hai đọc theo TRẠM CỦA KẾ HOẠCH, không theo không gian đang chọn —
// trang chi tiết kế hoạch mở được từ link nên hai thứ có thể khác nhau
// (`useMyPostings` dùng không gian đang chọn, vì vậy KHÔNG dùng lại ở đây).
//
// Phase 1 đã đo: `admin_unit_resolve` chỉ suy được xã cho 22,9% hồ sơ đang có
// (địa chỉ ba cấp trước sáp nhập), nên ĐỪNG gợi ý hồ sơ theo địa chỉ — lọc theo
// Trạm rồi để người dùng tự chọn.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export interface PlanPostingOption {
  id: string;
  code: string | null;
  title: string;
  address: string | null;
  province: string | null;
  ward: string | null;
  startingPrice: number | null;
  status: string | null;
}

export function useWorkspacePostingOptions(workspaceId: string | null | undefined, enabled = true) {
  return useQuery<PlanPostingOption[]>({
    queryKey: qk.ownerWorkspacePostings(workspaceId),
    enabled: !!workspaceId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_postings")
        .select("id, code, title, address, province, ward, starting_price, status")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        code: p.code ?? null,
        title: p.title ?? "(chưa có tên)",
        address: p.address ?? null,
        province: p.province ?? null,
        ward: p.ward ?? null,
        startingPrice: p.starting_price === null ? null : Number(p.starting_price),
        status: p.status ?? null,
      }));
    },
  });
}

export interface PlanListingOption {
  id: string;
  title: string;
  address: string | null;
  price: number | null;
}

const CLAIMED_STATUSES = ["auto_claimed", "pending_confirmation", "confirmed"];

/**
 * Tin đăng Trạm đã NHẬN. `asset_owner_claims` có thể nhiều dòng cho một tin
 * (mỗi chủ tài sản một dòng) ⇒ gộp theo `listing_id`. Bộ trạng thái "đã nhận"
 * giống `owner_asset_outcomes_resolved_core`.
 */
export function usePlanListingOptions(workspaceId: string | null | undefined, enabled = true) {
  return useQuery<PlanListingOption[]>({
    queryKey: qk.ownerClaimedListings(workspaceId),
    enabled: !!workspaceId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select("listing_id, listing:listings(id, title, address, price)")
        .eq("workspace_id", workspaceId!)
        .in("status", CLAIMED_STATUSES)
        .not("listing_id", "is", null);
      if (error) throw error;
      const byId = new Map<string, PlanListingOption>();
      for (const row of data ?? []) {
        const l = (row as { listing: PlanListingOption | null }).listing;
        if (l?.id && !byId.has(l.id)) {
          byId.set(l.id, { id: l.id, title: l.title, address: l.address ?? null, price: l.price ?? null });
        }
      }
      return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, "vi"));
    },
  });
}
