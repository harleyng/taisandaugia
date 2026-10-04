import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { mapSharedPostingResponse, type SharedPostingResult, type ShareEvent } from "@/lib/postingShare/types";
import { shareDevice, shareVisitorId } from "@/lib/postingShare/visitor";

// Trang công khai Hồ sơ online /hs/:code (anon). Server lọc payload theo danh sách trắng và
// chỉ đếm người ngoài đơn vị.

/**
 * Mỗi lần gọi RPC có thể là một lượt xem ⇒ gọi đúng MỘT lần: không refetch khi focus /
 * reconnect / mount lại, không retry (cùng luật useSharedOwnerReport).
 * `countView = false` cho trang in — mở bản in không phải lượt xem mới.
 */
export function useSharedPosting(code: string | undefined, countView = true) {
  return useQuery({
    queryKey: qk.postingShare.shared(code),
    enabled: !!code,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<SharedPostingResult> => {
      const { data, error } = await supabase.rpc("get_shared_posting", {
        p_code: code!,
        // Mã không hợp lệ ⇒ server bỏ qua bộ đếm (bản in dùng cách này).
        p_visitor_id: countView ? shareVisitorId() : "print",
        p_device: shareDevice(),
      });
      if (error) throw error;
      return mapSharedPostingResponse(data);
    },
  });
}

/** Ghi một lần bấm CTA — không chặn thao tác của người dùng, lỗi thì bỏ qua. */
export function trackShareEvent(code: string | undefined, event: ShareEvent): void {
  if (!code) return;
  void (async () => {
    try {
      await supabase.rpc("track_posting_share_event", {
        p_code: code,
        p_visitor_id: shareVisitorId(),
        p_event: event,
        p_device: shareDevice(),
      });
    } catch {
      // Đếm hụt một lần bấm không đáng để làm phiền người xem.
    }
  })();
}

const FOLLOW_ERRORS: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để nhận thông báo.",
  expired: "Link hồ sơ đã hết hạn.",
  unavailable: "Hồ sơ đang được cập nhật — vui lòng thử lại sau.",
  not_found: "Link hồ sơ không còn hiệu lực.",
};

/**
 * "Nhận thông báo khi mở phiên" (hồ sơ) / "Lưu tài sản" (tin trên sàn — `save`) — gọi sau khi đã
 * đăng nhập (openAuthDialog lo phần đó).
 */
export function useFollowSharedPosting(code: string | undefined, save = false) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("follow_shared_posting", { p_code: code! });
      if (error) throw error;
      const d = (data ?? {}) as { ok?: boolean; reason?: string; already?: boolean };
      if (d.ok === false) throw new Error(FOLLOW_ERRORS[d.reason ?? ""] ?? "Chưa đăng ký được. Vui lòng thử lại.");
      return { already: d.already === true };
    },
    onSuccess: ({ already }) =>
      toast.success(
        save
          ? already
            ? "Bạn đã lưu tài sản này trước đó."
            : "Đã lưu tài sản — xem lại trong mục tài sản đã lưu của bạn."
          : already
            ? "Bạn đã đăng ký nhận thông báo cho tài sản này trước đó."
            : "Đã đăng ký — sàn sẽ báo bạn khi tài sản được đưa lên phiên đấu giá.",
      ),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Chưa đăng ký được. Vui lòng thử lại."),
  });
}
