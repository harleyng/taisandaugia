import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import { useSessionOrg } from "@/hooks/useAuctionSessions";
import { CONTRACT_WITH_SESSION_SELECT } from "@/hooks/useBiddingContracts";
import type { ContractWithSession, DepositStatus } from "@/types/bidding-contract";

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

const DEPOSIT_TOAST: Record<DepositStatus, string> = {
  pending: "Đã chuyển về chưa nhận tiền đặt trước.",
  received: "Đã xác nhận nhận tiền đặt trước.",
  refunded: "Đã ghi nhận hoàn trả tiền đặt trước.",
  forfeited: "Đã ghi nhận không hoàn trả tiền đặt trước.",
};

export function useSetContractDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { contractId: string; status: DepositStatus; amount?: number; note?: string }) => {
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
