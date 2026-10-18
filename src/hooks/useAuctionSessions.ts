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
      // Lô chỉ lấy 2 cột (tổng giá + tìm theo tên); hồ sơ chỉ đếm dòng 'paid' = đã bán.
      const { data, error } = await supabase
        .from("auction_sessions")
        .select("*, auction_session_items(title, starting_price), sold:auction_bidding_contracts(count)")
        .eq("organization_id", organizationId!)
        .eq("sold.status", "paid")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(({ auction_session_items: items, sold, ...session }) => ({
        ...(session as AuctionSession),
        item_count: items?.length ?? 0,
        total_starting_price: (items ?? []).reduce((sum, i) => sum + Number(i.starting_price ?? 0), 0),
        item_titles: (items ?? []).map((i) => i.title),
        sold_count: sold?.[0]?.count ?? 0,
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

/**
 * Lưu form tạo / sửa phiên (trang /moi và /:id/sua) — thông tin + quy tắc trả giá
 * trong MỘT nút Lưu, nhưng quy tắc vẫn là câu UPDATE riêng: trigger
 * auction_sessions_bidding_guard từ chối ba cột đó khi lô đầu tiên đã mở, gộp
 * chung một câu thì sửa tên phiên giữa chừng cũng hỏng. `rules` = null ⇒ không đụng.
 */
export function useSaveSessionForm() {
  const invalidate = useInvalidateSessions();
  const { organizationId } = useSessionOrg();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      rules,
    }: {
      id?: string;
      input: SessionInput;
      rules: SessionBiddingRules | null;
    }) => {
      if (!id) {
        if (!organizationId) throw new Error("Chưa xác định được tổ chức.");
        const { data, error } = await supabase
          .from("auction_sessions")
          .insert({ ...input, ...(rules ?? {}), organization_id: organizationId })
          .select("id")
          .single();
        if (error) throw error;
        return { id: data.id, created: true };
      }
      const { error } = await supabase.from("auction_sessions").update(input).eq("id", id).select("id").single();
      if (error) throw error;
      if (rules) {
        const { error: rulesError } = await supabase.from("auction_sessions").update(rules).eq("id", id);
        if (rulesError) throw rulesError;
      }
      return { id, created: false };
    },
    onSuccess: ({ id, created }) => {
      invalidate(id);
      toast.success(created ? "Đã tạo phiên nháp." : "Đã lưu thay đổi.");
    },
    // Lỗi giữa chừng (thông tin đã lưu, quy tắc bị từ chối) vẫn phải làm mới bản đọc.
    onError: (err, { id }) => {
      if (id) invalidate(id);
      showError(err);
    },
  });
}

/** Ba cột quy tắc trả giá trực tuyến — lưu bằng câu UPDATE riêng, xem useSaveSessionForm. */
export interface SessionBiddingRules {
  bidding_method: string;
  extension_seconds: number;
  max_bid_steps: number;
}

/**
 * Phiên đã có lô nào rời trạng thái chờ chưa. Dùng để khoá form quy tắc TRƯỚC
 * khi người dùng gõ — trigger sẽ từ chối, nhưng bắt người ta điền xong mới báo
 * là sai thứ tự. Hàm SQL được GRANT cho anon + authenticated đúng vì việc này.
 */
export function useSessionBiddingStarted(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.bidding.started(sessionId),
    enabled: !!sessionId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("auction_session_bidding_started", {
        _session_id: sessionId!,
      });
      if (error) throw error;
      return data === true;
    },
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
