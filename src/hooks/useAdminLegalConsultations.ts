// Admin thao tác THAY chuyên gia / đối tác tư vấn pháp lý (đối tác chưa có tài khoản):
// phân công + báo giá, huỷ, bắt đầu rà soát, lưu nháp checklist, hoàn tất (server gán
// phiên bản + ghi 1 dòng hoa hồng). Quyền: module tu-van-phap-ly.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { tvplErrorMessage, unwrapTvplRpc } from "@/lib/legalConsult/errors";
import type { Json } from "@/integrations/supabase/types";
import type { ChecklistDraftItem, LegalConsultation, LegalConsultPartner } from "@/types/legalConsult";

export type AdminLegalConsultation = LegalConsultation & {
  asset_postings: { review_status: string; status: string } | null;
};

const SELECT = "*, asset_postings(review_status, status)";

export function useAdminLegalConsultations(enabled = true) {
  return useQuery({
    queryKey: qk.legalConsult.adminList,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_legal_consultations")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AdminLegalConsultation[];
    },
  });
}

export function useAdminLegalConsultation(id: string | undefined) {
  return useQuery({
    queryKey: qk.legalConsult.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_legal_consultations").select(SELECT).eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as AdminLegalConsultation | null;
    },
  });
}

export function useLegalConsultPartners(enabled = true) {
  return useQuery({
    queryKey: [...qk.legalConsult.catalog, "partners"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("legal_consult_partners");
      if (error) throw error;
      return (data ?? []) as LegalConsultPartner[];
    },
  });
}

function useTvplMutation<TVars>(
  run: (vars: TVars) => PromiseLike<{ data: unknown; error: Error | null }>,
  successMessage: string | ((payload: Record<string, unknown>) => string),
  extraInvalidate?: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { data, error } = await run(vars);
      if (error) throw error;
      return unwrapTvplRpc(data);
    },
    onSuccess: (payload) => toast.success(typeof successMessage === "string" ? successMessage : successMessage(payload)),
    onError: (err) => toast.error(tvplErrorMessage(err)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.legalConsult.all });
      extraInvalidate?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

const toItemsJson = (items: ChecklistDraftItem[]) =>
  items.map((i) => ({
    template_key: i.template_key,
    label: i.label.trim(),
    status: i.status,
    expert_note: i.expert_note.trim(),
    required_action: i.required_action.trim(),
    doc_paths: i.doc_paths,
  })) as unknown as Json;

export function useQuoteLegalConsult() {
  return useTvplMutation(
    (v: { id: string; supplierId: string; expertName: string; price: number; note: string; validDays: number }) =>
      supabase.rpc("admin_quote_legal_consult", {
        _consultation_id: v.id,
        _supplier_id: v.supplierId,
        _expert_name: v.expertName,
        _price: v.price,
        _note: v.note,
        _valid_days: v.validDays,
      }),
    "Đã phân công chuyên gia và gửi báo giá cho người bán.",
  );
}

export function useAdminCancelLegalConsult() {
  return useTvplMutation(
    (v: { id: string; reason: string }) =>
      supabase.rpc("admin_cancel_legal_consult", { _consultation_id: v.id, _reason: v.reason }),
    "Đã huỷ yêu cầu tư vấn.",
  );
}

export function useStartLegalConsult() {
  return useTvplMutation(
    (v: { id: string }) => supabase.rpc("admin_start_legal_consult", { _consultation_id: v.id }),
    "Đã chuyển sang Đang rà soát.",
  );
}

export function useSaveLegalConsultChecklist() {
  return useTvplMutation(
    (v: { id: string; items: ChecklistDraftItem[] }) =>
      supabase.rpc("admin_save_legal_consult_checklist", { _consultation_id: v.id, _items: toItemsJson(v.items) }),
    "Đã lưu nháp checklist.",
  );
}

export function useCompleteLegalConsult() {
  return useTvplMutation(
    (v: { id: string; items: ChecklistDraftItem[]; summary: string }) =>
      supabase.rpc("admin_complete_legal_consult", {
        _consultation_id: v.id,
        _items: toItemsJson(v.items),
        _summary: v.summary,
      }),
    (p) => `Đã gửi kết quả tư vấn (phiên bản ${String(p.version)}) cho người bán.`,
    [qk.orders.all],
  );
}
