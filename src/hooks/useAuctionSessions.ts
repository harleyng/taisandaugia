import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { qk } from "@/lib/queryKeys";
import { sessionErrorMessage } from "@/lib/auctionSessions/errors";
import type { SourceListing } from "@/lib/auctionSessions/snapshot";
import type {
  AuctionSession,
  AuctionSessionWithItems,
  OrgSessionListRow,
  SessionInput,
  SessionItemDraft,
  SessionItemPatch,
} from "@/types/auction-session";

/**
 * Phiên đấu giá trong /portal.
 *
 * Tổ chức hiện tại lấy qua OrgContext (theo MEMBERSHIP), KHÔNG qua usePortalOrg
 * (theo owner_id) — nếu không thì Quản lý / Nhân viên không dùng được. Ranh giới
 * thật là RLS + trigger ở 20260911000003; nút ẩn/hiện chỉ là UI.
 */
export function useSessionOrg() {
  const { currentOrg, loading } = useOrg();
  const isApproved = currentOrg?.kycStatus === "APPROVED";
  const auctionOrgId = (currentOrg?.licenseInfo?.auction_org_id as string | undefined) ?? null;
  return {
    organizationId: currentOrg?.id ?? null,
    // Chưa KYC hoặc chưa liên kết danh bạ thì server cũng không cho công bố / thêm lô.
    auctionOrgId: isApproved ? auctionOrgId : null,
    isApproved,
    loading,
  };
}

export function useOrgAuctionSessions() {
  const { organizationId } = useSessionOrg();
  return useQuery({
    queryKey: qk.auctionSessions.byOrg(organizationId),
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgSessionListRow[]> => {
      const { data, error } = await supabase
        .from("auction_sessions")
        .select("*, auction_session_items(count)")
        .eq("organization_id", organizationId!)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(({ auction_session_items, ...session }) => ({
        ...(session as AuctionSession),
        item_count: auction_session_items?.[0]?.count ?? 0,
      }));
    },
  });
}

export function useAuctionSession(id?: string | null) {
  return useQuery({
    queryKey: qk.auctionSessions.byId(id),
    enabled: !!id,
    queryFn: async (): Promise<AuctionSessionWithItems | null> => {
      const { data, error } = await supabase
        .from("auction_sessions")
        .select("*, auction_session_items(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const items = [...(data.auction_session_items ?? [])].sort((a, b) => a.lot_no - b.lot_no);
      return { ...data, auction_session_items: items } as unknown as AuctionSessionWithItems;
    },
  });
}

/** Tin đấu giá ACTIVE của chính tổ chức — nguồn "tin công khai" cho lô. */
export function useSessionSourceListings(auctionOrgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["session-source-listings", auctionOrgId],
    enabled: enabled && !!auctionOrgId,
    queryFn: async (): Promise<SourceListing[]> => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, price_unit, area, image_url, property_type_slug, address, custom_attributes")
        .eq("auction_org_id", auctionOrgId!)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as SourceListing[];
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Công bố / huỷ đổi thứ trang sàn thấy ⇒ luôn làm mới cả prefix công khai. */
function useInvalidateSessions() {
  const queryClient = useQueryClient();
  const { organizationId } = useSessionOrg();
  return (id?: string | null) => {
    queryClient.invalidateQueries({ queryKey: qk.auctionSessions.byOrg(organizationId) });
    if (id) {
      queryClient.invalidateQueries({ queryKey: qk.auctionSessions.byId(id) });
      // Thêm / sửa / gỡ lô đổi luôn danh sách khách khớp của trang Tiếp thị phiên.
      queryClient.invalidateQueries({ queryKey: qk.sessionAudience.bySession(id) });
    }
    queryClient.invalidateQueries({ queryKey: qk.auctionSessions.public });
  };
}

const showError = (err: unknown) => toast.error(sessionErrorMessage(err));

export function useSaveAuctionSession() {
  const invalidate = useInvalidateSessions();
  const { organizationId } = useSessionOrg();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SessionInput }) => {
      if (id) {
        const { data, error } = await supabase
          .from("auction_sessions")
          .update(input)
          .eq("id", id)
          .select("id")
          .single();
        if (error) throw error;
        return { id: data.id, created: false };
      }
      if (!organizationId) throw new Error("Chưa xác định được tổ chức.");
      const { data, error } = await supabase
        .from("auction_sessions")
        .insert({ ...input, organization_id: organizationId })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, created: true };
    },
    onSuccess: ({ id, created }) => {
      invalidate(id);
      toast.success(created ? "Đã tạo phiên nháp." : "Đã lưu thông tin phiên.");
    },
    onError: showError,
  });
}

export function usePublishAuctionSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("auction_sessions")
        .update({ status: "published" })
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidate(id);
      toast.success("Đã công bố phiên lên sàn.");
    },
    onError: showError,
  });
}

export function useCancelAuctionSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("auction_sessions")
        .update({ status: "cancelled", cancelled_reason: reason.trim() })
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidate(id);
      toast.success("Đã huỷ phiên.");
    },
    onError: showError,
  });
}

export function useDeleteAuctionSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("auction_sessions").delete().eq("id", id).select("id");
      if (error) throw error;
      // RLS chỉ cho xoá nháp: xoá phiên đã công bố trả về 0 dòng chứ không báo lỗi.
      if (!data?.length) throw new Error("Chỉ xoá được phiên nháp. Phiên đã công bố hãy chọn Huỷ phiên.");
      return id;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá phiên nháp.");
    },
    onError: showError,
  });
}

export function useAddSessionItems() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async ({ sessionId, drafts }: { sessionId: string; drafts: SessionItemDraft[] }) => {
      // Chèn TỪNG dòng: số lô do trigger cấp theo max+1, chèn nhiều dòng trong một
      // câu thì thứ tự cấp số không được bảo đảm.
      let added = 0;
      for (const draft of drafts) {
        const { error } = await supabase.from("auction_session_items").insert({ ...draft, session_id: sessionId });
        if (error) {
          if (added > 0) invalidate(sessionId);
          throw error;
        }
        added += 1;
      }
      return { sessionId, added };
    },
    onSuccess: ({ sessionId, added }) => {
      invalidate(sessionId);
      toast.success(`Đã thêm ${added} tài sản vào phiên.`);
    },
    onError: showError,
  });
}

export function useUpdateSessionItem() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async ({ id, sessionId, patch }: { id: string; sessionId: string; patch: SessionItemPatch }) => {
      const { error } = await supabase
        .from("auction_session_items")
        .update(patch)
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw error;
      return sessionId;
    },
    onSuccess: (sessionId) => {
      invalidate(sessionId);
      toast.success("Đã cập nhật tài sản.");
    },
    onError: showError,
  });
}

export function useDeleteSessionItem() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async ({ id, sessionId }: { id: string; sessionId: string }) => {
      const { data, error } = await supabase.from("auction_session_items").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Không gỡ được tài sản này khỏi phiên.");
      return sessionId;
    },
    onSuccess: (sessionId) => {
      invalidate(sessionId);
      toast.success("Đã gỡ tài sản khỏi phiên.");
    },
    onError: showError,
  });
}
