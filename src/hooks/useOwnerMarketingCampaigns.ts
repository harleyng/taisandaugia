import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { qk } from "@/lib/queryKeys";
import { splitAssetKeys } from "@/lib/shareLinks/assets";
import {
  CAMPAIGN_CHANNEL_META,
  campaignErrorMessage,
  draftsPayload,
  mapCampaignRow,
  parseFacts,
  unwrapRpc,
  type CampaignChannel,
  type CampaignDbRow,
  type CampaignDrafts,
  type CampaignRow,
  type FactsSnapshot,
} from "@/lib/ownerMarketing/campaigns";

// Chiến dịch truyền thông của Trạm (Phase M2, migration 20261002100000; tài sản gồm cả hồ sơ
// số hoá từ 20261004210200). Đọc thẳng bảng (RLS: thành viên đọc); MỌI ghi qua RPC owner_mkt_*
// trả {ok, reason}. Link của chiến dịch đọc qua useOwnerShareLinks(campaignId).

const CAMPAIGN_COLUMNS =
  "id, workspace_id, name, notes, listing_ids, posting_ids, channels, status, facts_snapshot, drafts, branch_id, sent_channels, created_by, submitted_by, submitted_at, approved_by, approved_at, rejected_by, rejected_at, rejected_reason, sent_at, created_at, updated_at, branch:workspace_branches(display_name, asset_owner:asset_owners(name))";

const NO_CAMPAIGNS: CampaignRow[] = [];

export function useOwnerCampaigns() {
  const { workspaceId } = useOwnerWorkspace();
  const query = useQuery({
    queryKey: qk.ownerMarketing.campaigns(workspaceId),
    enabled: !!workspaceId,
    queryFn: async (): Promise<CampaignRow[]> => {
      const { data, error } = await supabase
        .from("owner_mkt_campaigns")
        .select(CAMPAIGN_COLUMNS)
        .eq("workspace_id", workspaceId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapCampaignRow(r as CampaignDbRow));
    },
  });
  return { ...query, rows: query.data ?? NO_CAMPAIGNS };
}

export function useOwnerCampaign(id: string | undefined) {
  const { workspaceId } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.ownerMarketing.campaign(workspaceId, id),
    enabled: !!workspaceId && !!id,
    queryFn: async (): Promise<CampaignRow | null> => {
      const { data, error } = await supabase
        .from("owner_mkt_campaigns")
        .select(CAMPAIGN_COLUMNS)
        .eq("id", id!)
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCampaignRow(data as CampaignDbRow) : null;
    },
  });
}

export interface CampaignAuditEntry {
  id: number;
  action: string;
  actor: string | null;
  note: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export function useCampaignAudit(id: string | undefined) {
  const { workspaceId } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.ownerMarketing.campaignAudit(workspaceId, id),
    enabled: !!workspaceId && !!id,
    queryFn: async (): Promise<CampaignAuditEntry[]> => {
      const { data, error } = await supabase
        .from("owner_mkt_audit")
        .select("id, action, actor, note, detail, created_at")
        .eq("campaign_id", id!)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        action: r.action,
        actor: r.actor,
        note: r.note,
        detail: (r.detail && typeof r.detail === "object" ? r.detail : {}) as Record<string, unknown>,
        createdAt: r.created_at,
      }));
    },
  });
}

/** Dữ kiện hiện tại (server dựng) của các tài sản đang chọn ("listing:id" / "posting:id"). */
export function useCampaignFactsPreview(assetKeys: readonly string[], enabled = true) {
  const { workspaceId } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.ownerMarketing.campaignFacts(workspaceId, assetKeys),
    enabled: enabled && !!workspaceId && assetKeys.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<FactsSnapshot> => {
      const { listingIds, postingIds } = splitAssetKeys(assetKeys);
      const { data, error } = await supabase.rpc("owner_mkt_preview_facts", {
        p_workspace_id: workspaceId!,
        p_listing_ids: listingIds,
        p_posting_ids: postingIds,
      });
      if (error) throw error;
      return parseFacts(unwrapRpc<{ facts: unknown }>(data).facts);
    },
  });
}

// ─── Ghi (RPC) ───────────────────────────────────────────────────────────────

function useInvalidateCampaigns() {
  const { workspaceId } = useOwnerWorkspace();
  const queryClient = useQueryClient();
  return (alsoLinks = false) => {
    void queryClient.invalidateQueries({ queryKey: qk.ownerMarketing.campaigns(workspaceId) });
    if (alsoLinks) void queryClient.invalidateQueries({ queryKey: qk.shareLinks.all });
  };
}

const fail = (title: string) => (err: unknown) => toast.error(title, { description: campaignErrorMessage(err) });

export interface SaveCampaignInput {
  id: string | null;
  name: string;
  notes: string;
  /** "listing:id" / "posting:id". */
  assetKeys: string[];
  channels: CampaignChannel[];
  drafts: CampaignDrafts;
}

export function useSaveCampaignDraft() {
  const { workspaceId } = useOwnerWorkspace();
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async (input: SaveCampaignInput) => {
      const { listingIds, postingIds } = splitAssetKeys(input.assetKeys);
      const { data, error } = await supabase.rpc("owner_mkt_save_draft", {
        // NULL = tạo mới (kiểu sinh tự động không biết tham số nhận NULL).
        p_campaign_id: input.id as string,
        p_workspace_id: workspaceId!,
        p_name: input.name.trim(),
        p_notes: input.notes.trim() || (null as unknown as string),
        p_listing_ids: listingIds,
        p_posting_ids: postingIds,
        p_channels: input.channels,
        p_drafts: draftsPayload(input.drafts, input.channels),
      });
      if (error) throw error;
      return unwrapRpc<{ id: string }>(data).id;
    },
    onSuccess: () => invalidate(),
    onError: fail("Không lưu được chiến dịch"),
  });
}

export function useSubmitCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("owner_mkt_submit", { p_campaign_id: id });
      if (error) throw error;
      unwrapRpc(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã gửi duyệt", { description: "Người có quyền duyệt sẽ thấy chiến dịch ở tab “Chờ duyệt”." });
    },
    onError: fail("Không gửi duyệt được"),
  });
}

export function useApproveCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { data, error } = await supabase.rpc("owner_mkt_approve", {
        p_campaign_id: id,
        p_note: note.trim() || (null as unknown as string),
      });
      if (error) throw error;
      return unwrapRpc<{ links: number }>(data).links;
    },
    onSuccess: (links) => {
      invalidate(true);
      toast.success("Đã duyệt chiến dịch", { description: `Đã tạo ${links} link Hồ sơ online — nội dung sẵn sàng để xuất.` });
    },
    onError: fail("Không duyệt được"),
  });
}

export function useRejectCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc("owner_mkt_reject", { p_campaign_id: id, p_reason: reason.trim() });
      if (error) throw error;
      unwrapRpc(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã trả lại chiến dịch kèm lý do");
    },
    onError: fail("Không từ chối được"),
  });
}

export function useMarkCampaignSent() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async ({ id, channel, note }: { id: string; channel: CampaignChannel; note: string }) => {
      const { data, error } = await supabase.rpc("owner_mkt_mark_sent", {
        p_campaign_id: id,
        p_channel: channel,
        p_note: note.trim() || (null as unknown as string),
      });
      if (error) throw error;
      unwrapRpc(data);
      return channel;
    },
    onSuccess: (channel) => {
      invalidate();
      toast.success(`Đã ghi nhận gửi qua ${CAMPAIGN_CHANNEL_META[channel].label}`);
    },
    onError: fail("Không đánh dấu được"),
  });
}

/** Ghi nhật ký xuất tư liệu. Lỗi không chặn việc tải — chỉ mất một dòng nhật ký. */
export function useLogCampaignExport() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "kit" | "flyer" }) => {
      const { data, error } = await supabase.rpc("owner_mkt_log_export", { p_campaign_id: id, p_kind: kind });
      if (error) throw error;
      unwrapRpc(data);
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("owner_mkt_delete", { p_campaign_id: id });
      if (error) throw error;
      unwrapRpc(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá bản nháp");
    },
    onError: fail("Không xoá được"),
  });
}
