// Admin thao tác THAY đối tác (đối tác chưa có tài khoản): báo giá, huỷ, hẹn lịch, giao
// link (server ghi 1 dòng hoa hồng vào orders), duyệt & gắn tour vào lô.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { unwrapVrRpc, vrErrorMessage } from "@/lib/vrTour/errors";
import type { VrTourOrder } from "@/types/vrTour";

export type AdminVrTourOrder = VrTourOrder & {
  asset_postings: { review_status: string; status: string } | null;
};

/** Mọi đơn VR tour (RLS: quyền xem don-vr-tour hoặc tai-san-tu-nguyen). Tập nhỏ ⇒ lọc client-side. */
export function useAdminVrTourOrders(enabled = true) {
  return useQuery({
    queryKey: qk.vrTour.adminList,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_vr_tour_orders")
        .select("*, asset_postings(review_status, status)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AdminVrTourOrder[];
    },
  });
}

export function useAdminVrTourOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: qk.vrTour.detail(orderId),
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_vr_tour_orders")
        .select("*, asset_postings(review_status, status)")
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AdminVrTourOrder | null;
    },
  });
}

function useVrMutation<TVars extends { orderId: string }>(
  rpc: (vars: TVars) => PromiseLike<{ data: unknown; error: Error | null }>,
  successMessage: string,
  extraInvalidate?: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { data, error } = await rpc(vars);
      if (error) throw error;
      return unwrapVrRpc(data);
    },
    onSuccess: () => toast.success(successMessage),
    onError: (err) => toast.error(vrErrorMessage(err)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.vrTour.all });
      extraInvalidate?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export function useQuoteVrTour() {
  return useVrMutation(
    (v: { orderId: string; price: number; note: string; validDays: number }) =>
      supabase.rpc("admin_quote_vr_tour", {
        _order_id: v.orderId,
        _price: v.price,
        _note: v.note,
        _valid_days: v.validDays,
      }),
    "Đã gửi báo giá cho người bán.",
  );
}

export function useAdminCancelVrTour() {
  return useVrMutation(
    (v: { orderId: string; reason: string }) =>
      supabase.rpc("admin_cancel_vr_tour", { _order_id: v.orderId, _reason: v.reason }),
    "Đã huỷ đơn VR tour.",
  );
}

export function useScheduleVrTour() {
  return useVrMutation(
    (v: { orderId: string; appointmentAt: string; note: string }) =>
      supabase.rpc("admin_schedule_vr_tour", {
        _order_id: v.orderId,
        _appointment_at: v.appointmentAt,
        _note: v.note,
      }),
    "Đã lưu lịch hẹn chụp VR tour.",
  );
}

export function useDeliverVrTour() {
  return useVrMutation(
    (v: { orderId: string; vrUrl: string }) =>
      supabase.rpc("admin_deliver_vr_tour", { _order_id: v.orderId, _vr_url: v.vrUrl }),
    "Đã ghi nhận link VR tour và hoa hồng đối tác.",
    [qk.orders.all],
  );
}

export function useAttachVrTour() {
  return useVrMutation(
    (v: { orderId: string }) => supabase.rpc("admin_attach_vr_tour", { _order_id: v.orderId }),
    "Đã gắn VR tour vào lô — tour đang hiển thị công khai.",
    [["lot-vr-tours"]],
  );
}
