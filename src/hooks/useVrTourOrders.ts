// VR tour phía người bán + trang lô công khai: danh mục gói/đối tác, đơn của một hồ sơ,
// yêu cầu / huỷ / thanh toán, và tour đã công khai của các lô trong phiên.
//
// Bảng asset_vr_tour_orders KHÔNG có policy ghi — mọi ghi qua RPC trả `{ok, reason}`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { unwrapVrRpc, vrErrorMessage } from "@/lib/vrTour/errors";
import { VR_WAITING_ON_PLATFORM } from "@/lib/vrTour/status";
import type {
  LotVrTour,
  PayVrTourResult,
  VrTourOrder,
  VrTourPackage,
  VrTourPartner,
  VrTourStatus,
} from "@/types/vrTour";

/** Gói + đối tác cho dialog "Thêm VR tour". Dịch vụ commission bị ẩn khỏi public read ⇒ đi qua RPC. */
export function useVrTourCatalog(enabled = true) {
  return useQuery({
    queryKey: qk.vrTour.catalog,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [pkgs, partners] = await Promise.all([
        supabase.rpc("public_vr_tour_packages"),
        supabase.rpc("public_vr_tour_partners"),
      ]);
      if (pkgs.error) throw pkgs.error;
      if (partners.error) throw partners.error;
      return {
        packages: (pkgs.data ?? []) as VrTourPackage[],
        partners: (partners.data ?? []) as VrTourPartner[],
      };
    },
  });
}

/**
 * Đơn VR tour của một hồ sơ, mới nhất trước. Khi đơn đang chờ sàn xử lý thì hỏi lại
 * mỗi 30 giây — admin đổi trạng thái ở server, client không được báo.
 */
export function usePostingVrOrders(postingId: string | null | undefined) {
  return useQuery({
    queryKey: qk.vrTour.byPosting(postingId),
    enabled: !!postingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_vr_tour_orders")
        .select("*")
        .eq("asset_posting_id", postingId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as VrTourOrder[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((o) => VR_WAITING_ON_PLATFORM.includes(o.status as VrTourStatus))
        ? 30_000
        : false,
  });
}

/** Một đơn (trang thanh toán). RLS: chủ đơn đọc được, người khác nhận null. */
export function useVrTourOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: qk.vrTour.detail(orderId),
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_vr_tour_orders").select("*").eq("id", orderId!).maybeSingle();
      if (error) throw error;
      return data as VrTourOrder | null;
    },
  });
}

/** Tập id hồ sơ đang gắn VR tour — nhãn "VR" ở danh sách (RLS giới hạn tập dòng). */
export function useAttachedVrPostingIds() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.vrTour.attachedIds(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_vr_tour_orders")
        .select("asset_posting_id")
        .eq("status", "attached");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.asset_posting_id));
    },
  });
}

export interface RequestVrTourInput {
  postingId: string;
  variantKey: string;
  supplierId: string;
  siteAddress: string;
  preferredTime: string;
  note: string;
}

export function useRequestVrTour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequestVrTourInput) => {
      const { data, error } = await supabase.rpc("owner_request_vr_tour", {
        _posting_id: input.postingId,
        _variant_key: input.variantKey,
        _supplier_id: input.supplierId,
        _site_address: input.siteAddress,
        _preferred_time: input.preferredTime,
        _note: input.note,
      });
      if (error) throw error;
      const p = unwrapVrRpc(data);
      return { orderId: String(p.order_id), code: String(p.code) };
    },
    onSuccess: (res) => toast.success(`Đã gửi yêu cầu VR tour ${res.code} — sàn sẽ báo giá sớm.`),
    onError: (err) => toast.error(vrErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.vrTour.byPosting(vars.postingId) });
    },
  });
}

export function useCancelVrTour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string; postingId: string }) => {
      const { data, error } = await supabase.rpc("owner_cancel_vr_tour", { _order_id: orderId });
      if (error) throw error;
      unwrapVrRpc(data);
    },
    onSuccess: () => toast.success("Đã huỷ yêu cầu VR tour."),
    onError: (err) => toast.error(vrErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.vrTour.byPosting(vars.postingId) });
    },
  });
}

/** ⚠️ MÔ PHỎNG VNPay: ghi nhận thanh toán ở server, idempotent theo mã giao dịch. */
export function usePayVrTourOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { orderId: string; txnRef: string; expectedAmount: number }) => {
      const { data, error } = await supabase.rpc("pay_vr_tour_order", {
        _order_id: args.orderId,
        _txn_ref: args.txnRef,
        _expected_amount: args.expectedAmount,
      });
      if (error) throw error;
      return unwrapVrRpc(data) as unknown as PayVrTourResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.vrTour.all }),
  });
}

/** VR tour đã công khai của các lô trong một phiên (map item_id → tour). */
export function useSessionLotVrTours(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: qk.vrTour.sessionLots(sessionId),
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_session_lot_vr_tours", { _session_id: sessionId! });
      if (error) throw error;
      return new Map((data ?? []).map((t) => [t.item_id, t as LotVrTour]));
    },
  });
}
