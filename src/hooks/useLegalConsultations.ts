// Tư vấn pháp lý phía người bán: gói dịch vụ, các lần tư vấn của một hồ sơ, checklist kết
// quả, gửi yêu cầu / huỷ / thanh toán, mở tệp đã nộp.
//
// asset_legal_consultations KHÔNG có policy ghi — mọi ghi qua RPC trả `{ok, reason}`.
// RLS chỉ trả checklist cho người bán khi lần tư vấn đã hoàn tất (BR-CNS-02).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { tvplErrorMessage, unwrapTvplRpc } from "@/lib/legalConsult/errors";
import { LEGAL_DOC_BUCKET } from "@/lib/legalConsult/paths";
import { TVPL_WAITING_ON_PLATFORM } from "@/lib/legalConsult/status";
import type {
  LegalConsultation,
  LegalConsultationItem,
  LegalConsultPackage,
  LegalConsultStatus,
  PayLegalConsultResult,
} from "@/types/legalConsult";

export function useLegalConsultPackage(enabled = true) {
  return useQuery({
    queryKey: qk.legalConsult.catalog,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("legal_consult_package");
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as LegalConsultPackage | null;
    },
  });
}

/** Các lần tư vấn của một hồ sơ, mới nhất trước; hỏi lại mỗi 30 giây khi đang chờ sàn. */
export function usePostingLegalConsultations(postingId: string | null | undefined) {
  return useQuery({
    queryKey: qk.legalConsult.byPosting(postingId),
    enabled: !!postingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_legal_consultations")
        .select("*")
        .eq("asset_posting_id", postingId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as LegalConsultation[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((o) => TVPL_WAITING_ON_PLATFORM.includes(o.status as LegalConsultStatus))
        ? 30_000
        : false,
  });
}

export function useLegalConsultation(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.legalConsult.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_legal_consultations").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as LegalConsultation | null;
    },
  });
}

export function useLegalConsultItems(consultationId: string | null | undefined) {
  return useQuery({
    queryKey: qk.legalConsult.items(consultationId),
    enabled: !!consultationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_legal_consultation_items")
        .select("*")
        .eq("consultation_id", consultationId!)
        .order("sort_order");
      if (error) throw error;
      return data as LegalConsultationItem[];
    },
  });
}

export interface RequestLegalConsultInput {
  postingId: string;
  docPaths: string[];
  note: string;
}

export function useRequestLegalConsult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequestLegalConsultInput) => {
      const { data, error } = await supabase.rpc("owner_request_legal_consult", {
        _posting_id: input.postingId,
        _doc_paths: input.docPaths,
        _note: input.note,
      });
      if (error) throw error;
      const p = unwrapTvplRpc(data);
      return { consultationId: String(p.consultation_id), code: String(p.code) };
    },
    onSuccess: (res) => toast.success(`Đã gửi yêu cầu tư vấn ${res.code} — sàn sẽ phân công chuyên gia và báo giá.`),
    onError: (err) => toast.error(tvplErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.legalConsult.byPosting(vars.postingId) });
    },
  });
}

export function useCancelLegalConsult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ consultationId }: { consultationId: string; postingId: string }) => {
      const { data, error } = await supabase.rpc("owner_cancel_legal_consult", { _consultation_id: consultationId });
      if (error) throw error;
      unwrapTvplRpc(data);
    },
    onSuccess: () => toast.success("Đã huỷ yêu cầu tư vấn pháp lý."),
    onError: (err) => toast.error(tvplErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.legalConsult.byPosting(vars.postingId) });
    },
  });
}

/** ⚠️ MÔ PHỎNG VNPay: ghi nhận thanh toán ở server, idempotent theo mã giao dịch. */
export function usePayLegalConsult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { consultationId: string; txnRef: string; expectedAmount: number }) => {
      const { data, error } = await supabase.rpc("pay_legal_consult", {
        _consultation_id: args.consultationId,
        _txn_ref: args.txnRef,
        _expected_amount: args.expectedAmount,
      });
      if (error) throw error;
      return unwrapTvplRpc(data) as unknown as PayLegalConsultResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.legalConsult.all }),
  });
}

/** Mở một tệp hồ sơ (bucket private asset-docs) ở tab mới qua signed URL ngắn hạn. */
export async function openLegalDoc(path: string) {
  // Mở tab TRƯỚC khi await: trình duyệt chặn window.open sau một lời hứa.
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(LEGAL_DOC_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    win?.close();
    toast.error("Không mở được tệp. Vui lòng thử lại.");
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
