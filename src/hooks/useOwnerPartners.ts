import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { partnerScopeKey, type OwnerPartner } from "@/lib/dossier/partners";
import type { DossierKind } from "@/lib/dossier/types";

// Danh bạ đối tác riêng (owner_partners). Phạm vi = một Trạm (workspaceId) hoặc chủ cá
// nhân (null ⇒ người đang đăng nhập). RLS: thành viên Trạm đọc, quyền so-hoa:update thêm.

/** Mọi đối tác (cả 3 loại) của một phạm vi — ô chọn lọc theo loại ở client. */
export function useOwnerPartners(workspaceId: string | null) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.ownerPartners.list(partnerScopeKey(workspaceId)),
    enabled: !!userId,
    queryFn: async (): Promise<OwnerPartner[]> => {
      const base = supabase
        .from("owner_partners")
        .select("id,workspace_id,user_id,kind,name,auction_org_id,created_at")
        .order("name");
      const { data, error } = await (workspaceId
        ? base.eq("workspace_id", workspaceId)
        : base.is("workspace_id", null).eq("user_id", userId as string));
      if (error) throw error;
      return (data ?? []) as OwnerPartner[];
    },
    staleTime: 60_000,
  });
}

export interface EnsurePartnerArgs {
  kind: DossierKind;
  /** Tên tự nhập; bỏ qua khi có auctionOrgId (tên lấy theo danh bạ). */
  name?: string;
  auctionOrgId?: string | null;
}

/**
 * Tìm-hoặc-tạo đối tác (RPC owner_partner_ensure): trùng tên / trùng tổ chức trong danh bạ
 * thì trả dòng sẵn có thay vì tạo trùng.
 */
export function useEnsureOwnerPartner(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, name, auctionOrgId }: EnsurePartnerArgs): Promise<OwnerPartner> => {
      const { data, error } = await supabase.rpc("owner_partner_ensure", {
        p_workspace_id: workspaceId,
        p_kind: kind,
        p_name: name ?? "",
        ...(auctionOrgId ? { p_auction_org_id: auctionOrgId } : {}),
      });
      if (error) throw error;
      return data as unknown as OwnerPartner;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.ownerPartners.list(partnerScopeKey(workspaceId)) }),
    onError: (err) =>
      toast.error(`Không thêm được đối tác: ${err instanceof Error ? err.message : "lỗi không xác định"}`),
  });
}
