import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import { assertBiddingRpcOk, biddingErrorMessage } from "@/lib/bidding/errors";
import { useSessionOrg } from "@/hooks/useAuctionSessions";
import { CONTRACT_WITH_SESSION_SELECT } from "@/hooks/useBiddingContracts";
import type {
  ContractStatus,
  ContractWithSession,
  DepositActionStatus,
  ReviewDecision,
} from "@/types/bidding-contract";

/**
 * Hồ sơ tham gia — phía TỔ CHỨC (/portal).
 *
 * Tổ chức lấy theo MEMBERSHIP (useSessionOrg), không theo owner_id. RLS trả hồ
 * sơ đã thanh toán + đã bị từ chối (refunded — lịch sử duyệt); lọc thêm status ở
 * đây để chính chủ tổ chức (nếu từng mua hồ sơ phiên tổ chức khác) không lẫn dòng
 * đang chờ thanh toán của mình vào. Đếm "đã bán" / suất thì lọc status 'paid'.
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
        .in("status", ["paid", "refunded"])
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
      toast.success(`Đã đổi số báo danh thành ${no}.`);
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

const REVIEW_TOAST: Record<ReviewDecision, string> = {
  approved: "Đã duyệt hồ sơ.",
  needs_info: "Đã yêu cầu người mua bổ sung hồ sơ.",
  rejected: "Đã từ chối hồ sơ — tiền hồ sơ được hoàn cho người mua.",
};

export interface ReviewContractResult {
  contract_id: string;
  review_status: ReviewDecision;
  status: Extract<ContractStatus, "paid" | "refunded">;
}

/**
 * Duyệt / yêu cầu bổ sung / từ chối (org_review_bidding_contract, quyền
 * ho-so-tham-gia:review). Từ chối bắt buộc lý do và hoàn tiền hồ sơ (mô phỏng);
 * tiền đặt trước đã nhận chuyển sang chờ hoàn trả. RPC RAISE câu tiếng Việt.
 */
export function useReviewContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { contractId: string; decision: ReviewDecision; note?: string }) => {
      const { data, error } = await supabase.rpc("org_review_bidding_contract", {
        _contract_id: v.contractId,
        _decision: v.decision,
        _note: v.note,
      });
      if (error) throw error;
      return data as unknown as ReviewContractResult;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success(REVIEW_TOAST[r.review_status]);
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

/**
 * Miễn trừ vắng mặt (giả định F1-b — chưa chốt): tiền đặt trước bị giữ do vắng
 * chuyển sang chờ hoàn trả. RPC trả { ok:false, reason } ⇒ assertBiddingRpcOk.
 */
export function useExcuseAbsence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { contractId: string; note: string }) => {
      const { data, error } = await supabase.rpc("org_excuse_absence", {
        _contract_id: v.contractId,
        _note: v.note,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success("Đã miễn trừ vắng mặt — tiền đặt trước chờ hoàn trả.");
    },
    onError: (err) => toast.error(biddingErrorMessage(err)),
  });
}
