import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import { useSessionOrg } from "@/hooks/useAuctionSessions";
import { CONTRACT_WITH_SESSION_SELECT } from "@/hooks/useBiddingContracts";
import type { ContractWithSession, DepositActionStatus } from "@/types/bidding-contract";

/**
 * Hồ sơ tham gia — phía TỔ CHỨC (/portal).
 *
 * Tổ chức lấy theo MEMBERSHIP (useSessionOrg), không theo owner_id. RLS chỉ trả
 * hồ sơ ĐÃ thanh toán; lọc thêm status ở đây để chính chủ tổ chức (nếu từng mua
 * hồ sơ phiên tổ chức khác) không lẫn dòng của mình vào.
 *
 * Một query cho cả tổ chức; thẻ trong chi tiết phiên lọc theo session_id ở
 * client — hai màn dùng chung cache nên cập nhật ở màn này hiện ngay ở màn kia.
 */
export function useOrgBiddingContracts() {
  const { organizationId } = useSessionOrg();
  return useQuery({
    queryKey: qk.biddingContracts.byOrg(organizationId),
    enabled: !!organizationId,
    queryFn: async (): Promise<ContractWithSession[]> => {
      const { data, error } = await supabase
        .from("auction_bidding_contracts")
        .select(CONTRACT_WITH_SESSION_SELECT)
        .eq("organization_id", organizationId!)
        .eq("status", "paid")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContractWithSession[];
    },
  });
}

/**
 * Hồ sơ tham gia của MỘT phiên — dùng ở màn điều hành.
 *
 * KHÔNG dùng useOrgBiddingContracts ở đó: hook kia lọc theo tổ chức ĐANG CHỌN
 * trong OrgSwitcher, mà một người có thể sở hữu nhiều tổ chức. Mở thẳng link
 * phòng điều hành của tổ chức khác là danh sách rỗng — giữa phiên đấu giá, đó
 * là lời nói dối "chưa ai đủ điều kiện". Lọc theo session_id thì luôn đúng, và
 * RLS vẫn chặn người ngoài tổ chức.
 */
export function useSessionBiddingContracts(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.biddingContracts.bySession(sessionId),
    enabled: !!sessionId,
    queryFn: async (): Promise<ContractWithSession[]> => {
      const { data, error } = await supabase
        .from("auction_bidding_contracts")
        .select(CONTRACT_WITH_SESSION_SELECT)
        .eq("session_id", sessionId!)
        .eq("status", "paid")
        .order("bidder_no", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContractWithSession[];
    },
  });
}

/** Tổ chức đã có hợp đồng hợp tác bán hồ sơ qua sàn chưa (gợi ý trong form phiên). */
export function useDossierSaleReady() {
  const { organizationId } = useSessionOrg();
  return useQuery({
    queryKey: ["dossier-sale-ready", organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("org_dossier_sale_ready", { _organization_id: organizationId! });
      if (error) throw error;
      return data === true;
    },
  });
}

/**
 * Hẹp theo DepositActionStatus chứ KHÔNG theo DepositStatus: org_set_contract_deposit
 * chỉ nhận bốn giá trị này. `applied` / `pending_refund` đi qua org_finalize_session
 * và org_mark_deposit_refunded, không bao giờ qua đây — thêm toast cho chúng là
 * thêm hai câu không bao giờ chạy tới.
 */
const DEPOSIT_TOAST: Record<DepositActionStatus, string> = {
  pending: "Đã chuyển về chưa nhận tiền đặt trước.",
  received: "Đã xác nhận nhận tiền đặt trước.",
  refunded: "Đã ghi nhận hoàn trả tiền đặt trước.",
  forfeited: "Đã ghi nhận không hoàn trả tiền đặt trước.",
};

export function useSetContractDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { contractId: string; status: DepositActionStatus; amount?: number; note?: string }) => {
      const { error } = await supabase.rpc("org_set_contract_deposit", {
        _contract_id: v.contractId,
        _status: v.status,
        _amount: v.amount,
        _note: v.note,
      });
      if (error) throw error;
      return v.status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success(DEPOSIT_TOAST[status]);
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

export function useAssignBidderNo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { contractId: string; bidderNo?: number }) => {
      const { data, error } = await supabase.rpc("org_assign_bidder_no", {
        _contract_id: v.contractId,
        _bidder_no: v.bidderNo,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (no) => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success(`Đã cấp số báo danh ${no}.`);
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}
