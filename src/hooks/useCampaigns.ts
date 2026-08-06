import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSpec } from "@/lib/marketing/audienceCriteria";
import type {
  AudienceSpec,
  Campaign,
  CampaignRecipient,
  CampaignRecipientWithCampaign,
  ResolvedAudienceRow,
} from "@/types/marketing";
import { qk } from "@/lib/queryKeys";

// Tables/RPCs are not yet in the generated types (migration pending push), so we
// access them through an untyped client cast — same convention as useArticles.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const campaignsTable = () => (supabase as any).from("marketing_campaigns");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recipientsTable = () => (supabase as any).from("campaign_recipients");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

function hydrate(row: Campaign): Campaign {
  return { ...row, audience_spec: normalizeSpec(row.audience_spec) };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useAdminCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ["marketing_campaigns"],
    queryFn: async () => {
      const { data, error } = await campaignsTable()
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Campaign[]).map(hydrate);
    },
  });
}

export function useCampaign(id?: string) {
  return useQuery<Campaign>({
    queryKey: ["marketing_campaign", id],
    queryFn: async () => {
      const { data, error } = await campaignsTable().select("*").eq("id", id).single();
      if (error) throw error;
      return hydrate(data as Campaign);
    },
    enabled: !!id,
  });
}

export function useCampaignRecipients(campaignId?: string) {
  return useQuery<CampaignRecipient[]>({
    queryKey: qk.campaignRecipients.byCampaign(campaignId),
    queryFn: async () => {
      const { data, error } = await recipientsTable()
        .select("*")
        .eq("campaign_id", campaignId)
        .order("email");
      if (error) throw error;
      return data as CampaignRecipient[];
    },
    enabled: !!campaignId,
  });
}

/** Chiến dịch email đã gửi tới TÀI KHOẢN gắn với một khách hàng CRM.
 *  customers.user_id là cầu nối duy nhất — khách chưa gắn tài khoản thì không
 *  có gì để hiện (hook tự tắt). Đi index idx_campaign_recipients_user. */
export function useUserCampaignRecipients(userId?: string | null) {
  return useQuery<CampaignRecipientWithCampaign[]>({
    queryKey: qk.campaignRecipients.byUser(userId),
    queryFn: async () => {
      const { data, error } = await recipientsTable()
        .select(
          "*, campaign:marketing_campaigns(id,name,status,subject,channel,sent_at,scheduled_at)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CampaignRecipientWithCampaign[];
    },
    enabled: !!userId,
  });
}

// ─── Audience RPCs (plain async helpers, not hooks) ──────────────────────────

export async function fetchAudienceCount(
  spec: AudienceSpec,
  respectOptin = true,
): Promise<number> {
  const { data, error } = await rpc("count_campaign_audience", {
    _spec: spec,
    _respect_optin: respectOptin,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function resolveAudience(
  spec: AudienceSpec,
  respectOptin = true,
  limit: number | null = null,
  offset = 0,
): Promise<ResolvedAudienceRow[]> {
  const { data, error } = await rpc("resolve_campaign_audience", {
    _spec: spec,
    _respect_optin: respectOptin,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as ResolvedAudienceRow[];
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export interface CampaignUpsert {
  id?: string;
  name: string;
  notes: string | null;
  subject: string | null;
  preview_text: string | null;
  content_html: string | null;
  audience_spec: AudienceSpec;
  schedule_type: string;
  scheduled_at: string | null;
  respect_optin?: boolean;
  status?: string;
}

export function useUpsertCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: CampaignUpsert) => {
      if (id) {
        const { data, error } = await campaignsTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Campaign;
      }
      const { data, error } = await campaignsTable().insert(payload).select().single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: (data: Campaign) => {
      qc.invalidateQueries({ queryKey: ["marketing_campaigns"] });
      qc.invalidateQueries({ queryKey: ["marketing_campaign", data.id] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await campaignsTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing_campaigns"] }),
  });
}

export function useEndCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await campaignsTable().update({ status: "ended" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_res, id: string) => {
      qc.invalidateQueries({ queryKey: ["marketing_campaigns"] });
      qc.invalidateQueries({ queryKey: ["marketing_campaign", id] });
    },
  });
}

export class EmptyAudienceError extends Error {
  constructor() {
    super("EMPTY_AUDIENCE");
    this.name = "EmptyAudienceError";
  }
}

/**
 * Stubbed send: resolve the audience, snapshot recipients into campaign_recipients,
 * and transition status. No real email provider is called — a future send-campaign
 * edge function will consume exactly this recipient snapshot.
 */
export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaign: Campaign) => {
      const rows = await resolveAudience(campaign.audience_spec, true, null, 0);
      if (rows.length === 0) throw new EmptyAudienceError();

      // Idempotent re-snapshot.
      await recipientsTable().delete().eq("campaign_id", campaign.id);

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r) => ({
          campaign_id: campaign.id,
          user_id: r.user_id,
          email: r.email,
          name: r.name,
          status: "pending",
        }));
        const { error } = await recipientsTable().insert(chunk);
        if (error) throw error;
      }

      const isScheduled =
        campaign.schedule_type === "scheduled" &&
        !!campaign.scheduled_at &&
        new Date(campaign.scheduled_at).getTime() > Date.now();

      const update = {
        status: isScheduled ? "scheduled" : "sent",
        recipient_count: rows.length,
        eligible_count: rows.length,
        sent_at: isScheduled ? null : new Date().toISOString(),
      };
      const { error } = await campaignsTable().update(update).eq("id", campaign.id);
      if (error) throw error;

      return { count: rows.length, scheduled: isScheduled };
    },
    onSuccess: (_res, campaign: Campaign) => {
      qc.invalidateQueries({ queryKey: ["marketing_campaigns"] });
      qc.invalidateQueries({ queryKey: ["marketing_campaign", campaign.id] });
      qc.invalidateQueries({ queryKey: qk.campaignRecipients.all });
    },
  });
}
