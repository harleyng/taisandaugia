// Admin thao tác THAY đối tác giám định (đối tác chưa có tài khoản): báo giá, huỷ, hẹn tại
// chỗ, bắt đầu giám định, tải chứng thư + kết luận (server ghi 1 dòng hoa hồng), và luật
// bắt buộc giám định (chính sách / người bán bị hạn chế / lô).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { gdErrorMessage, unwrapGdRpc } from "@/lib/authentication/errors";
import { CERT_BUCKET, certificateStoragePath } from "@/lib/authentication/paths";
import type { AuthenticationOrder, AuthenticationVerdict } from "@/types/authentication";

export type AdminAuthenticationOrder = AuthenticationOrder & {
  asset_postings: { review_status: string; status: string; parent_slug: string } | null;
};

const SELECT = "*, asset_postings(review_status, status, parent_slug)";

export function useAdminAuthenticationOrders(enabled = true) {
  return useQuery({
    queryKey: qk.authentication.adminList,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_authentication_orders")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AdminAuthenticationOrder[];
    },
  });
}

export function useAdminAuthenticationOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: qk.authentication.detail(orderId),
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_authentication_orders")
        .select(SELECT)
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AdminAuthenticationOrder | null;
    },
  });
}

function useGdMutation<TVars>(
  run: (vars: TVars) => PromiseLike<{ data: unknown; error: Error | null }>,
  successMessage: string | ((payload: Record<string, unknown>) => string),
  extraInvalidate?: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { data, error } = await run(vars);
      if (error) throw error;
      return unwrapGdRpc(data);
    },
    onSuccess: (payload) => toast.success(typeof successMessage === "string" ? successMessage : successMessage(payload)),
    onError: (err) => toast.error(gdErrorMessage(err)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.authentication.all });
      extraInvalidate?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export function useQuoteAuthentication() {
  return useGdMutation(
    (v: { orderId: string; price: number; note: string; validDays: number }) =>
      supabase.rpc("admin_quote_authentication", {
        _order_id: v.orderId,
        _price: v.price,
        _note: v.note,
        _valid_days: v.validDays,
      }),
    "Đã gửi báo giá giám định cho người bán.",
  );
}

export function useAdminCancelAuthentication() {
  return useGdMutation(
    (v: { orderId: string; reason: string }) =>
      supabase.rpc("admin_cancel_authentication", { _order_id: v.orderId, _reason: v.reason }),
    "Đã huỷ đơn giám định.",
  );
}

export function useScheduleAuthentication() {
  return useGdMutation(
    (v: { orderId: string; appointmentAt: string; note: string }) =>
      supabase.rpc("admin_schedule_authentication", {
        _order_id: v.orderId,
        _appointment_at: v.appointmentAt,
        _note: v.note,
      }),
    "Đã lưu lịch giám định tại chỗ.",
  );
}

export function useStartAuthenticationReview() {
  return useGdMutation(
    (v: { orderId: string }) => supabase.rpc("admin_start_authentication_review", { _order_id: v.orderId }),
    "Đã chuyển đơn sang Đang giám định.",
  );
}

export interface CompleteAuthenticationInput {
  orderId: string;
  postingId: string;
  verdict: AuthenticationVerdict;
  reason: string;
  certificateNo: string;
  file: File;
}

/** Tải PDF lên bucket (thay đối tác, BR-GD-01) rồi mới gọi RPC chốt kết luận. */
export function useCompleteAuthentication() {
  return useGdMutation(
    async (v: CompleteAuthenticationInput) => {
      const path = certificateStoragePath(v.postingId, v.orderId, v.file.name);
      const up = await supabase.storage
        .from(CERT_BUCKET)
        .upload(path, v.file, { contentType: "application/pdf", upsert: false });
      if (up.error) return { data: null, error: up.error };
      return supabase.rpc("admin_complete_authentication", {
        _order_id: v.orderId,
        _verdict: v.verdict,
        _reason: v.reason,
        _certificate_path: path,
        _certificate_no: v.certificateNo,
      });
    },
    (p) =>
      p.needs_manual_withdraw
        ? "Đã lưu kết luận. Hồ sơ đã ký hợp đồng / đang trong phiên — cần rút lô thủ công."
        : p.posting_reverted
          ? "Đã lưu kết luận — hồ sơ đã được trả về nháp và người bán thấy lý do."
          : "Đã lưu chứng thư và ghi nhận hoa hồng đối tác.",
    [qk.orders.all, ["admin-asset-postings"]],
  );
}

// ─── Luật bắt buộc giám định (BR-GD-03) ──────────────────────────────────────

export function useAuthenticationPolicy() {
  return useQuery({
    queryKey: qk.authentication.policy,
    queryFn: async () => {
      const { data, error } = await supabase.from("authentication_policy").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSetAuthenticationPolicy() {
  return useGdMutation(
    (v: { enabled: boolean; minPrice: number; parentSlugs: string[] }) =>
      supabase.rpc("admin_set_authentication_policy", {
        _enabled: v.enabled,
        _min_price: v.minPrice,
        _parent_slugs: v.parentSlugs,
      }),
    "Đã lưu chính sách bắt buộc giám định.",
    [qk.authentication.policy, ["authentication-rules"]],
  );
}

export function useSellerAuthenticationRestrictions() {
  return useQuery({
    queryKey: qk.authentication.sellerRestrictions,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_seller_authentication_restrictions");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetSellerAuthenticationRestriction() {
  return useGdMutation(
    (v: { email: string; restricted: boolean; reason: string }) =>
      supabase.rpc("admin_set_seller_authentication_restriction", {
        _email: v.email,
        _restricted: v.restricted,
        _reason: v.reason,
      }),
    "Đã cập nhật danh sách người bán bắt buộc giám định.",
    [qk.authentication.sellerRestrictions],
  );
}

export function useSetLotAuthenticationRequirement() {
  return useGdMutation(
    (v: { postingId: string; required: boolean; reason: string }) =>
      supabase.rpc("admin_set_lot_authentication_requirement", {
        _posting_id: v.postingId,
        _required: v.required,
        _reason: v.reason,
      }),
    "Đã cập nhật yêu cầu giám định cho lô.",
    [["authentication-rules"]],
  );
}
