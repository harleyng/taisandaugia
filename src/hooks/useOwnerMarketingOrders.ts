import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { qk } from "@/lib/queryKeys";
import {
  MKT_PACKAGE_META,
  isMktOrderPackage,
  mktOrderErrorMessage,
  unwrapMktOrderRpc,
  type MktOrderGoal,
  type MktOrderPackage,
} from "@/lib/ownerMarketing/orders";
import { parseOrderImpact, type OrderImpact, type OrderResultsPayload } from "@/lib/ownerMarketing/orderReport";

// "Giao việc cho sàn" (Phase M4, migration 20261002110000). Đọc thẳng owner_mkt_orders
// (RLS: thành viên Trạm); mọi GHI qua RPC — bảng không có quyền ghi cho client.

export type MarketingOrder = Tables<"owner_mkt_orders">;

const NO_ORDERS: MarketingOrder[] = [];

export function useOwnerMarketingOrders() {
  const { workspaceId } = useOwnerWorkspace();
  const query = useQuery({
    queryKey: qk.ownerMarketing.orders(workspaceId),
    enabled: !!workspaceId,
    queryFn: async (): Promise<MarketingOrder[]> => {
      const { data, error } = await supabase
        .from("owner_mkt_orders")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return { ...query, orders: query.data ?? NO_ORDERS };
}

/** Một đơn — trang chi tiết + trang thanh toán VNPay (RLS: thành viên Trạm của đơn). */
export function useOwnerMarketingOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: [...qk.ownerMarketing.orders(null), "by-id", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<MarketingOrder | null> => {
      const { data, error } = await supabase.from("owner_mkt_orders").select("*").eq("id", orderId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export interface MarketingPackage {
  key: MktOrderPackage;
  variantId: string;
  name: string;
  pricing: "credits" | "quote";
  creditCost: number;
}

/** Gói đang bán (service_variants nhóm marketing_owner), theo thứ tự MKT_ORDER_PACKAGES. */
export function useMarketingPackages() {
  return useQuery({
    queryKey: qk.ownerMarketing.packages,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MarketingPackage[]> => {
      const { data, error } = await supabase
        .from("service_variants")
        .select("id, variant_key, name, credit_cost, sort_order, service:services!inner(kind, category, is_active)")
        .eq("is_active", true)
        .eq("service.category", "marketing_owner")
        .eq("service.is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? [])
        .filter((v) => isMktOrderPackage(v.variant_key))
        .map((v) => ({
          key: v.variant_key as MktOrderPackage,
          variantId: v.id,
          name: v.name || MKT_PACKAGE_META[v.variant_key as MktOrderPackage].label,
          pricing: v.service?.kind === "credit" ? ("credits" as const) : ("quote" as const),
          creditCost: v.credit_cost ?? 0,
        }))
        .sort(
          (a, b) =>
            Object.keys(MKT_PACKAGE_META).indexOf(a.key) - Object.keys(MKT_PACKAGE_META).indexOf(b.key),
        );
    },
  });
}

export interface MarketableAsset {
  listingId: string;
  title: string;
  /** listings.status — chỉ 'ACTIVE' mới đặt được. */
  status: string;
  branchId: string | null;
  branchName: string | null;
}

const NO_ASSETS: MarketableAsset[] = [];

/** Tin Trạm đã nhận (auto_claimed / confirmed) kèm trạng thái tin — khớp kiểm tra của owner_mkt_order_create. */
export function useMarketableAssets(enabled: boolean) {
  const { workspaceId } = useOwnerWorkspace();
  const branches = useWorkspaceBranchOptions(enabled ? workspaceId : null);
  const claims = useQuery({
    queryKey: qk.ownerMarketing.orderAssets(workspaceId),
    enabled: enabled && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select("listing_id, asset_owner_id, listing:listings(title, status)")
        .eq("workspace_id", workspaceId!)
        .in("status", ["auto_claimed", "confirmed"])
        .not("listing_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const assets = useMemo((): MarketableAsset[] => {
    if (!claims.data) return NO_ASSETS;
    const byOwner = new Map((branches.data ?? []).flatMap((b) => (b.assetOwnerId ? [[b.assetOwnerId, b] as const] : [])));
    return claims.data
      .map((c) => {
        const branch = c.asset_owner_id ? byOwner.get(c.asset_owner_id) : undefined;
        return {
          listingId: c.listing_id!,
          title: c.listing?.title || "Tài sản",
          status: c.listing?.status ?? "",
          branchId: branch?.id ?? null,
          branchName: branch?.label ?? null,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title, "vi"));
  }, [claims.data, branches.data]);

  return { assets, isLoading: claims.isLoading || branches.isLoading, isError: claims.isError || branches.isError };
}

function useInvalidateOrders() {
  const { workspaceId } = useOwnerWorkspace();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.ownerMarketing.orders(workspaceId) });
    // useOwnerMarketingOrder (trang chi tiết / thanh toán) treo dưới gốc không theo Trạm.
    void queryClient.invalidateQueries({ queryKey: qk.ownerMarketing.orders(null) });
    void queryClient.invalidateQueries({ queryKey: qk.userCredits.byUser(userId) });
    void queryClient.invalidateQueries({ queryKey: qk.ownerSubscription.byWorkspace(workspaceId) });
  };
}

export interface CreateMarketingOrderInput {
  listingId: string;
  packageKey: MktOrderPackage;
  goal: MktOrderGoal;
  brief: string;
}

export interface CreateMarketingOrderResult {
  orderId: string;
  code: string;
  status: string;
  paymentMethod: string | null;
  cost: number | null;
}

export function useCreateMarketingOrder() {
  const { workspaceId } = useOwnerWorkspace();
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: async (input: CreateMarketingOrderInput): Promise<CreateMarketingOrderResult> => {
      if (!workspaceId) throw new Error("no_workspace");
      const { data, error } = await supabase.rpc("owner_mkt_order_create", {
        p_workspace_id: workspaceId,
        p_listing_id: input.listingId,
        p_variant_key: input.packageKey,
        p_goal: input.goal,
        p_brief: input.brief,
      });
      if (error) throw error;
      const d = unwrapMktOrderRpc(data);
      return {
        orderId: String(d.order_id),
        code: String(d.code),
        status: String(d.status),
        paymentMethod: (d.payment_method as string | null) ?? null,
        cost: d.cost == null ? null : Number(d.cost),
      };
    },
    onSuccess: (r) => {
      toast.success(
        r.status === "paid" ? `Đã đặt gói — đơn ${r.code}` : `Đã gửi yêu cầu ${r.code} — sàn sẽ báo giá`,
        {
          description:
            r.paymentMethod === "subscription"
              ? "Đã dùng 1 lượt của gói dịch vụ."
              : r.paymentMethod === "credits" && r.cost
                ? `Đã trừ ${r.cost.toLocaleString("en-US")} credit.`
                : undefined,
        },
      );
    },
    onError: (err) => toast.error("Không đặt được gói", { description: mktOrderErrorMessage(err) }),
    onSettled: invalidate,
  });
}

export function useCancelMarketingOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("owner_mkt_order_cancel", { p_order_id: orderId, p_reason: reason });
      if (error) throw error;
      unwrapMktOrderRpc(data);
    },
    onSuccess: () => toast.success("Đã huỷ yêu cầu"),
    onError: (err) => toast.error("Không huỷ được", { description: mktOrderErrorMessage(err) }),
    onSettled: invalidate,
  });
}

/** ⚠️ MÔ PHỎNG VNPay: ghi nhận thanh toán ở server, idempotent theo mã giao dịch. */
export function usePayMarketingOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { orderId: string; txnRef: string; expectedAmount: number }) => {
      const { data, error } = await supabase.rpc("pay_owner_mkt_order", {
        p_order_id: args.orderId,
        p_txn_ref: args.txnRef,
        p_expected_amount: args.expectedAmount,
      });
      if (error) throw error;
      const d = unwrapMktOrderRpc(data);
      return { status: String(d.status), code: String(d.code ?? "") };
    },
    // Trang kết quả nằm ngoài cổng (không có workspaceId) ⇒ làm mới mọi khoá đơn truyền thông.
    onSettled: () =>
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes("mkt-orders"),
      }),
  });
}

/** Số liệu TỔNG của chiến dịch / banner / tin nổi bật gắn với đơn (RPC owner_mkt_order_results). */
export function useMarketingOrderResults(orderId: string | null | undefined, enabled = true) {
  const { workspaceId } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.ownerMarketing.orderResults(workspaceId, orderId ?? undefined),
    enabled: enabled && !!orderId,
    queryFn: async (): Promise<OrderResultsPayload | null> => {
      const { data, error } = await supabase.rpc("owner_mkt_order_results", { p_order_id: orderId! });
      if (error) throw error;
      return (data ?? null) as unknown as OrderResultsPayload | null;
    },
  });
}

/** Tác động lên tài sản trong thời gian sàn chạy so với khoảng ngay trước (RPC owner_mkt_order_impact). */
export function useMarketingOrderImpact(orderId: string | null | undefined, enabled = true) {
  const { workspaceId } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.ownerMarketing.orderImpact(workspaceId, orderId ?? undefined),
    enabled: enabled && !!orderId,
    queryFn: async (): Promise<OrderImpact | null> => {
      const { data, error } = await supabase.rpc("owner_mkt_order_impact", { p_order_id: orderId! });
      if (error) throw error;
      return parseOrderImpact(data);
    },
  });
}

/** Ảnh đại diện tài sản của đơn — ô ảnh ở hero trang chi tiết. null khi tin không có ảnh. */
export function useOrderListingImage(listingId: string | null | undefined) {
  return useQuery({
    queryKey: ["listing-image", listingId],
    enabled: !!listingId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from("listings").select("image_url").eq("id", listingId!).maybeSingle();
      if (error) throw error;
      return data?.image_url ?? null;
    },
  });
}
