import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { qk } from "@/lib/queryKeys";
import { assertShareRpcOk } from "@/lib/postingShare/status";
import { mapShareLink, type PostingShareLink, type ShareTargetKind } from "@/lib/postingShare/types";
import { assetKey } from "@/lib/shareLinks/assets";
import {
  deviceParam,
  mapShareSeries,
  periodRange,
  type ShareDeviceFilter,
  type SharePeriod,
  type ShareSeries,
} from "@/lib/shareLinks/series";

// Link Hồ sơ online phía chủ tài sản: tổng hợp của Trạm, chi tiết một link, chuỗi theo ngày
// (migration 20261004210000). Mọi đọc qua RPC — mã link chỉ về tay người quản lý được link.

export interface OwnerShareLinks {
  canCreate: boolean;
  links: PostingShareLink[];
}

/** Mọi link của Trạm (menu "Link theo dõi"); `campaignId` ⇒ chỉ link của một chiến dịch. */
export function useOwnerShareLinks(campaignId?: string | null, enabled = true) {
  const { workspaceId } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.shareLinks.workspace(workspaceId, campaignId),
    enabled: enabled && !!workspaceId,
    queryFn: async (): Promise<OwnerShareLinks> => {
      const { data, error } = await supabase.rpc("owner_share_links", {
        p_workspace_id: workspaceId!,
        p_campaign_id: (campaignId ?? null) as string,
      });
      if (error) throw error;
      assertShareRpcOk(data);
      const d = (data ?? {}) as { can_create?: unknown; links?: unknown };
      return {
        canCreate: d.can_create === true,
        links: Array.isArray(d.links) ? d.links.map(mapShareLink) : [],
      };
    },
  });
}

export function useShareLinkDetail(linkId: string | undefined) {
  return useQuery({
    queryKey: qk.shareLinks.detail(linkId),
    enabled: !!linkId,
    queryFn: async (): Promise<PostingShareLink> => {
      const { data, error } = await supabase.rpc("owner_share_link_detail", { p_link_id: linkId! });
      if (error) throw error;
      assertShareRpcOk(data);
      const d = data as { can_manage?: unknown; link?: unknown };
      return { ...mapShareLink(d.link), canManage: d.can_manage === true };
    },
  });
}

export function useShareLinkSeries(linkId: string | undefined, period: SharePeriod, device: ShareDeviceFilter) {
  const { from, to } = periodRange(period);
  const dev = deviceParam(device);
  return useQuery({
    queryKey: qk.shareLinks.series(linkId, from, to, dev),
    enabled: !!linkId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ShareSeries> => {
      const { data, error } = await supabase.rpc("owner_share_link_series", {
        p_link_id: linkId!,
        p_from: from as string,
        p_to: to,
        p_device: dev as string,
      });
      if (error) throw error;
      assertShareRpcOk(data);
      return mapShareSeries(data);
    },
  });
}

export function useCampaignShareSeries(
  campaignId: string | undefined,
  period: SharePeriod,
  device: ShareDeviceFilter,
  enabled = true,
) {
  const { from, to } = periodRange(period);
  const dev = deviceParam(device);
  return useQuery({
    queryKey: qk.shareLinks.campaignSeries(campaignId, from, to, dev),
    enabled: enabled && !!campaignId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ShareSeries> => {
      const { data, error } = await supabase.rpc("owner_mkt_campaign_series", {
        p_campaign_id: campaignId!,
        p_from: from as string,
        p_to: to,
        p_device: dev as string,
      });
      if (error) throw error;
      assertShareRpcOk(data);
      return mapShareSeries(data);
    },
  });
}

// ─── Tài sản tạo link / đưa vào chiến dịch được ──────────────────────────────

export interface ShareableAsset {
  /** "posting:<id>" / "listing:<id>" — khoá chung khi trộn hai loại. */
  key: string;
  kind: ShareTargetKind;
  id: string;
  title: string;
  /** Mã hồ sơ (HS-0001); tin: null. */
  code: string | null;
  /** Trạng thái tin trên sàn (SOLD_RENTED = đã bán); hồ sơ: null. */
  listingStatus: string | null;
  branchId: string | null;
  branchName: string | null;
}

const NO_ASSETS: ShareableAsset[] = [];

/**
 * Hồ sơ số hoá đã duyệt (chưa huỷ) của Trạm + tin trên sàn Trạm đã nhận — khớp luật tạo link
 * (create_share_link) và chọn tài sản chiến dịch (owner_mkt_posting_scope / owner_mkt_listing_scope).
 */
export function useShareableAssets(enabled: boolean) {
  const { workspaceId } = useOwnerWorkspace();
  const branches = useWorkspaceBranchOptions(enabled ? workspaceId : null);
  const raw = useQuery({
    queryKey: qk.shareLinks.assets(workspaceId),
    enabled: enabled && !!workspaceId,
    queryFn: async () => {
      const [claims, postings] = await Promise.all([
        supabase
          .from("asset_owner_claims")
          .select("listing_id, asset_owner_id, listing:listings(title, status)")
          .eq("workspace_id", workspaceId!)
          .in("status", ["auto_claimed", "confirmed"])
          .not("listing_id", "is", null),
        supabase
          .from("asset_postings")
          .select("id, code, title, branch_id")
          .eq("workspace_id", workspaceId!)
          .eq("review_status", "approved")
          .neq("status", "cancelled"),
      ]);
      if (claims.error) throw claims.error;
      if (postings.error) throw postings.error;
      return { claims: claims.data ?? [], postings: postings.data ?? [] };
    },
  });

  const assets = useMemo((): ShareableAsset[] => {
    if (!raw.data) return NO_ASSETS;
    const list = branches.data ?? [];
    const byOwner = new Map(list.flatMap((b) => (b.assetOwnerId ? [[b.assetOwnerId, b] as const] : [])));
    const byId = new Map(list.map((b) => [b.id, b] as const));
    const seen = new Set<string>();
    const listings = raw.data.claims.flatMap((c): ShareableAsset[] => {
      if (!c.listing_id || seen.has(c.listing_id)) return [];
      seen.add(c.listing_id);
      const branch = c.asset_owner_id ? byOwner.get(c.asset_owner_id) : undefined;
      return [
        {
          key: assetKey("listing", c.listing_id),
          kind: "listing",
          id: c.listing_id,
          title: c.listing?.title || "Tài sản",
          code: null,
          listingStatus: c.listing?.status ?? "ACTIVE",
          branchId: branch?.id ?? null,
          branchName: branch?.label ?? null,
        },
      ];
    });
    const postings = raw.data.postings.map(
      (p): ShareableAsset => ({
        key: assetKey("posting", p.id),
        kind: "posting",
        id: p.id,
        title: p.title || "Hồ sơ",
        code: p.code ?? null,
        listingStatus: null,
        branchId: p.branch_id,
        branchName: p.branch_id ? (byId.get(p.branch_id)?.label ?? null) : null,
      }),
    );
    return [...postings, ...listings].sort((a, b) => a.title.localeCompare(b.title, "vi"));
  }, [raw.data, branches.data]);

  return { assets, isLoading: raw.isLoading || branches.isLoading, isError: raw.isError || branches.isError };
}
