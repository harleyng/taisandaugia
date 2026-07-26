import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { rankOrgs, type AuctionOrgRow, type MatchCriteria, type OrgMatchResult } from "@/lib/orgMatching";
import type { Database } from "@/integrations/supabase/types";
import type { AssetPosting, AssetServiceRequest, AssetPostingStatus } from "@/types/asset-posting";

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

// ─── Số hoá tài sản (tạo/cập nhật hồ sơ, KHÔNG gắn tổ chức) ───────────────────
// Số hoá và chọn tổ chức đấu giá là 2 luồng riêng: hook này chỉ lưu hồ sơ.
//   status 'draft'  → Lưu và thoát giữa chừng
//   status 'active' → hoàn tất số hoá (không bắt buộc tổ chức)

export interface CreatePostingArgs {
  posting: NewAssetPosting;
  status: Extract<AssetPostingStatus, "draft" | "active">;
  /** Có giá trị = cập nhật hồ sơ nháp đã có; bỏ trống = tạo mới. */
  postingId?: string;
}

export function useCreatePosting() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ posting, status, postingId }: CreatePostingArgs) => {
      if (!userId) throw new Error("Bạn cần đăng nhập để số hoá tài sản.");

      const submittedAt = status === "active" ? new Date().toISOString() : null;

      if (postingId) {
        const { data: updated, error } = await supabase
          .from("asset_postings")
          .update({ ...posting, status, submitted_at: submittedAt })
          .eq("id", postingId)
          .eq("user_id", userId)
          .select("id")
          .single();
        if (error) throw error;
        return { postingId: updated.id };
      }

      const { data: created, error } = await supabase
        .from("asset_postings")
        .insert({
          ...posting,
          user_id: userId,
          chosen_org_id: null,
          status,
          submitted_at: submittedAt,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { postingId: created.id };
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["my-postings", userId] });
      toast.success(vars.status === "draft" ? "Đã lưu nháp hồ sơ tài sản." : "Đã số hoá tài sản thành công.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Không thể lưu hồ sơ. Vui lòng thử lại.");
    },
  });
}

// ─── Gửi yêu cầu dịch vụ tới tổ chức đấu giá (luồng riêng, sau khi đã số hoá) ──

export interface SendServiceRequestArgs {
  postingId: string;
  orgId: string;
  matchScore: number;
  message?: string;
}

export function useSendServiceRequest() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postingId, orgId, matchScore, message }: SendServiceRequestArgs) => {
      if (!userId) throw new Error("Bạn cần đăng nhập để gửi yêu cầu.");

      const { error } = await supabase.from("asset_service_requests").insert({
        asset_posting_id: postingId,
        auction_org_id: orgId,
        user_id: userId,
        status: "sent",
        message: message ?? null,
        match_score: matchScore,
      });
      if (error) throw error;

      return { postingId, orgId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-postings", userId] });
      queryClient.invalidateQueries({ queryKey: ["posting-detail", data.postingId] });
      toast.success("Đã gửi yêu cầu dịch vụ tới tổ chức đấu giá.");
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
