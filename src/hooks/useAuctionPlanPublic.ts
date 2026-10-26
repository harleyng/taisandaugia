/* eslint-disable @typescript-eslint/no-explicit-any */
// Công khai danh mục dự kiến + số người theo dõi — phía ĐƠN VỊ (Phase 10 của
// docs/owner-auction-planning-plan.md).
//
// ⚠️ `(supabase as any)`: `src/integrations/supabase/types.ts` KHÔNG sinh lại
// được ở máy hiện tại (token CLI thuộc tài khoản Supabase khác, `--db-url` cần
// Docker) nên các RPC của module kế hoạch không có trong kiểu tự sinh — cùng lý
// do đã ghi ở đầu `src/hooks/useAuctionPlan.ts`.
//
// ⚠️ Bật / tắt công khai KHÔNG đi qua quyền cột: `auction_plans.public_opt_in`
// không có GRANT UPDATE cho `authenticated`, chỉ RPC `auction_plan_set_public`
// (SECURITY DEFINER) ghi được, và RPC đó đòi `auction_plan_reviewer_ok` HOẶC
// `auction_plan_can_approve` — người bị giới hạn chi nhánh không bao giờ có.
//
// Key để TẠI ĐÂY: đọc và invalidate đều nằm trong file này (luật phạm vi ở đầu
// src/lib/queryKeys.ts).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { auctionPlanReasonMessage } from "@/lib/auctionPlan/types";
import type { AuctionPlan } from "@/lib/auctionPlan/types";

export interface PlanPublicState {
  optIn: boolean;
  showPrices: boolean;
  canManage: boolean;
  /** Số tài sản SẼ hiện công khai (tính độc lập với công tắc). */
  publicItemCount: number;
  /** Tổng số lượt theo dõi của cả kế hoạch — SỐ ĐẾM, không danh tính. */
  followTotal: number;
}

const stateKey = (planId: string | null | undefined) =>
  ["auction-plan", planId, "public-state"] as const;
const countsKey = (planId: string | null | undefined) =>
  ["auction-plan", planId, "follow-counts"] as const;

/** Câu chữ riêng của thao tác công khai (map chung nói về luồng duyệt). */
function publicReasonMessage(reason: string | undefined): string {
  if (reason === "not_reviewer") {
    return "Chỉ cấp trên (người có quyền Duyệt kế hoạch) hoặc Trưởng đơn vị mới công khai được danh mục.";
  }
  if (reason === "invalid_status") {
    return "Chỉ kế hoạch ĐÃ ĐƯỢC DUYỆT mới công khai được danh mục dự kiến.";
  }
  return auctionPlanReasonMessage(reason);
}

export function usePlanPublicState(planId: string | undefined) {
  return useQuery<PlanPublicState | null>({
    queryKey: stateKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_public_state", {
        p_plan_id: planId,
      });
      if (error) throw error;
      const r = (data ?? {}) as Record<string, unknown>;
      if (r.ok !== true) return null;
      return {
        optIn: r.public_opt_in === true,
        showPrices: r.public_show_prices === true,
        canManage: r.can_manage === true,
        publicItemCount: Number(r.public_item_count ?? 0),
        followTotal: Number(r.follow_total ?? 0),
      };
    },
  });
}

/** Số người theo dõi của TỪNG tài sản — chỉ những tài sản có ít nhất 1 lượt. */
export function usePlanItemFollowCounts(planId: string | undefined) {
  return useQuery<Map<string, number>>({
    queryKey: countsKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_item_follow_counts", {
        p_plan_id: planId,
      });
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of (data ?? []) as { item_id: string; follow_count: number }[]) {
        map.set(row.item_id, Number(row.follow_count ?? 0));
      }
      return map;
    },
  });
}

export function useSetPlanPublic(plan: AuctionPlan | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ optIn, showPrices }: { optIn: boolean; showPrices: boolean }) => {
      const { data, error } = await (supabase as any).rpc("auction_plan_set_public", {
        p_plan_id: plan?.id,
        p_opt_in: optIn,
        p_show_prices: showPrices,
      });
      if (error) throw error;
      const r = (data ?? {}) as { ok?: boolean; reason?: string };
      if (r.ok === false) throw new Error(publicReasonMessage(r.reason));
      return optIn;
    },
    onSuccess: (optIn) => {
      qc.invalidateQueries({ queryKey: stateKey(plan?.id) });
      // Nhật ký của kế hoạch có thêm một dòng ⇒ làm mới cả nhánh kế hoạch.
      qc.invalidateQueries({ queryKey: qk.auctionPlan(plan?.id) });
      toast.success(
        optIn ? "Đã công khai danh mục dự kiến trên trang tìm tài sản." : "Đã ngừng công khai danh mục dự kiến.",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Không lưu được. Vui lòng thử lại."),
  });
}
