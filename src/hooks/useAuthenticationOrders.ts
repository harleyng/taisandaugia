// Giám định phía người bán + trang lô công khai: danh mục phương thức/đối tác, đơn của một
// hồ sơ, luật bắt buộc (BR-GD-03), đặt / huỷ / gửi hiện vật / thanh toán, chứng thư công khai.
//
// asset_authentication_orders KHÔNG có policy ghi — mọi ghi qua RPC trả `{ok, reason}`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { gdErrorMessage, unwrapGdRpc } from "@/lib/authentication/errors";
import { GD_WAITING_ON_PLATFORM } from "@/lib/authentication/status";
import { CERT_BUCKET } from "@/lib/authentication/paths";
import type {
  AuthenticationMethod,
  AuthenticationOrder,
  AuthenticationPackage,
  AuthenticationPartner,
  AuthenticationStatus,
  LotAuthentication,
  PayAuthenticationResult,
  PostingAuthenticationState,
} from "@/types/authentication";

export function useAuthenticationCatalog(enabled = true) {
  return useQuery({
    queryKey: qk.authentication.catalog,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [pkgs, partners] = await Promise.all([
        supabase.rpc("public_authentication_packages"),
        supabase.rpc("public_authentication_partners"),
      ]);
      if (pkgs.error) throw pkgs.error;
      if (partners.error) throw partners.error;
      return {
        packages: (pkgs.data ?? []) as AuthenticationPackage[],
        partners: (partners.data ?? []) as AuthenticationPartner[],
      };
    },
  });
}

/** Đơn giám định của một hồ sơ, mới nhất trước; hỏi lại mỗi 30 giây khi đang chờ sàn. */
export function usePostingAuthenticationOrders(postingId: string | null | undefined) {
  return useQuery({
    queryKey: qk.authentication.byPosting(postingId),
    enabled: !!postingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_authentication_orders")
        .select("*")
        .eq("asset_posting_id", postingId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as AuthenticationOrder[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((o) => GD_WAITING_ON_PLATFORM.includes(o.status as AuthenticationStatus))
        ? 30_000
        : false,
  });
}

export function useAuthenticationOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: qk.authentication.detail(orderId),
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_authentication_orders")
        .select("*")
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data as AuthenticationOrder | null;
    },
  });
}

/** Trạng thái server của một hồ sơ đã lưu: lý do bắt buộc, kết luận, mức xác minh. */
export function usePostingAuthenticationState(postingId: string | null | undefined) {
  return useQuery({
    queryKey: qk.authentication.state(postingId),
    enabled: !!postingId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("posting_authentication_state", { _posting_id: postingId! });
      if (error) throw error;
      const p = unwrapGdRpc(data);
      return {
        reasons: (p.reasons ?? []) as PostingAuthenticationState["reasons"],
        verdict: (p.verdict ?? null) as PostingAuthenticationState["verdict"],
        level: Number(p.level ?? 0),
      } satisfies PostingAuthenticationState;
    },
  });
}

/**
 * Chính sách + cờ "người bán bị hạn chế" + cờ lô (nếu hồ sơ đã lưu) — để wizard báo
 * "Bắt buộc" trước khi hồ sơ chạm trigger. RLS: policy đọc chung, cờ đọc của mình.
 */
export function useAuthenticationRules(postingId: string | null | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: [...qk.authentication.rules(userId), postingId ?? null],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [policy, restriction, lot] = await Promise.all([
        supabase.from("authentication_policy").select("enabled, min_price, parent_slugs").eq("id", 1).maybeSingle(),
        supabase.from("seller_authentication_restrictions").select("user_id").eq("user_id", userId!).maybeSingle(),
        postingId
          ? supabase
              .from("asset_authentication_requirements")
              .select("reason")
              .eq("asset_posting_id", postingId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (policy.error) throw policy.error;
      if (restriction.error) throw restriction.error;
      if (lot.error) throw lot.error;
      return {
        policy: policy.data,
        sellerRestricted: !!restriction.data,
        lotFlagged: !!lot.data,
        lotReason: (lot.data as { reason: string } | null)?.reason ?? null,
      };
    },
  });
}

/** Tập id hồ sơ có chứng thư "xác thực" hiện hành — nhãn "Đã giám định" ở danh sách. */
export function useAuthenticatedPostingIds() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.authentication.authenticIds(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_authentication_orders")
        .select("asset_posting_id")
        .eq("status", "completed")
        .eq("verdict", "authentic");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.asset_posting_id));
    },
  });
}

export interface RequestAuthenticationInput {
  postingId: string;
  method: AuthenticationMethod;
  supplierId: string;
  siteAddress: string;
  preferredTime: string;
  note: string;
}

export function useRequestAuthentication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequestAuthenticationInput) => {
      const { data, error } = await supabase.rpc("owner_request_authentication", {
        _posting_id: input.postingId,
        _method: input.method,
        _supplier_id: input.supplierId,
        _site_address: input.siteAddress,
        _preferred_time: input.preferredTime,
        _note: input.note,
      });
      if (error) throw error;
      const p = unwrapGdRpc(data);
      return { orderId: String(p.order_id), code: String(p.code) };
    },
    onSuccess: (res) => toast.success(`Đã gửi yêu cầu giám định ${res.code} — sàn sẽ báo giá sớm.`),
    onError: (err) => toast.error(gdErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.authentication.byPosting(vars.postingId) });
    },
  });
}

export function useCancelAuthentication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string; postingId: string }) => {
      const { data, error } = await supabase.rpc("owner_cancel_authentication", { _order_id: orderId });
      if (error) throw error;
      unwrapGdRpc(data);
    },
    onSuccess: () => toast.success("Đã huỷ yêu cầu giám định."),
    onError: (err) => toast.error(gdErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.authentication.byPosting(vars.postingId) });
    },
  });
}

export function useSubmitAuthenticationShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, tracking }: { orderId: string; postingId: string; tracking: string }) => {
      const { data, error } = await supabase.rpc("owner_submit_authentication_shipment", {
        _order_id: orderId,
        _tracking: tracking,
      });
      if (error) throw error;
      unwrapGdRpc(data);
    },
    onSuccess: () => toast.success("Đã lưu mã vận đơn — đối tác sẽ xác nhận khi nhận hiện vật."),
    onError: (err) => toast.error(gdErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.authentication.byPosting(vars.postingId) });
    },
  });
}

/** ⚠️ MÔ PHỎNG VNPay: ghi nhận thanh toán ở server, idempotent theo mã giao dịch. */
export function usePayAuthenticationOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { orderId: string; txnRef: string; expectedAmount: number }) => {
      const { data, error } = await supabase.rpc("pay_authentication_order", {
        _order_id: args.orderId,
        _txn_ref: args.txnRef,
        _expected_amount: args.expectedAmount,
      });
      if (error) throw error;
      return unwrapGdRpc(data) as unknown as PayAuthenticationResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.authentication.all }),
  });
}

/** Chứng thư đã công khai của các lô trong một phiên (map item_id → chứng thư). */
export function useSessionLotAuthentications(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: qk.authentication.sessionLots(sessionId),
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_session_lot_authentications", { _session_id: sessionId! });
      if (error) throw error;
      return new Map((data ?? []).map((t) => [t.item_id, t as LotAuthentication]));
    },
  });
}

/** Mở chứng thư PDF (bucket private) ở tab mới qua signed URL ngắn hạn. */
export async function openCertificate(path: string) {
  // Mở tab TRƯỚC khi await: trình duyệt chặn window.open sau một lời hứa.
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(CERT_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    win?.close();
    toast.error("Không mở được chứng thư. Vui lòng thử lại.");
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
