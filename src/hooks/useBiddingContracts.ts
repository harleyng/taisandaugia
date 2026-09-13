import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import type { StartContractArgs } from "@/lib/biddingContracts/identityForm";
import type { LotPaymentStatus } from "@/types/auction-bidding";
import type { BiddingContract, ContractSummary, ContractWithSession } from "@/types/bidding-contract";

/**
 * Hồ sơ tham gia đấu giá — phía NGƯỜI MUA.
 *
 * Mọi ghi đi qua RPC (bảng không có policy ghi). Mọi mutation invalidate cả
 * prefix `bidding-contracts` vì một lần mua đổi đồng thời: số đếm công khai của
 * phiên, hồ sơ của tôi, và danh sách của tổ chức.
 */

export const CONTRACT_WITH_SESSION_SELECT =
  "*, auction_sessions(id, code, title, starts_at, ends_at, status, auction_format, finalized_at)";

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

/** Hồ sơ CHƯA huỷ của người đang xem cho một phiên. */
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
        .neq("status", "cancelled")
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

/** Giữ chỗ 15 phút + lưu danh tính. Gọi lại khi "Tiếp tục thanh toán" để gia hạn. */
export function useStartBiddingContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: async (args: StartContractArgs): Promise<StartContractResult> => {
      const { data, error } = await supabase.rpc("start_bidding_contract", args);
      if (error) throw error;
      return data as unknown as StartContractResult;
    },
    onSuccess: () => invalidate(),
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
