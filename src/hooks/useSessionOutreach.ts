import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useOrg } from "@/contexts/OrgContext";
import { qk } from "@/lib/queryKeys";
import { NOTICE_TEMPLATE_VERSION } from "@/lib/outreach/noticeTemplate";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import type { CaseFile, ConsignmentSource, ListingSource } from "@/lib/outreach/caseFile";
import type { OutreachOrg } from "@/lib/outreach/outreachInput";
import type { DirectMethod } from "@/lib/outreach/directMessage";
import type {
  ContactOutreachHistoryRow,
  OutreachEdit,
  OutreachField,
  OutreachPack,
  OutreachPackState,
  OutreachSend,
  OutreachSendChannel,
} from "@/types/outreach";

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

export function useOutreachEdits(sessionId: string | undefined, packId: string | null) {
  return useQuery({
    queryKey: qk.sessionOutreach.edits(sessionId),
    enabled: !!packId,
    queryFn: async (): Promise<OutreachEdit[]> => {
      const { data, error } = await supabase
        .from("session_outreach_edits")
        .select("*")
        .eq("pack_id", packId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as OutreachEdit[];
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

/** Nguồn điền sẵn hồ sơ vụ việc: tin đăng + hồ sơ ký gửi đã trúng của các lô. */
export async function fetchPrefillSources(
  listingIds: string[],
  auctionOrgId: string | null,
  needConsignments: boolean,
): Promise<{ listings: ListingSource[]; consignments: ConsignmentSource[] }> {
  const listings: ListingSource[] = [];
  if (listingIds.length) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, description, legal_status, image_url")
      .in("id", listingIds);
    if (error) throw error;
    listings.push(...((data ?? []) as ListingSource[]));
  }
  let consignments: ConsignmentSource[] = [];
  if (needConsignments && auctionOrgId) {
    const { data, error } = await supabase.rpc("org_service_requests", { _auction_org_id: auctionOrgId });
    if (error) throw error;
    consignments = (data ?? []) as unknown as ConsignmentSource[];
  }
  return { listings, consignments };
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
  return () => queryClient.invalidateQueries({ queryKey: qk.sessionOutreach.bySession(sessionId) });
}

export function useApplyGeneration(sessionId: string | undefined) {
  const invalidate = useInvalidateOutreach(sessionId);
  return useMutation({
    mutationFn: async (v: { packId: string; fields: Record<string, string>; label: string; signature: string; overwriteKeys?: string[] }) => {
      const { data, error } = await supabase.rpc("outreach_apply_generation", {
        _pack_id: v.packId,
        _fields: v.fields as unknown as Json,
        _generator_label: v.label,
        _input_signature: v.signature,
        _overwrite_keys: v.overwriteKeys ?? [],
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (changed) => {
      invalidate();
      toast.success(
        changed > 0
          ? `Đã soạn / cập nhật ${changed} trường. Trường đã sửa tay được giữ nguyên.`
          : "Bản nháp đã mới nhất — không có trường nào thay đổi.",
      );
    },
    onError: showError,
  });
}

export function useEditOutreachField(sessionId: string | undefined) {
  const invalidate = useInvalidateOutreach(sessionId);
  return useMutation({
    mutationFn: async (v: { packId: string; key: string; value: string }) => {
      const { data, error } = await supabase.rpc("outreach_edit_field", {
        _pack_id: v.packId,
        _key: v.key,
        _value: v.value,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useResetOutreachField(sessionId: string | undefined) {
  const invalidate = useInvalidateOutreach(sessionId);
  return useMutation({
    mutationFn: async (v: { packId: string; key: string }) => {
      const { error } = await supabase.rpc("outreach_reset_field", { _pack_id: v.packId, _key: v.key });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã dùng bản của trình soạn.");
    },
    onError: showError,
  });
}

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

export function useMarkChannelSent(sessionId: string | undefined) {
  const invalidate = useInvalidateOutreach(sessionId);
  return useMutation({
    mutationFn: async (v: { packId: string; channel: OutreachSendChannel; text: string; note?: string }) => {
      const { error } = await supabase.rpc("outreach_mark_sent", {
        _pack_id: v.packId,
        _channel: v.channel,
        _text: v.text,
        _note: v.note ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã ghi nhận đăng tin.");
    },
    onError: showError,
  });
}

export interface ContactSendInput {
  contact_id: string;
  method: DirectMethod;
  segment_key: string;
  text: string;
}

export function useMarkContacted(sessionId: string | undefined) {
  const invalidate = useInvalidateOutreach(sessionId);
  const queryClient = useQueryClient();
  const { currentOrgId } = useOrg();
  return useMutation({
    mutationFn: async (v: { packId: string; contacts: ContactSendInput[]; note?: string }) => {
      const { data, error } = await supabase.rpc("outreach_mark_sent", {
        _pack_id: v.packId,
        // Nhánh liên hệ từng khách không dùng _channel.
        _channel: "",
        _text: "",
        _contacts: v.contacts as unknown as Json,
        _note: v.note ?? "",
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: qk.orgContacts.byOrg(currentOrgId) });
      toast.success(`Đã ghi nhận liên hệ ${n} khách.`);
    },
    onError: showError,
  });
}
