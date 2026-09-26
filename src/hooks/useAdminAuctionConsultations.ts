// Admin thao tác THAY chuyên gia / đối tác tư vấn đấu giá (đối tác chưa có tài khoản):
// phân công + báo giá, huỷ, bắt đầu, lưu nháp phương án, hoàn tất (server gán phiên bản +
// ghi 1 dòng hoa hồng). Quyền: module tu-van-dau-gia.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { tvdgErrorMessage, unwrapTvdgRpc } from "@/lib/auctionConsult/errors";
import { draftToValues } from "@/lib/auctionConsult/proposal";
import type { Json } from "@/integrations/supabase/types";
import type { AuctionConsultation, AuctionConsultPartner, ProposalDraft } from "@/types/auctionConsult";

export type AdminAuctionConsultation = AuctionConsultation & {
  asset_postings: { review_status: string; status: string } | null;
};

const SELECT = "*, asset_postings(review_status, status)";

export function useAdminAuctionConsultations(enabled = true) {
  return useQuery({
    queryKey: qk.auctionConsult.adminList,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_auction_consultations")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AdminAuctionConsultation[];
    },
  });
}

export function useAdminAuctionConsultation(id: string | undefined) {
  return useQuery({
    queryKey: qk.auctionConsult.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_auction_consultations")
        .select(SELECT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AdminAuctionConsultation | null;
    },
  });
}

export function useAuctionConsultPartners(enabled = true) {
  return useQuery({
    queryKey: [...qk.auctionConsult.catalog, "partners"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("auction_consult_partners");
      if (error) throw error;
      return (data ?? []) as AuctionConsultPartner[];
    },
  });
}

function useTvdgMutation<TVars>(
  run: (vars: TVars) => PromiseLike<{ data: unknown; error: Error | null }>,
  successMessage: string | ((payload: Record<string, unknown>) => string),
  extraInvalidate?: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { data, error } = await run(vars);
      if (error) throw error;
      return unwrapTvdgRpc(data);
    },
    onSuccess: (payload) => toast.success(typeof successMessage === "string" ? successMessage : successMessage(payload)),
    onError: (err) => toast.error(tvdgErrorMessage(err)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.auctionConsult.all });
      extraInvalidate?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

/** JSON gửi RPC — rationale đi tham số riêng. */
export function toProposalJson(draft: ProposalDraft): Json {
  const { rationale: _rationale, ...rest } = draftToValues(draft);
  return rest as unknown as Json;
}

export function useQuoteAuctionConsult() {
  return useTvdgMutation(
    (v: { id: string; supplierId: string; expertName: string; price: number; note: string; validDays: number }) =>
      supabase.rpc("admin_quote_auction_consult", {
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

export function useAdminCancelAuctionConsult() {
  return useTvdgMutation(
    (v: { id: string; reason: string }) =>
      supabase.rpc("admin_cancel_auction_consult", { _consultation_id: v.id, _reason: v.reason }),
    "Đã huỷ yêu cầu tư vấn.",
  );
}

export function useStartAuctionConsult() {
  return useTvdgMutation(
    (v: { id: string }) => supabase.rpc("admin_start_auction_consult", { _consultation_id: v.id }),
    "Đã chuyển sang Đang xây dựng phương án.",
  );
}

export function useSaveAuctionConsultProposal() {
  return useTvdgMutation(
    (v: { id: string; draft: ProposalDraft }) =>
      supabase.rpc("admin_save_auction_consult_proposal", {
        _consultation_id: v.id,
        _proposal: toProposalJson(v.draft),
        _rationale: v.draft.rationale,
      }),
    "Đã lưu nháp phương án.",
  );
}

export function useCompleteAuctionConsult() {
  return useTvdgMutation(
    (v: { id: string; draft: ProposalDraft }) =>
      supabase.rpc("admin_complete_auction_consult", {
        _consultation_id: v.id,
        _proposal: toProposalJson(v.draft),
        _rationale: v.draft.rationale,
      }),
    (p) => `Đã gửi đề xuất phương án (phiên bản ${String(p.version)}) cho người bán.`,
    [qk.orders.all],
  );
}
