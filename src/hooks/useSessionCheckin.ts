import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertBiddingRpcOk, biddingErrorMessage } from "@/lib/bidding/errors";
import { CONTRACT_WITH_SESSION_SELECT } from "@/hooks/useBiddingContracts";
import type {
  CheckInResult,
  CheckinAttendee,
  CheckinLookupResult,
  CheckinSummary,
  ContractWithSession,
} from "@/types/bidding-contract";

/**
 * Điểm danh — phía TỔ CHỨC (20261008100300). Mọi RPC ở đây trả
 * { ok:false, reason } cho thất bại dự kiến ⇒ luôn assertBiddingRpcOk.
 *
 * Không thêm bảng vào realtime publication: danh sách tự làm mới mỗi 10 giây,
 * đủ cho cửa điểm danh (người quét ở cửa tự thấy kết quả ngay qua invalidate).
 * Mọi key nằm dưới qk.biddingContracts.all nên duyệt / tiền đặt trước / điểm
 * danh làm mới lẫn nhau.
 */

const POLL_MS = 10_000;

/** Số đếm công khai: đã điểm danh / còn chờ / vắng + cửa sổ điểm danh. */
export function useCheckinSummary(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.biddingContracts.checkinSummary(sessionId),
    enabled: !!sessionId,
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<CheckinSummary | null> => {
      const { data, error } = await supabase.rpc("auction_session_checkin_summary", { _session_id: sessionId! });
      if (error) throw error;
      return (data as unknown as CheckinSummary | null) ?? null;
    },
  });
}

/**
 * Danh sách điểm danh của MỘT phiên + số đếm. Cùng key với
 * useSessionBiddingContracts (dùng chung cache) nhưng tự làm mới 10 giây.
 * Lọc theo session_id chứ không theo tổ chức đang chọn (xem chú thích ở
 * useSessionBiddingContracts). Gồm cả hồ sơ bị từ chối để bảng đếm đủ.
 */
export function useSessionCheckin(sessionId?: string | null) {
  const roster = useQuery({
    queryKey: qk.biddingContracts.bySession(sessionId),
    enabled: !!sessionId,
    refetchInterval: POLL_MS,
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
  const summary = useCheckinSummary(sessionId);
  return { roster, summary };
}

/** Tra theo mã QR trên phiếu (uuid) hoặc mã hồ sơ / số giấy tờ / tên. */
export function useCheckinLookup(sessionId?: string | null, query?: string) {
  const q = (query ?? "").trim();
  return useQuery({
    queryKey: qk.biddingContracts.checkinLookup(sessionId, q),
    enabled: !!sessionId && q.length >= 2,
    queryFn: async (): Promise<CheckinLookupResult> => {
      const { data, error } = await supabase.rpc("org_checkin_lookup", { _session_id: sessionId!, _query: q });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as CheckinLookupResult;
    },
  });
}

/** Nhân viên điểm danh tại chỗ (phiên trực tiếp) ⇒ số báo danh ngẫu nhiên. */
export function useOrgCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { contractId: string; attendee: CheckinAttendee; note?: string }) => {
      const { data, error } = await supabase.rpc("org_check_in", {
        _contract_id: v.contractId,
        _attendee: v.attendee,
        _note: v.note,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as CheckInResult;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success(r.already ? `Đã điểm danh trước đó — số báo danh ${r.bidder_no}.` : `Đã điểm danh — số báo danh ${r.bidder_no}.`);
    },
    onError: (err) => toast.error(biddingErrorMessage(err)),
  });
}

/** Đấu giá viên chốt danh sách sớm (sau giờ bắt đầu) — ai chưa điểm danh thành vắng. */
export function useCloseRosterNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc("org_close_roster_now", { _session_id: sessionId });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as { absent: number };
    },
    onSuccess: (r, sessionId) => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      // roster_closed_at nằm trên auction_sessions — tab Điểm danh đọc nó để khoá nút.
      queryClient.invalidateQueries({ queryKey: qk.auctionSessions.byId(sessionId) });
      toast.success(r.absent > 0 ? `Đã chốt danh sách — ${r.absent} người vắng mặt.` : "Đã chốt danh sách điểm danh.");
    },
    onError: (err) => toast.error(biddingErrorMessage(err)),
  });
}
