import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { attributeBiddingContract } from "@/lib/analytics/mktAttribution";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import type { LotPaymentStatus } from "@/types/auction-bidding";
import type {
  BiddingContract,
  ContractReviewEvent,
  ContractSummary,
  ContractWithSession,
  RegistrationPayload,
  ReviewStatus,
} from "@/types/bidding-contract";

/**
 * Hồ sơ tham gia đấu giá — phía NGƯỜI MUA.
 *
 * Mọi ghi đi qua RPC (bảng không có policy ghi). Mọi mutation invalidate cả
 * prefix `bidding-contracts` vì một lần mua đổi đồng thời: số đếm công khai của
 * phiên, hồ sơ của tôi, và danh sách của tổ chức.
 */

export const CONTRACT_WITH_SESSION_SELECT =
  "*, auction_sessions(id, code, title, starts_at, ends_at, status, auction_format, finalized_at, venue, checkin_lead_minutes, checkin_grace_minutes, roster_closed_at)";

export interface StartContractResult {
  contract_id: string;
  code: string;
  fee_amount: number;
  hold_expires_at: string;
  identity_source: "manual" | "vneid";
}

export interface PayContractResult {
  status: "paid" | "already_paid";
  contract_id: string;
  code: string;
  session_id: string;
  order_id?: string;
}

function useInvalidateContracts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
}

/** Số đã bán / đang giữ chỗ + tổ chức có bán qua sàn không. Công khai. */
export function useSessionContractSummary(sessionId?: string) {
  return useQuery({
    queryKey: qk.biddingContracts.summary(sessionId),
    enabled: !!sessionId,
    staleTime: 30_000,
    queryFn: async (): Promise<ContractSummary | null> => {
      const { data, error } = await supabase.rpc("auction_session_contract_summary", { _session_id: sessionId! });
      if (error) throw error;
      return (data as unknown as ContractSummary | null) ?? null;
    },
  });
}

/**
 * Hồ sơ ĐANG HIỆU LỰC của người đang xem cho một phiên. Bỏ cả 'refunded' (bị tổ
 * chức từ chối): người đó được mua lại, và uq_abc_session_user cho phép một hồ sơ
 * refunded + một hồ sơ mới cùng tồn tại — giữ refunded lại thì maybeSingle vỡ.
 */
export function useMySessionContract(sessionId?: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.biddingContracts.mineBySession(userId, sessionId),
    enabled: !!userId && !!sessionId,
    queryFn: async (): Promise<BiddingContract | null> => {
      const { data, error } = await supabase
        .from("auction_bidding_contracts")
        .select("*")
        .eq("session_id", sessionId!)
        .eq("user_id", userId!)
        .not("status", "in", "(cancelled,refunded)")
        .maybeSingle();
      if (error) throw error;
      return (data as BiddingContract | null) ?? null;
    },
  });
}

/** Mọi hồ sơ của tôi (mới nhất trước) — tab hồ sơ cá nhân + điền sẵn form. */
/** Một lô mà hồ sơ của tôi đã trúng — đủ để hiện thông báo trúng + hạn thanh toán. */
export interface MyWonLot {
  lot_id: string;
  session_id: string;
  winner_contract_id: string;
  winning_amount: number | null;
  payment_status: LotPaymentStatus | null;
  payment_due_at: string | null;
  auction_session_items: { lot_no: number; title: string } | null;
}

/**
 * Lô mà các hồ sơ này trúng đấu giá.
 *
 * Đọc auction_lot_states trực tiếp: RLS cho anon + authenticated đọc mọi lô của
 * phiên đã công bố (auction_lot_states_public_read), nên lọc theo
 * winner_contract_id phía client là an toàn và không cần policy mới.
 *
 * KHÔNG nhúng vào CONTRACT_WITH_SESSION_SELECT: quan hệ đi ngược chiều (lô trỏ
 * về hồ sơ), và chỉ tab hồ sơ cá nhân mới cần — kéo vào select dùng chung là bắt
 * mọi màn hồ sơ gánh thêm một join.
 */
export function useMyWonLots(contractIds: string[]) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.biddingContracts.wonLots(userId, contractIds),
    enabled: !!userId && contractIds.length > 0,
    queryFn: async (): Promise<MyWonLot[]> => {
      const { data, error } = await supabase
        .from("auction_lot_states")
        .select(
          "lot_id, session_id, winner_contract_id, winning_amount, payment_status, payment_due_at, auction_session_items!inner(lot_no, title)",
        )
        .in("winner_contract_id", contractIds)
        .eq("result", "sold");
      if (error) throw error;
      return (data ?? []) as unknown as MyWonLot[];
    },
  });
}

export function useMyBiddingContracts() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.biddingContracts.mine(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ContractWithSession[]> => {
      const { data, error } = await supabase
        .from("auction_bidding_contracts")
        .select(CONTRACT_WITH_SESSION_SELECT)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContractWithSession[];
    },
  });
}

/** Một hồ sơ theo id (trang thanh toán). RLS chỉ trả về nếu là của tôi. */
export function useBiddingContract(id?: string | null) {
  return useQuery({
    queryKey: qk.biddingContracts.byId(id),
    enabled: !!id,
    queryFn: async (): Promise<ContractWithSession | null> => {
      const { data, error } = await supabase
        .from("auction_bidding_contracts")
        .select(CONTRACT_WITH_SESSION_SELECT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ContractWithSession | null) ?? null;
    },
  });
}

export interface StartContractInput {
  sessionId: string;
  payload: RegistrationPayload;
}

/**
 * Giữ chỗ 15 phút + lưu bản chụp người đăng ký. Gọi lại khi "Tiếp tục thanh
 * toán" để gia hạn (dựng payload bằng contractToRegistrationPayload).
 */
export function useStartBiddingContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: async ({ sessionId, payload }: StartContractInput): Promise<StartContractResult> => {
      const { data, error } = await supabase.rpc("start_bidding_contract", {
        _session_id: sessionId,
        _payload: payload as unknown as Json,
      });
      if (error) throw error;
      return data as unknown as StartContractResult;
    },
    onSuccess: (data) => {
      // Khách tới từ link truyền thông của chủ tài sản ⇒ gắn nguồn vào hồ sơ (Phase M5).
      if (data?.contract_id) attributeBiddingContract(data.contract_id);
      invalidate();
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

/**
 * Ghi nhận thanh toán (MÔ PHỎNG). Không toast: trang kết quả tự hiển thị, và
 * lỗi ở đây cần hiện TRONG trang chứ không phải một toast thoáng qua.
 */
export function usePayBiddingContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: async ({ contractId, txnRef }: { contractId: string; txnRef: string }): Promise<PayContractResult> => {
      const { data, error } = await supabase.rpc("pay_bidding_contract", {
        _contract_id: contractId,
        _txn_ref: txnRef,
      });
      if (error) throw error;
      return data as unknown as PayContractResult;
    },
    onSettled: () => invalidate(),
  });
}

export function useCancelBiddingContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase.rpc("cancel_bidding_contract", { _contract_id: contractId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã huỷ hồ sơ chờ thanh toán.");
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

export interface ResubmitContractResult {
  contract_id: string;
  review_status: Extract<ReviewStatus, "pending">;
}

/** Nộp lại hồ sơ khi tổ chức yêu cầu bổ sung (review_status 'needs_info' ⇒ 'pending'). */
export function useResubmitContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: async ({
      contractId,
      payload,
    }: {
      contractId: string;
      payload: RegistrationPayload;
    }): Promise<ResubmitContractResult> => {
      const { data, error } = await supabase.rpc("resubmit_bidding_contract", {
        _contract_id: contractId,
        _payload: payload as unknown as Json,
      });
      if (error) throw error;
      return data as unknown as ResubmitContractResult;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã nộp lại hồ sơ — chờ tổ chức đấu giá duyệt.");
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

/** Nhật ký duyệt của một hồ sơ (người mua + tổ chức đọc được qua RLS). */
export function useContractReviewEvents(contractId?: string | null) {
  return useQuery({
    queryKey: qk.biddingContracts.reviewEvents(contractId),
    enabled: !!contractId,
    queryFn: async (): Promise<ContractReviewEvent[]> => {
      const { data, error } = await supabase
        .from("auction_contract_review_events")
        .select("*")
        .eq("contract_id", contractId!)
        .order("at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContractReviewEvent[];
    },
  });
}
