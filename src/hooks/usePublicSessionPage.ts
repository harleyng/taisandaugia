import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import type { CaseDocType } from "@/types/case-qa";

/**
 * Dữ liệu thêm cho trang phiên trên sàn (migration 20261018150000_public_session_page).
 *
 * RPC + bảng của migration đó CHƯA có trong types.ts (CLI đang đăng nhập tài khoản
 * khác nên chưa regen được) ⇒ gọi qua client không định kiểu và ép kiểu kết quả
 * tại đây — chỉ ở file này. Regen types xong thì bỏ `untyped`.
 */
const untyped = supabase as unknown as SupabaseClient;

export interface PublicSessionDocument {
  id: string;
  doc_type: CaseDocType;
  title: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  issued_at: string;
}

export interface PublicOrgStats {
  sessions_count: number;
  finalized_count: number;
  successful_sessions: number;
  lots_sold: number;
}

export interface SessionOpenWatch {
  email: string;
  notified_at: string | null;
}

/** Tài liệu ĐÃ XÁC NHẬN của phiên đã công bố/huỷ — tải tệp qua policy storage công khai. */
export function usePublicSessionDocuments(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.auctionSessions.publicDocuments(sessionId),
    enabled: !!sessionId,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicSessionDocument[]> => {
      const { data, error } = await untyped.rpc("public_session_documents", { _session_id: sessionId });
      if (error) throw error;
      return (data ?? []) as PublicSessionDocument[];
    },
  });
}

export async function openPublicSessionDocument(path: string) {
  const { data, error } = await supabase.storage.from("case-documents").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    toast.error("Không mở được tài liệu. Vui lòng thử lại.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function usePublicOrgStats(auctionOrgId?: string | null) {
  return useQuery({
    queryKey: qk.auctionSessions.orgStats(auctionOrgId),
    enabled: !!auctionOrgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PublicOrgStats | null> => {
      const { data, error } = await untyped.rpc("public_auction_org_stats", { _auction_org_id: auctionOrgId });
      if (error) throw error;
      return (data as PublicOrgStats | null) ?? null;
    },
  });
}

/** session_id → số hồ sơ đã bán + đang giữ chỗ (cùng phép đếm auction_session_contract_summary). */
export function useSessionSeatCounts(sessionIds: string[]) {
  return useQuery({
    queryKey: qk.auctionSessions.seatCounts(sessionIds),
    enabled: sessionIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await untyped.rpc("public_session_seat_counts", { _session_ids: sessionIds });
      if (error) throw error;
      const rows = (data ?? []) as { session_id: string; paid_count: number; held_count: number }[];
      return new Map(rows.map((r) => [r.session_id, r.paid_count + r.held_count]));
    },
  });
}

export function useMySessionOpenWatch(sessionId?: string | null) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.auctionSessions.openWatch(userId, sessionId),
    enabled: !!userId && !!sessionId,
    queryFn: async (): Promise<SessionOpenWatch | null> => {
      const { data, error } = await untyped
        .from("session_open_watchers")
        .select("email, notified_at")
        .eq("session_id", sessionId!)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as SessionOpenWatch | null) ?? null;
    },
  });
}

const WATCH_ERRORS: Record<string, string> = {
  invalid_email: "Email không hợp lệ.",
  already_open: "Phiên đã mở bán hồ sơ — bạn có thể mua ngay.",
  session_not_found: "Không tìm thấy phiên đấu giá.",
  auth_required: "Vui lòng đăng nhập.",
};

const watchErrorMessage = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? "");
  const key = Object.keys(WATCH_ERRORS).find((k) => msg.includes(k));
  return key ? WATCH_ERRORS[key] : "Không đăng ký được. Vui lòng thử lại.";
};

export function useWatchSessionOpen(sessionId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await untyped.rpc("watch_session_open", { _session_id: sessionId, _email: email });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.auctionSessions.openWatch(userId, sessionId) });
      toast.success("Đã đăng ký — chúng tôi sẽ gửi email khi phiên mở bán hồ sơ.");
    },
    onError: (err) => toast.error(watchErrorMessage(err)),
  });
}

export function useUnwatchSessionOpen(sessionId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await untyped
        .from("session_open_watchers")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.auctionSessions.openWatch(userId, sessionId) });
      toast.success("Đã huỷ nhận email.");
    },
    onError: () => toast.error("Không huỷ được. Vui lòng thử lại."),
  });
}
