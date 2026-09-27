import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import {
  OWNER_EVIDENCE_BUCKET,
  evidenceObjectPath,
  outcomeErrorMessage,
  toOutcomeInsert,
  type ReportOutcomeForm,
  type ReportOutcomeTarget,
} from "@/lib/ownerOutcomeReport";
import { OUTCOME_PAYMENT_STATUSES, type OutcomePaymentStatus } from "@/lib/ownerOutcomes";
import { paymentErrorMessage, type OutcomePaymentStatusPatch } from "@/lib/ownerOutcomePayment";
import { assertCashRpcOk } from "@/lib/ownerCashEvent";
import { invalidateOwnerOutcomes } from "@/hooks/useOwnerOutcomeEdit";

/** Các lượt đơn vị đã khai cho một tin — để điền sẵn "lượt tiếp theo". */
export function useOwnerOutcomeRounds(
  workspaceId: string | null | undefined,
  listingId: string | null | undefined,
) {
  return useQuery({
    queryKey: qk.ownerOutcomeRounds(workspaceId, listingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owner_asset_outcomes")
        .select("round_no")
        .eq("workspace_id", workspaceId!)
        .eq("listing_id", listingId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.round_no);
    },
    enabled: !!workspaceId && !!listingId,
  });
}

interface ReportOutcomeInput {
  form: ReportOutcomeForm;
  target: ReportOutcomeTarget;
  /** Biên bản (tuỳ chọn, chỉ khi "Thành"). Đã qua validateEvidenceFile. */
  evidence: File | null;
}

/**
 * Khai kết quả: tạo bản ghi → tải biên bản vào {workspace}/{id}/ → gắn đường dẫn.
 * Thứ tự này là bắt buộc: policy storage chỉ mở thư mục của bản ghi ĐÃ tồn tại.
 * Tải biên bản hỏng thì kết quả vẫn được lưu (nhãn "Tự khai"), chỉ cảnh báo.
 */
export function useReportOwnerOutcome(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async ({ form, target, evidence }: ReportOutcomeInput) => {
      if (!workspaceId || !userId) throw new Error("no_workspace");
      const id = crypto.randomUUID();
      const { error } = await supabase
        .from("owner_asset_outcomes")
        .insert(toOutcomeInsert(form, { id, workspaceId, target, reportedBy: userId }));
      if (error) throw error;

      if (!evidence) return { evidenceFailed: false };

      const bucket = supabase.storage.from(OWNER_EVIDENCE_BUCKET);
      const path = evidenceObjectPath(workspaceId, id, evidence.name);
      const upload = await bucket.upload(path, evidence, { upsert: false, contentType: evidence.type });
      if (upload.error) return { evidenceFailed: true };
      const attach = await supabase.from("owner_asset_outcomes").update({ evidence_urls: [path] }).eq("id", id);
      if (attach.error) {
        await bucket.remove([path]);
        return { evidenceFailed: true };
      }
      return { evidenceFailed: false };
    },
    onSuccess: ({ evidenceFailed }) => {
      if (evidenceFailed) {
        toast.warning("Đã khai kết quả, nhưng chưa đính kèm được biên bản. Vui lòng thử lại sau.");
      } else {
        toast.success("Đã khai kết quả phiên");
      }
    },
    onError: (err, { form }) => toast.error(outcomeErrorMessage(err, Number(form.roundNo))),
    onSettled: (_data, _err, { target }) => {
      queryClient.invalidateQueries({ queryKey: qk.ownerAssetOutcomes(workspaceId) });
      queryClient.invalidateQueries({ queryKey: qk.ownerOutcomeRounds(workspaceId, target.listingId) });
    },
  });
}

// ─── Thu tiền (Phase 7) ──────────────────────────────────────────────────────

export interface OutcomePaymentRow {
  id: string;
  winningPrice: number | null;
  paidAmount: number | null;
  paidAt: string | null;
  paymentStatus: OutcomePaymentStatus;
}

const numOrNull = (v: number | string | null) => (v === null ? null : Number(v));

/** Số đã thu của các bản ghi tự khai — RPC hợp nhất không trả paid_amount. */
export function useOwnerOutcomePayments(workspaceId: string | null | undefined, outcomeIds: string[]) {
  const ids = [...outcomeIds].sort();
  return useQuery({
    queryKey: [...qk.ownerOutcomePayments(workspaceId), ids.join(",")],
    enabled: !!workspaceId && ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, OutcomePaymentRow>> => {
      const { data, error } = await supabase
        .from("owner_asset_outcomes")
        .select("id, winning_price, paid_amount, paid_at, payment_status")
        .eq("workspace_id", workspaceId!)
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, OutcomePaymentRow> = {};
      for (const r of data ?? []) {
        if (!(OUTCOME_PAYMENT_STATUSES as readonly string[]).includes(r.payment_status)) continue;
        map[r.id] = {
          id: r.id,
          winningPrice: numOrNull(r.winning_price),
          paidAmount: numOrNull(r.paid_amount),
          paidAt: r.paid_at,
          paymentStatus: r.payment_status as OutcomePaymentStatus,
        };
      }
      return map;
    },
  });
}

interface UpdatePaymentInput {
  outcomeId: string;
  patch: OutcomePaymentStatusPatch;
  successMessage: string;
}

/**
 * Đổi CỜ thu tiền của một bản ghi tự khai ("Người trúng bỏ cọc"). Số đã thu không
 * ghi ở đây nữa — đi qua sổ thu chi (useOwnerCashFlow.ts, Phase 15a). Qua RPC
 * owner_cash_set_defaulted: cờ này là quyền Thu tiền (thu-tien:update), không phải
 * quyền sửa kết quả phiên.
 */
export function useUpdateOutcomePayment(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ outcomeId, patch }: UpdatePaymentInput) => {
      if (!workspaceId) throw new Error("no_workspace");
      const { data, error } = await supabase.rpc("owner_cash_set_defaulted", {
        p_outcome_id: outcomeId,
        p_defaulted: patch.payment_status === "defaulted",
      });
      if (error) throw error;
      assertCashRpcOk(data);
    },
    onSuccess: (_data, { successMessage }) => toast.success(successMessage),
    onError: (err) => toast.error(paymentErrorMessage(err)),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}
