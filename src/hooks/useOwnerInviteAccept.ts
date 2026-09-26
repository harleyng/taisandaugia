import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import type { OwnerWsRole } from "@/lib/ownerWorkspace/roles";
import { writeSelectedWorkspace } from "@/lib/ownerWorkspace/selection";

// Trang /loi-moi-chu-tai-san/:token — đứng ngoài cổng (người dùng chưa là thành
// viên), mọi thứ qua RPC owner_ws_invite_preview / owner_ws_accept_invite.

export interface OwnerInvitePreview {
  ok: boolean;
  reason?: string;
  workspace_name?: string;
  role?: OwnerWsRole;
  invite_email?: string;
  expired?: boolean;
  accepted?: boolean;
  accepted_by_me?: boolean;
  revoked?: boolean;
}

export type OwnerAcceptResult =
  | { ok: true; workspace_id: string; already_member?: boolean }
  | { ok: false; reason: string; invite_email?: string };

/** Key cục bộ: phụ thuộc người đang đăng nhập (accepted_by_me). */
const previewKey = (token?: string, userId?: string | null) => ["owner-ws-invite", token, userId] as const;

export function useOwnerInvitePreview(token: string | undefined) {
  const { userId, loading } = useAuth();
  return useQuery({
    queryKey: previewKey(token, userId),
    enabled: !!token && !loading,
    retry: false,
    queryFn: async (): Promise<OwnerInvitePreview> => {
      const { data, error } = await supabase.rpc("owner_ws_invite_preview", { p_token: token! });
      if (error) throw error;
      return data as unknown as OwnerInvitePreview;
    },
  });
}

/**
 * Trả nguyên kết quả (KHÔNG assert) để trang rẽ nhánh theo reason. Thành công ⇒
 * chọn luôn không gian vừa tham gia và tải lại danh sách thành viên-của-tôi
 * TRƯỚC khi trang điều hướng, để người đã có không gian riêng không bị đưa về
 * không gian cũ.
 */
export function useAcceptOwnerInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<{ result: OwnerAcceptResult; userId: string | null }> => {
      const { data, error } = await supabase.rpc("owner_ws_accept_invite", { p_token: token });
      if (error) throw error;
      // Đọc phiên tại chỗ: ngay sau khi đăng nhập, userId trong closure có thể còn cũ.
      const { data: sessionData } = await supabase.auth.getSession();
      return { result: data as unknown as OwnerAcceptResult, userId: sessionData.session?.user.id ?? null };
    },
    onSuccess: async ({ result, userId }, token) => {
      if (result.ok && userId) {
        writeSelectedWorkspace(userId, result.workspace_id);
        await queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.memberships(userId) });
      }
      await queryClient.invalidateQueries({ queryKey: ["owner-ws-invite", token] });
    },
  });
}
