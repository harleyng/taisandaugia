import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { assertOwnerWsRpcOk } from "@/lib/ownerWorkspace/errors";

// Liên kết trụ sở ↔ chi nhánh (docs/owner-control-tower-plan.md Phase 14,
// migration 20260926185917). Mọi thao tác ghi đi qua RPC owner_ws_* — bảng yêu
// cầu không có policy ghi. Kết quả `{ ok:false, reason }` ⇒ assertOwnerWsRpcOk.

export type OwnerLinkChildState =
  /** Đơn vị con trong danh bạ chưa có Trạm. */
  | "no_workspace"
  /** Có Trạm, gửi yêu cầu được. */
  | "available"
  | "pending"
  | "linked"
  /** Đã liên kết với một trụ sở khác. */
  | "linked_elsewhere"
  /** Trạm đó đang là trụ sở của đơn vị khác, hoặc trạm mình đang là chi nhánh. */
  | "ineligible";

export interface OwnerLinkChild {
  asset_owner_id: string | null;
  name: string;
  workspace_id: string | null;
  workspace_name: string | null;
  state: OwnerLinkChildState;
  request_id: string | null;
  requested_at: string | null;
  linked_at: string | null;
}

export interface OwnerLinkIncoming {
  request_id: string;
  workspace_name: string;
  entity_name: string | null;
  requested_at: string;
}

export interface OwnerLinkOverview {
  workspace_name: string;
  /** Pháp nhân trong danh bạ mà Trạm đại diện; null = tên tự nhập. */
  entity: { name: string; parent_name: string | null } | null;
  /** Trụ sở đang liên kết (Trạm này là chi nhánh). */
  parent: { workspace_name: string; entity_name: string | null; linked_at: string | null } | null;
  incoming: OwnerLinkIncoming[];
  /** Có pháp nhân và không tự là chi nhánh ⇒ gửi được yêu cầu tới đơn vị con. */
  can_have_children: boolean;
  children: OwnerLinkChild[];
}

/** Tổng quan liên kết của Trạm — chỉ thành viên trực tiếp (trụ sở xem qua liên kết thì không). */
export function useOwnerLinkOverview(workspaceId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.ownerWorkspace.linkOverview(workspaceId),
    enabled: !!workspaceId && enabled,
    queryFn: async (): Promise<OwnerLinkOverview> => {
      const { data, error } = await supabase.rpc("owner_ws_link_overview", { p_workspace_id: workspaceId! });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
      return data as unknown as OwnerLinkOverview;
    },
  });
}

/** Số yêu cầu liên kết đang chờ Trạm này trả lời — huy hiệu nav, chỉ Trưởng đơn vị. */
export function usePendingLinkRequestCount(workspaceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.ownerWorkspace.linkRequests(workspaceId),
    enabled: !!workspaceId && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("owner_workspace_link_requests")
        .select("id", { count: "exact", head: true })
        .eq("child_workspace_id", workspaceId!)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * Mutation dùng chung: làm mới toàn bộ Trạm hiện tại + danh sách không gian của
 * chính người dùng (trụ sở huỷ liên kết ⇒ trạm con rời bộ chuyển không gian).
 */
function useLinkMutation<TInput>(workspaceId: string | null, call: (input: TInput) => PromiseLike<{ data: unknown; error: unknown }>) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (input: TInput) => {
      const { data, error } = await call(input);
      if (error) throw error;
      assertOwnerWsRpcOk(data);
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.all(workspaceId) });
      queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.memberships(userId) });
    },
  });
}

/** Trụ sở gửi yêu cầu tới Trạm của đơn vị con. */
export function useRequestOwnerLink(workspaceId: string | null) {
  return useLinkMutation(workspaceId, (childWorkspaceId: string) =>
    supabase.rpc("owner_ws_request_link", { p_parent_ws: workspaceId!, p_child_ws: childWorkspaceId }),
  );
}

/** Trụ sở rút yêu cầu chưa được trả lời. */
export function useCancelOwnerLinkRequest(workspaceId: string | null) {
  return useLinkMutation(workspaceId, (requestId: string) =>
    supabase.rpc("owner_ws_cancel_link_request", { p_request_id: requestId }),
  );
}

/** Chi nhánh đồng ý / từ chối. */
export function useRespondOwnerLink(workspaceId: string | null) {
  return useLinkMutation(workspaceId, (input: { requestId: string; accept: boolean }) =>
    supabase.rpc("owner_ws_respond_link", { p_request_id: input.requestId, p_accept: input.accept }),
  );
}

/** Trưởng đơn vị của một trong hai bên huỷ liên kết (tham số = Trạm chi nhánh). */
export function useUnlinkOwnerWorkspace(workspaceId: string | null) {
  return useLinkMutation(workspaceId, (childWorkspaceId: string) =>
    supabase.rpc("owner_ws_unlink", { p_child_ws: childWorkspaceId }),
  );
}
