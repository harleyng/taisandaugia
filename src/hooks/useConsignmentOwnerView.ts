import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export interface OrgTrackRecord {
  /** Tài sản tổ chức đã đưa ra đấu giá trên sàn (tin ACTIVE / SOLD_RENTED). */
  total: number;
  successful: number;
}

/**
 * Thành tích của các tổ chức — cùng luật với tab "Tài sản" ở trang tổ chức công
 * khai, để con số ở đây khớp con số người dùng bấm sang xem.
 */
export function useOrgTrackRecords(orgIds: readonly string[]) {
  const ids = [...new Set(orgIds)].filter(Boolean);
  return useQuery({
    queryKey: qk.consignment.orgTrackRecords(ids),
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Map<string, OrgTrackRecord>> => {
      const { data, error } = await supabase.rpc("auction_org_track_records", { _org_ids: ids });
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.auction_org_id, { total: r.total, successful: r.successful }]));
    },
  });
}

/** "312 phiên · 94% thành công" — null khi tổ chức chưa có tin nào trên sàn. */
export function trackRecordLabel(r: OrgTrackRecord | undefined): string | null {
  if (!r || r.total === 0) return null;
  return `${r.total.toLocaleString("en-US")} phiên · ${Math.round((r.successful / r.total) * 100)}% thành công`;
}

/**
 * Tên chuyên viên sàn phụ trách yêu cầu "nhờ sàn" — chỉ có sau khi admin gửi hồ
 * sơ đi (assigned_admin_id). Chủ tài sản không đọc được profiles của admin nên
 * đi qua RPC, chỉ trả tên.
 */
export function useBrokerAssignee(postingId: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.consignment.brokerAssignee(postingId),
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("owner_broker_assignee", { _posting_id: postingId });
      if (error) throw error;
      return data ?? null;
    },
  });
}
