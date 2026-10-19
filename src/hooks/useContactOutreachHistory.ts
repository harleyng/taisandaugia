import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { qk } from "@/lib/queryKeys";

/**
 * Một lần tổ chức liên hệ khách khi tiếp thị phiên. Bảng `session_outreach_sends`
 * thuộc Sàn đấu giá trực tuyến — đây là chỗ đọc DUY NHẤT của INFO (read contract,
 * docs/platform-ownership.md §3); danh bạ khách vẫn ở cổng tổ chức bên này.
 */
export interface ContactOutreachHistoryRow {
  id: string;
  contact_method: string | null;
  marked_at: string;
  text_snapshot: string;
  session_outreach_packs: {
    session_id: string;
    auction_sessions: { code: string | null; title: string } | null;
  } | null;
}

export const CONTACT_METHOD_LABELS: Record<string, string> = {
  zalo: "Zalo",
  sms: "SMS",
  call: "Gọi điện",
  email: "Email",
};

export function useContactOutreachHistory(contactId: string | undefined) {
  const { currentOrgId } = useOrg();
  return useQuery({
    queryKey: qk.orgContacts.outreach(currentOrgId, contactId),
    enabled: !!contactId,
    queryFn: async (): Promise<ContactOutreachHistoryRow[]> => {
      const { data, error } = await supabase
        .from("session_outreach_sends")
        .select("id, contact_method, marked_at, text_snapshot, session_outreach_packs(session_id, auction_sessions(code, title))")
        .eq("contact_id", contactId!)
        .order("marked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContactOutreachHistoryRow[];
    },
  });
}
