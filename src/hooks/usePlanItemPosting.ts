/* eslint-disable @typescript-eslint/no-explicit-any */
// "Tạo hồ sơ số hoá từ mục này" (Phase 5): mở wizard số hoá điền trước từ một
// mục của kế hoạch đấu giá, rồi liên kết hồ sơ vừa lưu về đúng mục đó.
//
// ⚠️ `(supabase as any)` cho `auction_plan_items` — xem đầu `useAuctionPlans.ts`.
// ⚠️ KHÔNG đổi luật kiểm tra của wizard: hook chỉ dựng GIÁ TRỊ ĐẦU (tên, địa
// chỉ, diện tích, giá khởi điểm). Các trường bắt buộc còn lại (nhóm/loại tài
// sản, tỉnh/xã theo danh mục của wizard, hồ sơ pháp lý…) người dùng vẫn phải
// điền — địa chỉ ba cấp của wizard không khớp 1:1 với mã đơn vị hành chính mới.

import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useAdminUnit } from "@/hooks/useAdminUnits";
import { PLAN_ITEM_COLUMNS } from "@/hooks/useAuctionPlans";
import { auctionPlanWriteMessage } from "@/lib/auctionPlan/rpc";
import type { AuctionPlanItem } from "@/lib/auctionPlan/types";
import type { WizardValues } from "@/components/asset-posting/wizardSchema";

/** MỘT mục của kế hoạch, tra theo id (dùng khi mở wizard từ link `?tu-ke-hoach=`). */
export function usePlanItem(itemId: string | null | undefined) {
  return useQuery<AuctionPlanItem | null>({
    queryKey: qk.auctionPlanItem(itemId),
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plan_items")
        .select(PLAN_ITEM_COLUMNS)
        .eq("id", itemId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AuctionPlanItem | null;
    },
  });
}

/** Địa chỉ gợi ý = "Đặc điểm, vị trí" của mục + tên đơn vị hành chính (A4.4). */
export function planItemPostingAddress(
  item: Pick<AuctionPlanItem, "location">,
  adminUnitName: string | null | undefined,
): string {
  return [item.location?.trim(), adminUnitName?.trim()].filter(Boolean).join(", ");
}

export interface PlanItemPostingPrefill {
  item: AuctionPlanItem | null;
  prefill: Partial<WizardValues> | null;
  isLoading: boolean;
}

/**
 * Giá trị đầu cho wizard từ một mục kế hoạch: tên lô, địa chỉ (vị trí + tên xã),
 * diện tích (`deltaFields.area`) và giá khởi điểm dự kiến của cả lô.
 */
export function usePlanItemPostingPrefill(itemId: string | null | undefined): PlanItemPostingPrefill {
  const itemQuery = usePlanItem(itemId);
  const item = itemQuery.data ?? null;
  const { data: adminUnit } = useAdminUnit(item?.admin_unit_code);

  const prefill: Partial<WizardValues> | null = item
    ? {
        title: item.title,
        address: planItemPostingAddress(item, adminUnit?.name),
        pricingMode: "self",
        startingPrice: item.expected_start_value === null ? "" : String(Number(item.expected_start_value)),
        deltaFields: item.area_m2 === null ? {} : { area: String(Number(item.area_m2)) },
      }
    : null;

  return { item, prefill, isLoading: itemQuery.isLoading };
}

/**
 * Gắn hồ sơ vừa lưu vào mục kế hoạch.
 *
 * ⚠️ Hàm trả về phải ỔN ĐỊNH giữa các lần render: wizard gọi nó trong `useEffect`
 * theo `savedId`, nên một callback đổi danh tính mỗi render sẽ bắn lại liên tục.
 * Vì thế `useCallback` chỉ phụ thuộc id mục, và cờ "đã liên kết" nằm trong `ref`.
 */
export function useLinkPostingToPlanItem(item: AuctionPlanItem | null) {
  const qc = useQueryClient();
  const itemRef = useRef<AuctionPlanItem | null>(item);
  itemRef.current = item;
  const doneRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ itemId, postingId }: { itemId: string; postingId: string }) => {
      const { error } = await (supabase as any)
        .from("auction_plan_items")
        .update({ asset_posting_id: postingId })
        .eq("id", itemId);
      if (error) throw new Error(auctionPlanWriteMessage(error));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.auctionPlan(itemRef.current?.plan_id) });
      void qc.invalidateQueries({ queryKey: qk.auctionPlanItem(itemRef.current?.id) });
      toast.success("Đã liên kết hồ sơ số hoá với mục kế hoạch");
    },
    onError: (e: Error) => {
      doneRef.current = null;
      toast.error(e.message);
    },
  });
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  return useCallback((postingId: string) => {
    const current = itemRef.current;
    if (!current || !postingId) return;
    if (doneRef.current === postingId || current.asset_posting_id === postingId) return;
    doneRef.current = postingId;
    mutateRef.current({ itemId: current.id, postingId });
  }, []);
}
