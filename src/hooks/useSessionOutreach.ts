import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useOrg } from "@/contexts/OrgContext";
import { qk } from "@/lib/queryKeys";
import { NOTICE_TEMPLATE_VERSION } from "@/lib/outreach/noticeTemplate";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import type { CaseFile } from "@/lib/outreach/caseFile";
import type { OutreachOrg } from "@/lib/outreach/outreachInput";
import type { ContactOutreachHistoryRow, OutreachField, OutreachPack, OutreachPackState, OutreachSend } from "@/types/outreach";

/**
 * Gói tiếp thị của một phiên. MỌI thao tác ghi đi qua RPC outreach_* — ba bảng
 * fields / edits / sends không có policy ghi, nên không có đường nào lách nhật ký.
 */

const showError = (err: unknown) => toast.error(orgContactErrorMessage(err));

/** Lấy (tạo nếu được phép) gói + các trường. Tạo gói là idempotent. */
export function useOutreachPack(sessionId: string | undefined) {
  return useQuery({
    queryKey: qk.sessionOutreach.bySession(sessionId),
    enabled: !!sessionId,
    queryFn: async (): Promise<OutreachPackState> => {
      const { data: packId, error } = await supabase.rpc("outreach_ensure_pack", {
        _session_id: sessionId!,
        _template_version: NOTICE_TEMPLATE_VERSION,
      });
      if (error) throw error;
      if (!packId) return { pack: null, fields: [] };
      const [packRes, fieldsRes] = await Promise.all([
        supabase.from("session_outreach_packs").select("*").eq("id", packId).single(),
        supabase.from("session_outreach_fields").select("*").eq("pack_id", packId),
      ]);
      if (packRes.error) throw packRes.error;
      if (fieldsRes.error) throw fieldsRes.error;
      return { pack: packRes.data as OutreachPack, fields: (fieldsRes.data ?? []) as OutreachField[] };
    },
  });
}

export function useOutreachSends(sessionId: string | undefined, packId: string | null) {
  return useQuery({
    queryKey: qk.sessionOutreach.sends(sessionId),
    enabled: !!packId,
    queryFn: async (): Promise<OutreachSend[]> => {
      const { data, error } = await supabase
        .from("session_outreach_sends")
        .select("*")
        .eq("pack_id", packId!)
        .order("marked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutreachSend[];
    },
  });
}

/** Tên / địa chỉ / điện thoại tổ chức — dữ kiện của thông báo và chữ ký bài đăng. */
export function useOutreachOrgInfo(auctionOrgId: string | null) {
  const { currentOrg } = useOrg();
  return useQuery({
    queryKey: qk.outreachOrgInfo(auctionOrgId),
    queryFn: async (): Promise<OutreachOrg> => {
      if (auctionOrgId) {
        const { data, error } = await supabase
          .from("auction_organizations")
          .select("name, address, phone")
          .eq("id", auctionOrgId)
          .maybeSingle();
        if (error) throw error;
        if (data) return { name: data.name, address: data.address, phone: data.phone };
      }
      return { name: currentOrg?.name ?? "Tổ chức đấu giá", address: null, phone: null };
    },
  });
}

export function useContactOutreachHistory(contactId: string | undefined) {
  const { currentOrgId } = useOrg();
  return useQuery({
    queryKey: qk.orgContacts.outreach(currentOrgId, contactId),
    enabled: !!contactId,
    queryFn: async (): Promise<ContactOutreachHistoryRow[]> => {
      const { data, error } = await supabase
        .from("session_outreach_sends")
        .select("*, session_outreach_packs(session_id, auction_sessions(code, title))")
        .eq("contact_id", contactId!)
        .order("marked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContactOutreachHistoryRow[];
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

function useInvalidateOutreach(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  // exact: chỉ làm mới gói (case_file / câu chào), không kéo lại kênh / nhóm / thành viên.
  return () => queryClient.invalidateQueries({ queryKey: qk.sessionOutreach.bySession(sessionId), exact: true });
}

/** Lưu hồ sơ vụ việc (trình soạn tự lưu — không toast khi thành công). */
export function useSaveCaseFile(sessionId: string | undefined) {
  const invalidate = useInvalidateOutreach(sessionId);
  return useMutation({
    mutationFn: async (v: { packId: string; caseFile: CaseFile }) => {
      const { data, error } = await supabase.rpc("outreach_save_case_file", {
        _pack_id: v.packId,
        _case_file: v.caseFile as unknown as Json,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: invalidate,
    onError: showError,
  });
}


