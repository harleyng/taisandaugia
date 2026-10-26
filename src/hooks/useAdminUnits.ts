/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sortAdminUnits, type AdminUnit } from "@/lib/adminUnits";

/**
 * Danh mục đơn vị hành chính (`public.admin_units`) — dữ liệu tham chiếu TĨNH:
 * `staleTime: Infinity` vì nó chỉ đổi khi có nghị quyết sáp nhập mới, và cả 34
 * tỉnh (hoặc ~100 xã của một tỉnh) đều nhỏ.
 *
 * Bảng cho `anon` + `authenticated` đọc, nên hook chạy được cả ở trang công khai.
 * Dùng `(supabase as any)`: `admin_units` chưa có trong `types.ts` (xem phần
 * "Gate" của báo cáo Phase 1 — máy này không sinh lại được types), bỏ cast khi
 * types đã được sinh lại.
 *
 * Query key để TẠI ĐÂY, không gom vào `src/lib/queryKeys.ts`: không có mutation
 * nào invalidate nó (luật phạm vi ghi ở đầu queryKeys.ts).
 */

const SELECT = "code, name, level, unit_type, parent_code, legacy_names, is_active";

/**
 * `provinceCode` rỗng ⇒ trả 34 tỉnh/thành phố. Có mã tỉnh ⇒ trả các xã/phường/
 * đặc khu của tỉnh đó. Chỉ lấy đơn vị còn hiệu lực (`is_active`).
 */
export function useAdminUnits(provinceCode?: string | null) {
  return useQuery<AdminUnit[]>({
    queryKey: ["admin-units", provinceCode ?? "provinces"],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      let q = (supabase as any).from("admin_units").select(SELECT).eq("is_active", true);
      q = provinceCode
        ? q.eq("level", "commune").eq("parent_code", provinceCode)
        : q.eq("level", "province");
      const { data, error } = await q.order("code");
      if (error) throw error;
      return sortAdminUnits((data ?? []) as AdminUnit[]);
    },
  });
}

/**
 * Một đơn vị theo mã — để hiện nhãn của mã đã lưu (và suy ra tỉnh cha của một
 * mã cấp xã) mà không phải tải cả danh mục.
 */
export function useAdminUnit(code?: string | null) {
  return useQuery<AdminUnit | null>({
    queryKey: ["admin-units", "by-code", code],
    enabled: !!code,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("admin_units")
        .select(SELECT)
        .eq("code", code!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AdminUnit | null;
    },
  });
}
