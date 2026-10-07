import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertBiddingRpcOk, biddingErrorMessage } from "@/lib/bidding/errors";
import type { CheckInResult, CheckinAttendee, CheckinOtpResult } from "@/types/bidding-contract";

/**
 * Người mua tự điểm danh phiên TRỰC TUYẾN: gửi mã OTP ⇒ nhập mã ⇒ số báo danh.
 *
 * ⚠️ OTP MÔ PHỎNG: request_checkin_otp trả `demo_code` để hiện ngay trên màn
 * hình. Seam thật = Edge Function gửi SMS, bỏ trường đó — UI chỉ cần ẩn ô gợi ý
 * khi demo_code vắng mặt.
 *
 * Sai mã KHÔNG ném lỗi Postgres (server phải ghi được lần đếm sai) mà trả
 * { ok:false, reason:'otp_invalid', attempts_left } ⇒ BiddingRpcError.details.
 */
export function useSelfCheckIn(contractId?: string | null) {
  const queryClient = useQueryClient();

  const requestOtp = useMutation({
    mutationFn: async (): Promise<CheckinOtpResult> => {
      const { data, error } = await supabase.rpc("request_checkin_otp", { _contract_id: contractId! });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as CheckinOtpResult;
    },
    onError: (err) => toast.error(biddingErrorMessage(err)),
  });

  const confirm = useMutation({
    mutationFn: async (v: { code: string; attendee?: CheckinAttendee }): Promise<CheckInResult> => {
      const { data, error } = await supabase.rpc("self_check_in", {
        _contract_id: contractId!,
        _code: v.code,
        _attendee: v.attendee,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as CheckInResult;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success(`Đã điểm danh — số báo danh của bạn là ${r.bidder_no}.`);
    },
    // Không toast lỗi: dialog OTP hiện lỗi ngay dưới ô nhập (còn bao nhiêu lần thử).
  });

  return { requestOtp, confirm };
}
