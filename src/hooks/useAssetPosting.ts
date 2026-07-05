import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { rankOrgs, type AuctionOrgRow, type MatchCriteria, type OrgMatchResult } from "@/lib/orgMatching";
import type { Database } from "@/integrations/supabase/types";
import type { AssetPosting, AssetServiceRequest } from "@/types/asset-posting";

type AssetPostingInsert = Database["public"]["Tables"]["asset_postings"]["Insert"];

/** Payload từ wizard — KHÔNG gồm field do hook/DB quản lý. */
export type NewAssetPosting = Omit<
  AssetPostingInsert,
  "user_id" | "status" | "submitted_at" | "chosen_org_id" | "id" | "created_at" | "updated_at"
>;

const ORG_SELECT = "id, name, address, created_at, email, logo_url, org_type, phone, province, tax_code";

// ─── Gợi ý tổ chức (matching client-side) ────────────────────────────────────

export function useMatchedOrgs(criteria: MatchCriteria | null) {
  const enabled = !!criteria?.parentSlug;

  const query = useQuery({
    queryKey: ["matched-orgs-pool"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_organizations")
        .select(ORG_SELECT)
        .order("name");
      if (error) throw error;
      return (data ?? []) as AuctionOrgRow[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const results: OrgMatchResult[] = useMemo(() => {
    if (!criteria || !query.data) return [];
    return rankOrgs(query.data, criteria);
  }, [criteria, query.data]);

  return { results, isLoading: query.isLoading, error: query.error };
}

// ─── Chọn org + gửi yêu cầu dịch vụ (tạo hồ sơ + service request) ─────────────

export interface SubmitPostingArgs {
  posting: NewAssetPosting;
  orgId: string;
  matchScore: number;
  message?: string;
}

export function useSubmitPostingWithOrg() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ posting, orgId, matchScore, message }: SubmitPostingArgs) => {
      if (!userId) throw new Error("Bạn cần đăng nhập để đăng tài sản.");

      const { data: created, error: postingError } = await supabase
        .from("asset_postings")
        .insert({
          ...posting,
          user_id: userId,
          chosen_org_id: orgId,
          status: "matched",
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (postingError) throw postingError;

      const { error: requestError } = await supabase.from("asset_service_requests").insert({
        asset_posting_id: created.id,
        auction_org_id: orgId,
        user_id: userId,
        status: "sent",
        message: message ?? null,
        match_score: matchScore,
      });
      if (requestError) throw requestError;

      return { postingId: created.id, orgId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-postings", userId] });
      toast.success("Đã tạo hồ sơ tài sản và gửi yêu cầu dịch vụ tới tổ chức đấu giá.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Không thể gửi yêu cầu. Vui lòng thử lại.");
    },
  });
}

// ─── Danh sách hồ sơ tài sản của tôi ─────────────────────────────────────────

export function useMyPostings() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["my-postings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_postings")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssetPosting[];
    },
    enabled: !!userId,
  });
}

// ─── Chi tiết một hồ sơ (kèm tổ chức đã chọn + yêu cầu dịch vụ) ───────────────

export interface PostingDetail {
  posting: AssetPosting;
  org: { id: string; name: string; province: string | null; phone: string | null; logo_url: string | null } | null;
  request: AssetServiceRequest | null;
}

export function usePostingDetail(id: string | null) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["posting-detail", id],
    queryFn: async (): Promise<PostingDetail | null> => {
      if (!id) return null;

      const { data: posting, error } = await supabase.from("asset_postings").select("*").eq("id", id).single();
      if (error) throw error;

      let org: PostingDetail["org"] = null;
      if (posting.chosen_org_id) {
        const { data: orgRow } = await supabase
          .from("auction_organizations")
          .select("id, name, province, phone, logo_url")
          .eq("id", posting.chosen_org_id)
          .maybeSingle();
        org = orgRow ?? null;
      }

      const { data: reqRows } = await supabase
        .from("asset_service_requests")
        .select("*")
        .eq("asset_posting_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      return {
        posting: posting as AssetPosting,
        org,
        request: (reqRows?.[0] as AssetServiceRequest) ?? null,
      };
    },
    enabled: !!id && !!userId,
  });
}
