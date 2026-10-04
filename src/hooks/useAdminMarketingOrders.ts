import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { mktOrderErrorMessage, unwrapMktOrderRpc } from "@/lib/ownerMarketing/orders";
import type { MarketingOrder } from "@/hooks/useOwnerMarketingOrders";
import type { OrderResultsPayload } from "@/lib/ownerMarketing/orderReport";

// Đơn "Giao việc cho sàn" phía admin (module don-truyen-thong). Đọc thẳng bảng (policy
// owner_mkt_orders_admin_read); mọi thao tác qua RPC admin_mkt_order_*.

export type AdminMarketingOrder = MarketingOrder;

export function useAdminMarketingOrders(enabled = true) {
  return useQuery({
    queryKey: qk.adminMktOrders.all,
    enabled,
    queryFn: async (): Promise<AdminMarketingOrder[]> => {
      const { data, error } = await supabase
        .from("owner_mkt_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminMarketingOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: qk.adminMktOrders.detail(orderId),
    enabled: !!orderId,
    queryFn: async (): Promise<AdminMarketingOrder | null> => {
      const { data, error } = await supabase.from("owner_mkt_orders").select("*").eq("id", orderId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Dữ kiện tin để điền sẵn chiến dịch email / banner (admin đọc được mọi tin). */
export function useAdminOrderListing(listingId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin-mkt-orders", "listing", listingId],
    enabled: !!listingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, address, custom_attributes, featured, featured_until, status")
        .eq("id", listingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminMarketingOrderResults(orderId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.adminMktOrders.results(orderId),
    enabled: enabled && !!orderId,
    queryFn: async (): Promise<OrderResultsPayload | null> => {
      const { data, error } = await supabase.rpc("owner_mkt_order_results", { p_order_id: orderId! });
      if (error) throw error;
      return (data ?? null) as unknown as OrderResultsPayload | null;
    },
  });
}

function useAdminOrderMutation<A>(
  run: (args: A) => PromiseLike<{ data: unknown; error: unknown }>,
  successText: string,
  errorTitle: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: A) => {
      const { data, error } = await run(args);
      if (error) throw error;
      return unwrapMktOrderRpc(data);
    },
    onSuccess: () => toast.success(successText),
    onError: (err) => toast.error(errorTitle, { description: mktOrderErrorMessage(err) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.adminMktOrders.all }),
  });
}

export const useAdminQuoteMarketingOrder = () =>
  useAdminOrderMutation(
    (a: { orderId: string; price: number; note: string; validDays: number }) =>
      supabase.rpc("admin_mkt_order_quote", {
        p_order_id: a.orderId,
        p_price: a.price,
        p_note: a.note,
        p_valid_days: a.validDays,
      }),
    "Đã gửi báo giá",
    "Không gửi được báo giá",
  );

export const useAdminStartMarketingOrder = () =>
  useAdminOrderMutation(
    (orderId: string) => supabase.rpc("admin_mkt_order_start", { p_order_id: orderId }),
    "Đã nhận việc",
    "Không nhận việc được",
  );

export const useAdminLinkMarketingOrder = () =>
  useAdminOrderMutation(
    (a: { orderId: string; kind: "campaign" | "advertisement"; targetId: string | null }) =>
      supabase.rpc("admin_mkt_order_link", {
        p_order_id: a.orderId,
        p_kind: a.kind,
        // RPC nhận NULL = bỏ gắn; kiểu sinh tự động khai `string`.
        p_target: a.targetId as string,
      }),
    "Đã cập nhật liên kết của đơn",
    "Không cập nhật được liên kết",
  );

export const useAdminCompleteMarketingOrder = () =>
  useAdminOrderMutation(
    (a: { orderId: string; note: string; postUrl: string }) =>
      supabase.rpc("admin_mkt_order_complete", { p_order_id: a.orderId, p_note: a.note, p_post_url: a.postUrl }),
    "Đã hoàn tất đơn",
    "Không hoàn tất được",
  );

export const useAdminSetPostMetrics = () =>
  useAdminOrderMutation(
    (a: { orderId: string; reach: number; engagements: number; clicks: number }) =>
      supabase.rpc("admin_mkt_order_set_post_metrics", {
        p_order_id: a.orderId,
        p_reach: a.reach,
        p_engagements: a.engagements,
        p_clicks: a.clicks,
      }),
    "Đã lưu số liệu bài đăng",
    "Không lưu được số liệu",
  );

export const useAdminCancelMarketingOrder = () =>
  useAdminOrderMutation(
    (a: { orderId: string; reason: string }) =>
      supabase.rpc("admin_mkt_order_cancel", { p_order_id: a.orderId, p_reason: a.reason }),
    "Đã huỷ đơn",
    "Không huỷ được đơn",
  );
