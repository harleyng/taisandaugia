// Tư vấn đấu giá phía người bán: gói dịch vụ, các yêu cầu của một hồ sơ, phương án đề xuất,
// gửi yêu cầu / huỷ / chấp nhận hoặc không sử dụng / thanh toán.
//
// Hai bảng KHÔNG có policy ghi — mọi ghi qua RPC trả `{ok, reason}`. RLS chỉ trả phương án
// cho người bán khi yêu cầu đã hoàn tất (nháp của chuyên gia không lộ).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { tvdgErrorMessage, unwrapTvdgRpc } from "@/lib/auctionConsult/errors";
import { TVDG_WAITING_ON_PLATFORM } from "@/lib/auctionConsult/status";
import type {
  AuctionConsultation,
  AuctionConsultPackage,
  AuctionConsultProposal,
  AuctionConsultStatus,
  PayAuctionConsultResult,
  SaleGoal,
} from "@/types/auctionConsult";

export function useAuctionConsultPackage(enabled = true) {
  return useQuery({
    queryKey: qk.auctionConsult.catalog,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("auction_consult_package");
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as AuctionConsultPackage | null;
    },
  });
}

/** Các yêu cầu của một hồ sơ, mới nhất trước; hỏi lại mỗi 30 giây khi đang chờ sàn. */
export function usePostingAuctionConsultations(postingId: string | null | undefined) {
  return useQuery({
    queryKey: qk.auctionConsult.byPosting(postingId),
    enabled: !!postingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_auction_consultations")
        .select("*")
        .eq("asset_posting_id", postingId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AuctionConsultation[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((o) => TVDG_WAITING_ON_PLATFORM.includes(o.status as AuctionConsultStatus))
        ? 30_000
        : false,
  });
}

export function useAuctionConsultation(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.auctionConsult.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_auction_consultations").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as AuctionConsultation | null;
    },
  });
}

/** Phương án của một yêu cầu (người bán: chỉ khi đã hoàn tất; admin: cả nháp). */
export function useAuctionConsultProposal(consultationId: string | null | undefined) {
  return useQuery({
    queryKey: qk.auctionConsult.proposal(consultationId),
    enabled: !!consultationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_auction_consult_proposals")
        .select("*")
        .eq("consultation_id", consultationId!)
        .maybeSingle();
      if (error) throw error;
      return data as AuctionConsultProposal | null;
    },
  });
}

export interface RequestAuctionConsultInput {
  postingId: string;
  saleGoal: SaleGoal;
  expectedPrice: number | null;
  minPrice: number | null;
  timeline: string | null;
  deadline: string | null;
  note: string;
}

export function useRequestAuctionConsult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequestAuctionConsultInput) => {
      const { data, error } = await supabase.rpc("owner_request_auction_consult", {
        _posting_id: input.postingId,
        _sale_goal: input.saleGoal,
        _expected_price: input.expectedPrice,
        _min_price: input.minPrice,
        _timeline: input.timeline,
        _deadline: input.deadline,
        _note: input.note,
      });
      if (error) throw error;
      const p = unwrapTvdgRpc(data);
      return { consultationId: String(p.consultation_id), code: String(p.code) };
    },
    onSuccess: (res) => toast.success(`Đã gửi yêu cầu tư vấn ${res.code} — sàn sẽ phân công chuyên gia và báo giá.`),
    onError: (err) => toast.error(tvdgErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.auctionConsult.byPosting(vars.postingId) });
    },
  });
}

export function useCancelAuctionConsult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ consultationId }: { consultationId: string; postingId: string }) => {
      const { data, error } = await supabase.rpc("owner_cancel_auction_consult", { _consultation_id: consultationId });
      if (error) throw error;
      unwrapTvdgRpc(data);
    },
    onSuccess: () => toast.success("Đã huỷ yêu cầu tư vấn đấu giá."),
    onError: (err) => toast.error(tvdgErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.auctionConsult.byPosting(vars.postingId) });
    },
  });
}

/** Chấp nhận / Không sử dụng đề xuất hiện hành — đổi được cho tới khi có phiên bản mới. */
export function useDecideAuctionConsult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      consultationId: string;
      postingId: string;
      decision: "accepted" | "declined";
      note: string;
    }) => {
      const { data, error } = await supabase.rpc("owner_decide_auction_consult", {
        _consultation_id: args.consultationId,
        _decision: args.decision,
        _note: args.note,
      });
      if (error) throw error;
      unwrapTvdgRpc(data);
    },
    onSuccess: (_d, vars) =>
      toast.success(
        vars.decision === "accepted"
          ? "Đã chấp nhận đề xuất — tổ chức đấu giá đã ký hợp đồng sẽ thấy gợi ý khi lập phiên."
          : "Đã ghi nhận: không sử dụng đề xuất này.",
      ),
    onError: (err) => toast.error(tvdgErrorMessage(err)),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.auctionConsult.byPosting(vars.postingId) });
    },
  });
}

/** ⚠️ MÔ PHỎNG VNPay: ghi nhận thanh toán ở server, idempotent theo mã giao dịch. */
export function usePayAuctionConsult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { consultationId: string; txnRef: string; expectedAmount: number }) => {
      const { data, error } = await supabase.rpc("pay_auction_consult", {
        _consultation_id: args.consultationId,
        _txn_ref: args.txnRef,
        _expected_amount: args.expectedAmount,
      });
      if (error) throw error;
      return unwrapTvdgRpc(data) as unknown as PayAuctionConsultResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.auctionConsult.all }),
  });
}
