import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AcceptInviteResult,
  InviteEmailStatus,
  OrgInvitePreview,
} from "@/types/orgRbac";
import { qk } from "@/lib/queryKeys";

/** Link người mời copy gửi tay — dự án chưa có hạ tầng gửi email. */
export const inviteLink = (token: string) => `${window.location.origin}/loi-moi/${token}`;

/**
 * Đổi lỗi Postgres/RPC sang câu tiếng Việt. Các RPC dùng RAISE cho lỗi bất
 * thường (mã ngắn) và trả {ok:false, reason} cho lỗi dự kiến được.
 */
export function inviteErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === "23505") return "Đã có lời mời đang chờ cho email này.";
  const msg = e?.message ?? "";
  if (msg.includes("owner_role_forbidden"))
    return "Chỉ Chủ sở hữu mới có thể mời Chủ sở hữu.";
  if (msg.includes("already_member")) return "Người này đã là thành viên của tổ chức.";
  if (msg.includes("role_not_in_org")) return "Vai trò không thuộc tổ chức này.";
  if (msg.includes("invalid_email")) return "Email không hợp lệ.";
  if (msg.includes("not_pending")) return "Lời mời này không còn ở trạng thái đang chờ.";
  if (msg.includes("not_found")) return "Không tìm thấy lời mời.";
  if (msg.includes("not authorized")) return "Bạn không có quyền thực hiện thao tác này.";
  return msg || "Đã xảy ra lỗi, vui lòng thử lại.";
}

// ─── Kiểm tra email trước khi mời ────────────────────────────────────────────
// Mutation chứ không phải query: chạy theo nhịp gõ/blur của người dùng.
export function useCheckInviteEmail() {
  return useMutation({
    mutationFn: async ({ orgId, email }: { orgId: string; email: string }) => {
      const { data, error } = await supabase.rpc("org_check_invite_email", {
        _org_id: orgId,
        _email: email,
      });
      if (error) throw error;
      return data as unknown as InviteEmailStatus;
    },
  });
}

// ─── Tạo / thu hồi / cấp lại lời mời ─────────────────────────────────────────
function invalidateInvites(qc: ReturnType<typeof useQueryClient>, orgId?: string | null) {
  qc.invalidateQueries({ queryKey: qk.orgMembers(orgId) });
}

export function useCreateOrgInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      email,
      roleId,
      days = 14,
    }: {
      orgId: string;
      email: string;
      roleId: string;
      days?: number;
    }) => {
      const { data, error } = await supabase.rpc("create_org_invite", {
        _org_id: orgId,
        _email: email,
        _role_id: roleId,
        _days: days,
      });
      if (error) throw error;
      return data as unknown as { id: string; token: string; expires_at: string };
    },
    onSuccess: (_r, vars) => invalidateInvites(qc, vars.orgId),
  });
}

export function useRevokeOrgInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string; orgId: string }) => {
      const { error } = await supabase.rpc("revoke_org_invite", {
        _membership_id: membershipId,
      });
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateInvites(qc, vars.orgId),
  });
}

export function useRotateOrgInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string; orgId: string }) => {
      const { data, error } = await supabase.rpc("rotate_org_invite", {
        _membership_id: membershipId,
        _days: 14,
      });
      if (error) throw error;
      return data as unknown as { token: string; expires_at: string };
    },
    onSuccess: (_r, vars) => invalidateInvites(qc, vars.orgId),
  });
}

// ─── Trang chấp nhận lời mời ─────────────────────────────────────────────────
export function useInvitePreview(token?: string) {
  return useQuery<OrgInvitePreview>({
    queryKey: ["org-invite", token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_invite_preview", {
        _token: token!,
      });
      if (error) throw error;
      return data as unknown as OrgInvitePreview;
    },
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      token,
      confirmEmailMismatch = false,
    }: {
      token: string;
      confirmEmailMismatch?: boolean;
    }) => {
      const { data, error } = await supabase.rpc("accept_org_invite", {
        _token: token,
        _confirm_email_mismatch: confirmEmailMismatch,
      });
      if (error) throw error;
      return data as unknown as AcceptInviteResult;
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["org-invite", vars.token] });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: qk.myOrgs.all });
        qc.invalidateQueries({ queryKey: ["is-verified-company"] });
      }
    },
  });
}
