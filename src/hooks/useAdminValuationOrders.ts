// Admin thao tác THAY đơn vị thẩm định giá (đối tác chưa có tài khoản): phân công + báo giá,
// huỷ, bắt đầu thẩm định, nhập kết quả + chứng thư (server ghi 1 dòng hoa hồng).
// Quyền: module tham-dinh-gia.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { tdgErrorMessage, unwrapTdgRpc } from "@/lib/valuation/errors";
import { VALUATION_CERT_BUCKET, valuationCertStoragePath } from "@/lib/valuation/paths";
import type { ValuationMethod, ValuationOrder, ValuationPartner } from "@/types/valuation";

export type AdminValuationOrder = ValuationOrder & {
  asset_postings: { review_status: string; status: string; code: string | null } | null;
};

const SELECT = "*, asset_postings(review_status, status, code)";

export function useAdminValuationOrders(enabled = true) {
  return useQuery({
    queryKey: qk.valuation.adminList,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_valuation_orders")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AdminValuationOrder[];
    },
  });
}

export function useAdminValuationOrder(id: string | undefined) {
  return useQuery({
    queryKey: qk.valuation.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_valuation_orders").select(SELECT).eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as AdminValuationOrder | null;
    },
  });
}

export function useValuationPartners(enabled = true) {
  return useQuery({
    queryKey: [...qk.valuation.catalog, "partners"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("valuation_partners");
      if (error) throw error;
      return (data ?? []) as ValuationPartner[];
    },
  });
}

function useTdgMutation<TVars>(
  run: (vars: TVars) => PromiseLike<{ data: unknown; error: Error | null }>,
  successMessage: string,
  extraInvalidate?: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { data, error } = await run(vars);
      if (error) throw error;
      return unwrapTdgRpc(data);
    },
    onSuccess: () => toast.success(successMessage),
    onError: (err) => toast.error(tdgErrorMessage(err)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.valuation.all });
      extraInvalidate?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export function useQuoteValuation() {
  return useTdgMutation(
    (v: { id: string; supplierId: string; expertName: string; price: number; note: string; validDays: number }) =>
      supabase.rpc("admin_quote_valuation", {
        _order_id: v.id,
        _supplier_id: v.supplierId,
        _expert_name: v.expertName,
        _price: v.price,
        _note: v.note,
        _valid_days: v.validDays,
      }),
    "Đã phân công đơn vị thẩm định và gửi báo giá cho người bán.",
  );
}

export function useAdminCancelValuation() {
  return useTdgMutation(
    (v: { id: string; reason: string }) => supabase.rpc("admin_cancel_valuation", { _order_id: v.id, _reason: v.reason }),
    "Đã huỷ đơn thẩm định giá.",
  );
}

export function useStartValuation() {
  return useTdgMutation(
    (v: { id: string }) => supabase.rpc("admin_start_valuation", { _order_id: v.id }),
    "Đã chuyển sang Đang thẩm định.",
  );
}

export interface CompleteValuationInput {
  orderId: string;
  postingId: string;
  value: number;
  valuationDate: string;
  validUntil: string;
  method: ValuationMethod | null;
  summary: string;
  certificateNo: string;
  file: File;
}

/** Tải chứng thư PDF lên bucket (thay đơn vị thẩm định, BR-TDG-01) rồi mới gọi RPC chốt kết quả. */
export function useCompleteValuation() {
  return useTdgMutation(
    async (v: CompleteValuationInput) => {
      const path = valuationCertStoragePath(v.postingId, v.orderId, v.file.name);
      const up = await supabase.storage
        .from(VALUATION_CERT_BUCKET)
        .upload(path, v.file, { contentType: "application/pdf", upsert: false });
      if (up.error) return { data: null, error: up.error };
      return supabase.rpc("admin_complete_valuation", {
        _order_id: v.orderId,
        _value: v.value,
        _valuation_date: v.valuationDate,
        _valid_until: v.validUntil,
        // RPC nhận NULL; types sinh tự động không biểu diễn được tham số NULL.
        _method: v.method as string,
        _summary: v.summary,
        _certificate_path: path,
        _certificate_no: v.certificateNo,
      });
    },
    "Đã lưu chứng thư và ghi nhận hoa hồng đơn vị thẩm định.",
    [qk.orders.all],
  );
}
