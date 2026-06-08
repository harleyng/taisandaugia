/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AssetOwnerWorkspace, AssetOwnerClaim } from "@/types/asset-owner";

export interface Candidate {
  id: string;
  name: string;
  listingCount: number;
}

function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/g, " ").trim();
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wa = new Set(na.split(/\s+/));
  const wb = nb.split(/\s+/);
  const overlap = wb.filter((w) => wa.has(w)).length;
  return overlap / Math.max(wa.size, wb.length);
}

function isAmc(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("amc") || n.includes("quản lý nợ") || n.includes("khai thác tài sản") || n.includes("quản lý tài sản");
}

/** Extract a short brand keyword from a full org name */
function extractKeyword(fullName: string): string {
  // Try to find the brand inside parentheses or after known prefixes
  const match = fullName.match(/\b([A-Z][A-Za-z]+bank|[A-Z][A-Za-z]+Bank|BIDV|VCB|MBBank|TPBank|VPBank|Vietcombank|Agribank|Sacombank|Techcombank|ACB|SHB|SCB|HDBank|OCB|LPBank|VIB|MSB|SeABank|Eximbank|BacABank|KienlongBank|NamABank|VietABank|PGBank|BVBank|VietBank|VietCapital|BaoViet|VNPT|VNPAY|[A-Z]{2,6})\b/);
  if (match) return match[1];
  // Fallback: take meaningful words (skip common bank prefixes)
  const skip = new Set(["ngân", "hàng", "tmcp", "thương", "mại", "cổ", "phần", "công", "ty", "tnhh", "mtv", "chi", "nhánh", "nn", "quốc", "doanh", "nhà", "nước", "việt", "nam"]);
  const words = fullName.split(/\s+/).filter((w) => !skip.has(w.toLowerCase()) && w.length > 2);
  return words.slice(0, 2).join(" ") || fullName;
}

/** Query asset_owners that likely belong to this org, with listing counts */
export async function detectCandidates(primaryName: string): Promise<{ branches: Candidate[]; amcs: Candidate[] }> {
  const keyword = extractKeyword(primaryName);
  if (!keyword || keyword.length < 2) return { branches: [], amcs: [] };

  const { data: owners } = await supabase
    .from("asset_owners")
    .select("id, name")
    .ilike("name", `%${keyword}%`)
    .limit(60);

  if (!owners?.length) return { branches: [], amcs: [] };

  // Get listing counts in one query
  const ownerIds = owners.map((o) => o.id);
  const { data: counts } = await supabase
    .from("listings")
    .select("asset_owner_id")
    .in("asset_owner_id", ownerIds);

  const countMap: Record<string, number> = {};
  for (const r of counts ?? []) {
    if (r.asset_owner_id) countMap[r.asset_owner_id] = (countMap[r.asset_owner_id] ?? 0) + 1;
  }

  const candidates: Candidate[] = owners
    .map((o) => ({ id: o.id, name: o.name, listingCount: countMap[o.id] ?? 0 }))
    .filter((c) => c.name !== primaryName) // exclude exact primary
    .sort((a, b) => b.listingCount - a.listingCount);

  return {
    branches: candidates.filter((c) => !isAmc(c.name)),
    amcs: candidates.filter((c) => isAmc(c.name)),
  };
}

export function useAssetOwnerWorkspace(userId: string | null) {
  const queryClient = useQueryClient();
  const wsKey = ["asset_owner_workspace", userId];
  const claimsKey = ["asset_owner_claims", userId];

  const { data: workspace, isLoading: wsLoading } = useQuery<AssetOwnerWorkspace | null>({
    queryKey: wsKey,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_workspaces")
        .select("*")
        .eq("owner_user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as AssetOwnerWorkspace | null;
    },
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery<AssetOwnerClaim[]>({
    queryKey: claimsKey,
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select("*, listing:listings(title, price, property_type_slug, image_url, status, address, custom_attributes), asset_owner:asset_owners(name, address)")
        .eq("workspace_id", workspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssetOwnerClaim[];
    },
  });

  // Round count (price sessions) per listing_id
  const listingIds = claims.map((c) => c.listing_id).filter((id): id is string => !!id);
  const { data: roundCountsByListing = {} } = useQuery<Record<string, number>>({
    queryKey: ["asset-owner-round-counts", workspace?.id],
    enabled: listingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_price_sessions")
        .select("listing_id")
        .in("listing_id", listingIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.listing_id] = (counts[row.listing_id] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 2 * 60_000,
  });

  const updateSeeds = useMutation({
    mutationFn: async (seeds: Pick<AssetOwnerWorkspace, "primary_name" | "abbreviations" | "branch_names">) => {
      if (!workspace?.id) throw new Error("no_workspace");
      const { error } = await supabase
        .from("asset_owner_workspaces")
        .update(seeds)
        .eq("id", workspace.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wsKey }),
    onError: () => toast.error("Cập nhật seed thất bại"),
  });

  const runMatch = useMutation({
    mutationFn: async (selectedNames?: string[]) => {
      if (!workspace) throw new Error("no_workspace");
      const seeds = selectedNames ?? [workspace.primary_name, ...workspace.abbreviations, ...workspace.branch_names].filter(Boolean);

      const { data: owners } = await supabase
        .from("asset_owners")
        .select("id, name, address");

      const matches: Array<{ asset_owner_id: string; matched_name: string; confidence_score: number }> = [];

      for (const owner of owners ?? []) {
        const bestScore = seeds.reduce((max, seed) => Math.max(max, nameSimilarity(owner.name, seed)), 0);
        if (bestScore >= 0.6) {
          matches.push({ asset_owner_id: owner.id, matched_name: owner.name, confidence_score: bestScore });
        }
      }

      if (matches.length === 0) return { inserted: 0, autoClaimed: 0, pending: 0 };

      const ownerIds = matches.map((m) => m.asset_owner_id);
      const { data: listings } = await supabase
        .from("listings")
        .select("id, asset_owner_id")
        .in("asset_owner_id", ownerIds);

      const toInsert = (listings ?? []).map((l) => {
        const match = matches.find((m) => m.asset_owner_id === l.asset_owner_id)!;
        const isAuto = match.confidence_score >= 0.9;
        return {
          workspace_id: workspace.id,
          listing_id: l.id,
          asset_owner_id: l.asset_owner_id,
          confidence_score: match.confidence_score,
          match_basis: "auto_name" as const,
          matched_name: match.matched_name,
          status: isAuto ? ("auto_claimed" as const) : ("pending_confirmation" as const),
        };
      });

      if (toInsert.length > 0) {
        await supabase
          .from("asset_owner_claims")
          .upsert(toInsert, { onConflict: "workspace_id,listing_id" });
        await supabase
          .from("asset_owner_workspaces")
          .update({ last_matched_at: new Date().toISOString() })
          .eq("id", workspace.id);
      }

      const autoClaimed = toInsert.filter((r) => r.status === "auto_claimed").length;
      const pending = toInsert.filter((r) => r.status === "pending_confirmation").length;
      return { inserted: toInsert.length, autoClaimed, pending };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: claimsKey });
      queryClient.invalidateQueries({ queryKey: wsKey });
      toast.success(`Đã khớp ${result.inserted} tài sản (${result.autoClaimed} tự động, ${result.pending} cần xác nhận)`);
    },
    onError: () => toast.error("Matching thất bại"),
  });

  const confirmClaim = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claimsKey }),
    onError: () => toast.error("Xác nhận thất bại"),
  });

  const rejectClaim = useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason?: string }) => {
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "rejected", rejection_reason: reason ?? null })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claimsKey }),
    onError: () => toast.error("Từ chối thất bại"),
  });

  const confirmAllPending = useMutation({
    mutationFn: async () => {
      if (!workspace?.id) throw new Error("no_workspace");
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("workspace_id", workspace.id)
        .eq("status", "pending_confirmation");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimsKey });
      toast.success("Đã xác nhận tất cả");
    },
    onError: () => toast.error("Xác nhận thất bại"),
  });

  return {
    workspace, wsLoading,
    claims, claimsLoading,
    roundCountsByListing,
    updateSeeds, runMatch,
    confirmClaim, rejectClaim, confirmAllPending,
  };
}
