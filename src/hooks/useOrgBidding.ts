import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertBiddingRpcOk, biddingErrorMessage } from "@/lib/bidding/errors";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import * as auctioneerRepo from "@/lib/auctioneers/supabase-repo";
import type {
  ConfirmWinnerPaymentOk,
  FinalizeSessionOk,
  IssueMinutesOk,
  LotEvent,
  LotState,
  OpenLotOk,
  SessionMinutes,
} from "@/types/auction-bidding";

/**
 * Điều hành phiên đấu giá trực tuyến — phía TỔ CHỨC (/portal).
 *
 * Quyền: module `dieu-hanh-dau-gia`, action `operate` (mở / tạm dừng / tiếp tục
 * / rút lô) và `finalize` (chốt kết quả, biên bản, xác nhận thanh toán). NGOẠI
 * LỆ: org_mark_deposit_refunded đi theo `ho-so-tham-gia`.update vì hoàn tiền
 * đặt trước thuộc nghiệp vụ hồ sơ, không phải điều hành.
 * Nút ẩn/hiện chỉ là UI — cổng thật nằm ở SECURITY DEFINER trong các RPC.
 *
 * Mọi mutation gọi assertBiddingRpcOk: hai RPC cũ ở useOrgBiddingContracts
 * thiếu bước này vì có TRƯỚC quy ước {ok, reason}, đừng chép lại thiếu sót đó.
 */

function useInvalidateBidding(sessionId?: string | null) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: qk.bidding.all(sessionId) });
}

const showError = (err: unknown) => toast.error(biddingErrorMessage(err));

/**
 * Nhật ký điều hành. CHỈ tổ chức đọc được (auction_lot_events không có policy
 * cho anon) — phòng đấu giá công khai dựng dòng thời gian từ auction_bids.
 * Không nằm trong publication realtime nên phải tự làm mới.
 */
export function useLotEvents(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.bidding.lotEvents(sessionId),
    enabled: !!sessionId,
    // auction_lot_events KHÔNG nằm trong publication realtime (chỉ lot_states +
    // bids được phát). Một lượt trả giá của người mua, hay một lô do pg_cron
    // đóng, sẽ không đánh thức query này — thiếu nhịp tự làm mới thì nhật ký
    // đứng im giữa phiên. Cùng vai trò với lưới an toàn 15 s ở useLotStates.
    refetchInterval: 10_000,
    queryFn: async (): Promise<LotEvent[]> => {
      const { data, error } = await supabase
        .from("auction_lot_events")
        .select("*")
        .eq("session_id", sessionId!)
        .order("at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as LotEvent[];
    },
  });
}

/**
 * Mở lô. `durationSeconds` null = đóng theo giờ kết thúc phiên; ngược lại lô
 * đóng sau chừng ấy giây, nhưng không bao giờ muộn hơn giờ kết thúc phiên
 * (server tự cắt bằng LEAST — xem 20260913000003).
 */
export function useOpenLot(sessionId?: string | null) {
  const invalidate = useInvalidateBidding(sessionId);
  return useMutation({
    mutationFn: async ({ lotId, durationSeconds }: { lotId: string; durationSeconds: number | null }) => {
      const { data, error } = await supabase.rpc("org_open_lot", {
        _lot_id: lotId,
        // undefined để PostgREST BỎ HẲN khoá này và DEFAULT NULL của hàm SQL
        // được áp dụng — giữ nguyên hình dạng lời gọi như trước khi có tham số.
        _duration_seconds: durationSeconds ?? undefined,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as OpenLotOk;
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(`Đã mở lô để trả giá. Lô đóng lúc ${formatDateTime(res.ends_at)}.`);
    },
    onError: showError,
  });
}

export function usePauseLot(sessionId?: string | null) {
  const invalidate = useInvalidateBidding(sessionId);
  return useMutation({
    mutationFn: async ({ lotId, reason }: { lotId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("org_pause_lot", { _lot_id: lotId, _reason: reason });
      if (error) throw error;
      assertBiddingRpcOk(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã tạm dừng lô.");
    },
    onError: showError,
  });
}

export function useResumeLot(sessionId?: string | null) {
  const invalidate = useInvalidateBidding(sessionId);
  return useMutation({
    mutationFn: async (lotId: string) => {
      const { data, error } = await supabase.rpc("org_resume_lot", { _lot_id: lotId });
      if (error) throw error;
      assertBiddingRpcOk(data);
    },
    onSuccess: () => {
      invalidate();
      // Thời gian tạm dừng được cộng trả lại vào ends_at.
      toast.success("Đã tiếp tục lô. Thời gian tạm dừng được bù lại.");
    },
    onError: showError,
  });
}

export function useWithdrawLot(sessionId?: string | null) {
  const invalidate = useInvalidateBidding(sessionId);
  return useMutation({
    mutationFn: async ({ lotId, reason }: { lotId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("org_withdraw_lot", { _lot_id: lotId, _reason: reason });
      if (error) throw error;
      assertBiddingRpcOk(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã rút lô khỏi phiên.");
    },
    onError: showError,
  });
}

export function useFinalizeSession(sessionId?: string | null) {
  const invalidate = useInvalidateBidding(sessionId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<FinalizeSessionOk> => {
      const { data, error } = await supabase.rpc("org_finalize_session", { _session_id: id });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as FinalizeSessionOk;
    },
    onSuccess: (res) => {
      invalidate();
      // Chốt phiên chuyển tiền đặt trước sang applied / pending_refund.
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      queryClient.invalidateQueries({ queryKey: qk.auctionSessions.byId(sessionId) });
      toast.success(`Đã chốt kết quả phiên: ${res.sold} lô đấu giá thành, ${res.unsold} lô không thành.`);
    },
    onError: showError,
  });
}

export function useConfirmWinnerPayment(sessionId?: string | null) {
  const invalidate = useInvalidateBidding(sessionId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lotId, paid }: { lotId: string; paid: boolean }) => {
      const { data, error } = await supabase.rpc("org_confirm_winner_payment", {
        _lot_id: lotId,
        _paid: paid,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as ConfirmWinnerPaymentOk;
    },
    onSuccess: (res) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success(
        res.payment_status === "paid"
          ? "Đã ghi nhận người trúng đấu giá thanh toán."
          : "Đã ghi nhận không thanh toán. Tiền đặt trước không được hoàn trả.",
      );
    },
    onError: showError,
  });
}

/** Quyền `ho-so-tham-gia`.update — KHÁC với các thao tác điều hành ở trên. */
export function useMarkDepositRefunded(sessionId?: string | null) {
  const invalidate = useInvalidateBidding(sessionId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, note }: { contractId: string; note?: string }) => {
      const { data, error } = await supabase.rpc("org_mark_deposit_refunded", {
        _contract_id: contractId,
        _note: note,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success("Đã ghi nhận hoàn trả tiền đặt trước.");
    },
    onError: showError,
  });
}

/**
 * Ghi nhận biên bản ĐÃ tải lên bucket auction-minutes. Tệp phải tồn tại trước
 * khi gọi (RPC kiểm tra), đường dẫn bắt buộc dạng {orgId}/{sessionId}/{tên}.pdf.
 */
export function useIssueMinutes(sessionId?: string | null) {
  const invalidate = useInvalidateBidding(sessionId);
  return useMutation({
    mutationFn: async ({ id, pdfPath, hash }: { id: string; pdfPath: string; hash: string }) => {
      const { data, error } = await supabase.rpc("org_issue_minutes", {
        _session_id: id,
        _pdf_path: pdfPath,
        _hash: hash,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as IssueMinutesOk;
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(`Đã phát hành biên bản lần ${res.sequence_no}.`);
    },
    onError: showError,
  });
}

/**
 * Kết quả từng lô cho TRANG CÔNG KHAI /sessions/:id.
 *
 * KHÔNG dùng useLotStates: hook đó mở kênh realtime `bidding:{id}` và cả phòng
 * đấu giá lẫn phòng điều hành đều tự nhận là nơi mount duy nhất — một thẻ kết
 * quả trên trang phiên sẽ mở kênh thứ hai trùng tên cho mọi khách vãng lai.
 *
 * Cố ý KHÔNG lấy payment_status / winner_contract_id: trang công khai nói kết
 * quả đấu giá, không nói người trúng đã trả tiền chưa.
 */
export function useSessionResults(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.bidding.results(sessionId),
    enabled: !!sessionId,
    staleTime: 60_000,
    queryFn: async (): Promise<LotState[]> => {
      const { data, error } = await supabase
        .from("auction_lot_states")
        .select(
          "lot_id, session_id, status, result, winning_amount, leading_bidder_no, bid_count, closed_at, withdraw_reason",
        )
        .eq("session_id", sessionId!);
      if (error) throw error;
      return (data ?? []) as unknown as LotState[];
    },
  });
}

/**
 * Biên bản đã phát hành. MỘT hook cho cả tổ chức lẫn khách: RLS quyết ai thấy gì
 * (org đọc luôn; anon chỉ đọc khi phiên đã chốt — auction_session_minutes_public_read).
 */
export function useSessionMinutes(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.bidding.minutes(sessionId),
    enabled: !!sessionId,
    queryFn: async (): Promise<SessionMinutes[]> => {
      const { data, error } = await supabase
        .from("auction_session_minutes")
        .select("*")
        .eq("session_id", sessionId!)
        .order("sequence_no", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Đấu giá viên của tổ chức, để chọn người điều hành in lên biên bản.
 *
 * Gọi thẳng repo với organization_id CỦA PHIÊN, KHÔNG dùng useAuctioneers():
 * hook đó bám usePortalOrg() (tổ chức đang chọn ở OrgSwitcher) — đúng cái bẫy
 * sai-tổ-chức Bước 5 đã vá cho danh sách người trả giá.
 */
export function useSessionAuctioneers(organizationId?: string | null) {
  return useQuery({
    queryKey: ["org-auctioneers", organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = await auctioneerRepo.listByOrg(organizationId!);
      return rows.filter((a) => a.isActive);
    },
  });
}
