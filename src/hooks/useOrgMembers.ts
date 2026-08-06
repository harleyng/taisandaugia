import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrgMemberRow } from "@/types/orgRbac";
import { qk } from "@/lib/queryKeys";

interface MembershipRow {
  id: string;
  user_id: string | null;
  status: string;
  joined_at: string | null;
  created_at: string;
  invite_token: string | null;
  invite_email: string | null;
  invite_expires_at: string | null;
  role_id: string;
  org_roles: { id: string; name: string; code: string } | null;
  profiles: { id: string; email: string | null; name: string | null } | null;
}

/**
 * Thành viên + lời mời đang chờ của một tổ chức, gộp thành MỘT danh sách.
 *
 * QUAN TRỌNG — phải chỉ đích danh khóa ngoại khi embed `profiles`:
 * organization_memberships có HAI FK trỏ về profiles (`user_id` và `invited_by`),
 * nên `profiles(...)` trần sẽ khiến PostgREST trả lỗi PGRST201 và hỏng CẢ query
 * (danh sách trông như rỗng chứ không báo lỗi gì).
 */
export function useOrgMembers(orgId?: string | null) {
  return useQuery<OrgMemberRow[]>({
    queryKey: qk.orgMembers(orgId),
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_memberships")
        .select(
          "id, user_id, status, joined_at, created_at, invite_token, invite_email, invite_expires_at, role_id, " +
            "org_roles(id,name,code), " +
            "profiles!organization_memberships_user_id_fkey(id,email,name)",
        )
        .eq("organization_id", orgId!)
        .neq("status", "INACTIVE")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const now = Date.now();
      const rows = (data ?? []) as unknown as MembershipRow[];

      return rows
        .map((r): OrgMemberRow => {
          const isInvite = r.status === "PENDING_INVITE" && !r.user_id;
          return {
            membershipId: r.id,
            kind: isInvite ? "INVITE" : "MEMBER",
            userId: r.user_id,
            email: isInvite ? r.invite_email : (r.profiles?.email ?? null),
            name: isInvite ? null : (r.profiles?.name ?? null),
            joinedAt: r.joined_at,
            createdAt: r.created_at,
            roleId: r.role_id,
            roleName: r.org_roles?.name ?? "—",
            roleCode: r.org_roles?.code ?? "",
            token: isInvite ? r.invite_token : null,
            expiresAt: isInvite ? r.invite_expires_at : null,
            isExpired:
              isInvite && !!r.invite_expires_at && new Date(r.invite_expires_at).getTime() < now,
          };
        })
        // Thành viên trước, lời mời sau — vẫn là một bảng, chỉ là thứ tự đọc tự nhiên.
        .sort((a, b) =>
          a.kind === b.kind
            ? a.createdAt.localeCompare(b.createdAt)
            : a.kind === "MEMBER"
              ? -1
              : 1,
        );
    },
  });
}

function invalidateMembers(qc: ReturnType<typeof useQueryClient>, orgId?: string | null) {
  qc.invalidateQueries({ queryKey: qk.orgMembers(orgId) });
  qc.invalidateQueries({ queryKey: qk.orgRoles(orgId) }); // số thành viên mỗi vai trò
  qc.invalidateQueries({ queryKey: qk.orgPermissions.all });
  qc.invalidateQueries({ queryKey: qk.myOrgs.all });
}

export function useChangeMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      membershipId,
      roleId,
    }: {
      membershipId: string;
      orgId: string;
      roleId: string;
    }) => {
      const { error } = await supabase
        .from("organization_memberships")
        .update({ role_id: roleId, updated_at: new Date().toISOString() })
        .eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateMembers(qc, vars.orgId),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string; orgId: string }) => {
      const { error } = await supabase
        .from("organization_memberships")
        .delete()
        .eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateMembers(qc, vars.orgId),
  });
}
