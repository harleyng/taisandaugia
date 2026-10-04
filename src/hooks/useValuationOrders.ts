// Thẩm định giá qua sàn phía người bán: gói dịch vụ, các đơn của một hồ sơ, gửi yêu cầu /
// huỷ / thanh toán, mở chứng thư.
//
// asset_valuation_orders KHÔNG có policy ghi — mọi ghi qua RPC trả `{ok, reason}`.
// Kết quả KHÔNG ghi vào hồ sơ (BR-TDG-03): tab, bản in và wizard đọc thẳng bảng này.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { tdgErrorMessage, unwrapTdgRpc } from "@/lib/valuation/errors";
import { VALUATION_CERT_BUCKET } from "@/lib/valuation/paths";
import { TDG_WAITING_ON_PLATFORM } from "@/lib/valuation/status";
import type {
  PayValuationResult,
  ValuationOrder,
  ValuationPackage,
  ValuationPurpose,
  ValuationStatus,
} from "@/types/valuation";

export function useValuationPackage(enabled = true) {
  return useQuery({
    queryKey: qk.valuation.catalog,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("valuation_package");
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as ValuationPackage | null;
    },
  });
}

/** Các đơn thẩm định giá của một hồ sơ, mới nhất trước; hỏi lại mỗi 30 giây khi đang chờ sàn. */
export function usePostingValuationOrders(postingId: string | null | undefined) {
  return useQuery({
    queryKey: qk.valuation.byPosting(postingId),
    enabled: !!postingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_valuation_orders")
        .select("*")
        .eq("asset_posting_id", postingId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ValuationOrder[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((o) => TDG_WAITING_ON_PLATFORM.includes(o.status as ValuationStatus))
        ? 30_000
        : false,
  });
}

export function useValuationOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.valuation.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_valuation_orders").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as ValuationOrder | null;
    },
  });
}

export interface RequestValuationInput {
  postingId: string;
  purpose: ValuationPurpose;
  siteAddress: string;
  note: string;
}

export function useRequestValuation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequestValuationInput) => {
      const { data, error } = await supabase.rpc("owner_request_valuation", {
        _posting_id: input.postingId,
        _purpose: input.purpose,
        _site_address: input.siteAddress,
        _note: input.note,
      });
      if (error) throw error;
      const p = unwrapTdgRpc(data);
      return { orderId: String(p.order_id), code: String(p.code) };
    },
    onSuccess: (res) => toast.success(`Đã gửi yêu cầu thẩm định giá ${res.code} — sàn sẽ phân công đơn vị và báo giá.`),
    onError: (err) => toast.error(tdgErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.valuation.byPosting(vars.postingId) });
    },
  });
}

export function useCancelValuation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string; postingId: string }) => {
      const { data, error } = await supabase.rpc("owner_cancel_valuation", { _order_id: orderId });
      if (error) throw error;
      unwrapTdgRpc(data);
    },
    onSuccess: () => toast.success("Đã huỷ yêu cầu thẩm định giá."),
    onError: (err) => toast.error(tdgErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.valuation.byPosting(vars.postingId) });
    },
  });
}

/** ⚠️ MÔ PHỎNG VNPay: ghi nhận thanh toán ở server, idempotent theo mã giao dịch. */
export function usePayValuationOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { orderId: string; txnRef: string; expectedAmount: number }) => {
      const { data, error } = await supabase.rpc("pay_valuation_order", {
        _order_id: args.orderId,
        _txn_ref: args.txnRef,
        _expected_amount: args.expectedAmount,
      });
      if (error) throw error;
      return unwrapTdgRpc(data) as unknown as PayValuationResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.valuation.all }),
  });
}

/** Mở chứng thư thẩm định giá (bucket private) ở tab mới qua signed URL ngắn hạn. */
export async function openValuationCert(path: string) {
  // Mở tab TRƯỚC khi await: trình duyệt chặn window.open sau một lời hứa.
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(VALUATION_CERT_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    win?.close();
    toast.error("Không mở được chứng thư. Vui lòng thử lại.");
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
