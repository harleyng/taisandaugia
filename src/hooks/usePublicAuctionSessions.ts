import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import type { PublicSessionDetail, PublicSessionSummary } from "@/types/auction-session";

/**
 * Phiên đấu giá trên sàn công khai.
 *
 * LUÔN tự lọc status: RLS cho thành viên tổ chức đọc cả phiên NHÁP của mình, nên
 * nếu dựa vào "người xem là khách" thì nhân viên tổ chức sẽ thấy nháp trên trang
 * sàn. Cột liệt kê bằng tay, không lấy organization_id / created_by.
 *
 * BẪY: PublicSession = Omit<AuctionSession, organization_id|created_by|created_at|
 * updated_at> nên MỌI cột khác đều được KHAI là có, kể cả cột quên không select.
 * Thiếu một cột ở đây là `undefined` lúc chạy mà typecheck vẫn xanh — đúng cách
 * max_bid_steps hỏng ở Bước 4 và finalized_at suýt hỏng ở Bước 6. Thêm cột vào
 * bảng là phải thêm vào CẢ BA chuỗi select dưới đây.
 */

export function usePublicAuctionSessions(includeEnded: boolean) {
  return useQuery({
    queryKey: qk.auctionSessions.publicList(includeEnded),
    staleTime: 60_000,
    queryFn: async (): Promise<PublicSessionSummary[]> => {
      let query = supabase
        .from("auction_sessions")
        .select(
          "id, code, title, description, auction_format, venue, province, registration_start_at, registration_end_at, viewing_start_at, viewing_end_at, starts_at, ends_at, max_registrants, dossier_fee, status, bidding_method, extension_seconds, max_bid_steps, finalized_at, published_at, cancelled_reason, auction_org_id, auction_organizations(id, name, logo_url), auction_session_items(id, starting_price, image_url, category_slug)",
        )
        .eq("status", "published");
      if (!includeEnded) query = query.gte("ends_at", new Date().toISOString());
      const { data, error } = await query.order("starts_at", { ascending: true }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as PublicSessionSummary[];
    },
  });
}

export function usePublicAuctionSession(id?: string) {
  return useQuery({
    queryKey: qk.auctionSessions.publicById(id),
    enabled: !!id,
    queryFn: async (): Promise<PublicSessionDetail | null> => {
      const { data, error } = await supabase
        .from("auction_sessions")
        .select(
          "id, code, title, description, auction_format, venue, province, registration_start_at, registration_end_at, viewing_start_at, viewing_end_at, starts_at, ends_at, max_registrants, dossier_fee, status, bidding_method, extension_seconds, max_bid_steps, finalized_at, published_at, cancelled_reason, auction_org_id, auction_organizations(id, name, logo_url), auction_session_items(*)",
        )
        .eq("id", id!)
        .in("status", ["published", "cancelled"])
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const detail = data as unknown as PublicSessionDetail;
      return {
        ...detail,
        auction_session_items: [...(detail.auction_session_items ?? [])].sort((a, b) => a.lot_no - b.lot_no),
      };
    },
  });
}

/** Phiên đã công bố của một tổ chức — tab trên trang /auction-org/:id. */
export function usePublicOrgSessions(auctionOrgId?: string) {
  return useQuery({
    queryKey: qk.auctionSessions.publicByAuctionOrg(auctionOrgId),
    enabled: !!auctionOrgId,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicSessionSummary[]> => {
      const { data, error } = await supabase
        .from("auction_sessions")
        .select(
          "id, code, title, description, auction_format, venue, province, registration_start_at, registration_end_at, viewing_start_at, viewing_end_at, starts_at, ends_at, max_registrants, dossier_fee, status, bidding_method, extension_seconds, max_bid_steps, finalized_at, published_at, cancelled_reason, auction_org_id, auction_organizations(id, name, logo_url), auction_session_items(id, starting_price, image_url, category_slug)",
        )
        .eq("auction_org_id", auctionOrgId!)
        .eq("status", "published")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PublicSessionSummary[];
    },
  });
}
