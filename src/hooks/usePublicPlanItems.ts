/* eslint-disable @typescript-eslint/no-explicit-any */
// Trang CÔNG KHAI "Sắp đấu giá theo kế hoạch" — đọc + theo dõi.
//
// ⚠️ `(supabase as any)`: `src/integrations/supabase/types.ts` KHÔNG sinh lại
// được ở máy hiện tại (token CLI thuộc tài khoản Supabase khác, `--db-url` cần
// Docker) nên các RPC `*_public_plan_*` của Phase 10 không có trong kiểu tự
// sinh — cùng lý do đã ghi ở đầu `src/hooks/useAuctionPlan.ts`. Kiểu thật nằm ở
// `src/lib/publicPlanItems.ts`.
//
// Key để TẠI ĐÂY (không gom vào queryKeys.ts): cả chỗ đọc lẫn chỗ invalidate
// đều trong file này, đúng luật phạm vi ở đầu queryKeys.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  parsePublicPlanItem,
  parsePublicPlanUnit,
  type PublicPlanItem,
  type PublicPlanUnit,
} from "@/lib/publicPlanItems";

const itemsKey = (code: string | null) => ["public-plan-items", code] as const;
const unitsKey = (provinceCode: string | null) => ["public-plan-units", provinceCode] as const;
const provincesKey = ["public-plan-provinces"] as const;

/** Các tỉnh/thành phố đang công khai danh mục — để trang mở ra đã có dữ liệu. */
export function usePublicPlanProvinces() {
  return useQuery<PublicPlanUnit[]>({
    queryKey: provincesKey,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_plan_provinces");
      if (error) throw error;
      return ((data ?? []) as unknown[])
        .map(parsePublicPlanUnit)
        .filter((x): x is PublicPlanUnit => x !== null);
    },
  });
}

/** Danh mục dự kiến đã công khai của một tỉnh (mã 2 chữ số) hoặc một xã (5 chữ số). */
export function usePublicPlanItems(adminUnitCode: string | null) {
  return useQuery<PublicPlanItem[]>({
    queryKey: itemsKey(adminUnitCode),
    enabled: !!adminUnitCode,
    // Kế hoạch năm đổi rất chậm — không cần làm mới khi quay lại tab.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_plan_items", {
        p_admin_unit_code: adminUnitCode,
        p_year: null,
      });
      if (error) throw error;
      return ((data ?? []) as unknown[])
        .map(parsePublicPlanItem)
        .filter((x): x is PublicPlanItem => x !== null);
    },
  });
}

/** Các xã/phường của một tỉnh đang công khai danh mục + số tài sản. */
export function usePublicPlanUnits(provinceCode: string | null) {
  return useQuery<PublicPlanUnit[]>({
    queryKey: unitsKey(provinceCode),
    enabled: !!provinceCode,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_plan_units", {
        p_province_code: provinceCode,
        p_year: null,
      });
      if (error) throw error;
      return ((data ?? []) as unknown[])
        .map(parsePublicPlanUnit)
        .filter((x): x is PublicPlanUnit => x !== null);
    },
  });
}

/**
 * Theo dõi / bỏ theo dõi một tài sản. Chỉ gửi `public_code` — phía client KHÔNG
 * BAO GIỜ biết id thật của tài sản. RPC chỉ cho `authenticated` gọi, nên nút
 * phải mở hộp đăng nhập trước khi gọi (xem `PlanFollowButton`).
 *
 * `scopeCode` = mã đang xem, để invalidate đúng danh sách đang hiển thị.
 */
export function useFollowPublicPlanItem(scopeCode: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, follow }: { code: string; follow: boolean }) => {
      const { data, error } = await (supabase as any).rpc("follow_public_plan_item", {
        p_code: code,
        p_follow: follow,
      });
      if (error) throw error;
      const payload = (data ?? {}) as { ok?: boolean; reason?: string };
      if (payload.ok === false) {
        throw new Error(
          payload.reason === "not_authenticated"
            ? "Bạn cần đăng nhập để theo dõi tài sản."
            : "Tài sản này không còn được công khai.",
        );
      }
      return follow;
    },
    onSuccess: (follow) => {
      qc.invalidateQueries({ queryKey: itemsKey(scopeCode) });
      toast.success(follow ? "Đã theo dõi — sẽ nhận thông báo khi có phiên." : "Đã bỏ theo dõi.");
    },
    onError: (e: Error) => toast.error(e.message || "Không lưu được. Vui lòng thử lại."),
  });
}
