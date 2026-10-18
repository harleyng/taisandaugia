import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import type { BiddingContract, ContractSessionRef } from "@/types/bidding-contract";

/**
 * "Hồ sơ của tôi" trên sàn (/ho-so-cua-toi): hồ sơ kèm phiên, tổ chức, lô và lô
 * đã chọn; hướng dẫn nộp đặt trước (my_contract_deposit_info) và báo đã nộp.
 * Migration 20261018160000_contract_lots_deposit_report.sql.
 */

export interface MyContractLot {
  id: string;
  lot_no: number;
  title: string;
  image_url: string | null;
  deposit_amount: number | null;
  starting_price: number | null;
}

export interface MyContractSession extends ContractSessionRef {
  registration_end_at: string | null;
  auction_organizations: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    logo_url: string | null;
  } | null;
  auction_session_items: MyContractLot[];
}

export interface MyContract extends BiddingContract {
  auction_sessions: MyContractSession | null;
  /** Lô đã chọn; rỗng = đăng ký mọi lô (hồ sơ cũ). */
  auction_contract_lots: { item_id: string }[];
}

const MY_CONTRACT_SELECT =
  "*, auction_contract_lots(item_id), auction_sessions(id, code, title, starts_at, ends_at, status, auction_format, finalized_at, venue, checkin_lead_minutes, checkin_grace_minutes, roster_closed_at, registration_end_at, auction_organizations(id, name, address, phone, logo_url), auction_session_items(id, lot_no, title, image_url, deposit_amount, starting_price))";

/** Lô của hồ sơ theo lựa chọn (rỗng = mọi lô), xếp theo số lô. */
export function registeredLotsOf(c: Pick<MyContract, "auction_sessions" | "auction_contract_lots">): MyContractLot[] {
  const all = [...(c.auction_sessions?.auction_session_items ?? [])].sort((a, b) => a.lot_no - b.lot_no);
  const picked = new Set(c.auction_contract_lots.map((l) => l.item_id));
  return picked.size === 0 ? all : all.filter((l) => picked.has(l.id));
}

export function useMyContracts() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.biddingContracts.mineFull(userId),
    enabled: !!userId,
    queryFn: async (): Promise<MyContract[]> => {
      const { data, error } = await supabase
        .from("auction_bidding_contracts")
        .select(MY_CONTRACT_SELECT)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MyContract[];
    },
  });
}

/** Một hồ sơ của tôi theo mã (RLS chỉ trả hồ sơ của chính người gọi). */
export function useMyContractByCode(code?: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.biddingContracts.mineByCode(userId, code),
    enabled: !!userId && !!code,
    queryFn: async (): Promise<MyContract | null> => {
      const { data, error } = await supabase
        .from("auction_bidding_contracts")
        .select(MY_CONTRACT_SELECT)
        .eq("user_id", userId!)
        .eq("code", code!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as MyContract | null) ?? null;
    },
  });
}

export interface DepositBankAccount {
  bank_name: string;
  branch: string | null;
  account_number: string;
  account_holder: string;
}

export interface ContractDepositInfo {
  contract_id: string;
  code: string;
  deposit_due: number;
  /** Hạn nộp = registration_end_at của phiên. */
  deadline: string | null;
  all_lots: boolean;
  lots: { item_id: string; lot_no: number; title: string; deposit_amount: number | null; starting_price: number | null }[];
  /** null = tổ chức chưa khai tài khoản, hoặc hồ sơ chưa thanh toán. */
  bank: DepositBankAccount | null;
  org: { name: string | null; address: string | null; phone: string | null; logo_url: string | null };
}

export function useContractDepositInfo(contractId?: string | null) {
  return useQuery({
    queryKey: qk.biddingContracts.depositInfo(contractId),
    enabled: !!contractId,
    queryFn: async (): Promise<ContractDepositInfo | null> => {
      const { data, error } = await supabase.rpc("my_contract_deposit_info", { _contract_id: contractId! });
      if (error) throw error;
      return (data as unknown as ContractDepositInfo | null) ?? null;
    },
  });
}

/** Người mua báo đã nộp tiền đặt trước (+ chứng từ) ⇒ tổ chức thấy "Chờ đối soát". */
export function useReportDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, proofPath }: { contractId: string; proofPath?: string | null }) => {
      const { error } = await supabase.rpc("buyer_report_deposit", {
        _contract_id: contractId,
        ...(proofPath ? { _proof_path: proofPath } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success("Đã báo nộp tiền đặt trước — chờ tổ chức đối soát.");
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

export function useUndoDepositReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase.rpc("buyer_undo_deposit_report", { _contract_id: contractId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success("Đã hoàn tác báo nộp.");
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

/** Lô đã chọn của một hồ sơ (người mua + tổ chức đọc qua RLS). Rỗng = mọi lô. */
export function useContractLotIds(contractId?: string | null) {
  return useQuery({
    queryKey: qk.biddingContracts.lotIds(contractId),
    enabled: !!contractId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("auction_contract_lots")
        .select("item_id")
        .eq("contract_id", contractId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.item_id);
    },
  });
}

/**
 * Người mua bị ghi vắng gửi lý do (+ giấy tờ chứng minh) để tổ chức xem xét miễn
 * trừ. Chỉ là đề nghị — miễn trừ do org_excuse_absence. Mig 20261018180000.
 */
export function useSubmitAbsenceAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, note, proofPath }: { contractId: string; note: string; proofPath?: string | null }) => {
      const { error } = await supabase.rpc("buyer_submit_absence_appeal", {
        _contract_id: contractId,
        _note: note,
        ...(proofPath ? { _proof_path: proofPath } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success("Đã gửi lý do vắng mặt — tổ chức đấu giá sẽ xem xét.");
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}
