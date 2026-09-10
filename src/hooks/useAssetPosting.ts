import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { rankOrgs, type AuctionOrgRow, type MatchCriteria, type OrgMatchResult } from "@/lib/orgMatching";
import type { Database } from "@/integrations/supabase/types";
import type {
  AssetBrokerRequest,
  AssetPosting,
  AssetPostingStatus,
  AssetServiceRequest,
} from "@/types/asset-posting";

type AssetPostingInsert = Database["public"]["Tables"]["asset_postings"]["Insert"];

/** Payload từ wizard — KHÔNG gồm field do hook/DB quản lý. */
export type NewAssetPosting = Omit<
  AssetPostingInsert,
  "user_id" | "status" | "submitted_at" | "chosen_org_id" | "id" | "created_at" | "updated_at"
>;

const ORG_SELECT = "id, name, address, created_at, email, logo_url, org_type, phone, province, tax_code";

// ─── Gợi ý tổ chức (matching client-side) ────────────────────────────────────

/**
 * Xếp hạng tổ chức đấu giá theo tiêu chí hồ sơ.
 *
 * Mặc định CHỈ trả tổ chức đã có tài khoản trên sàn: yêu cầu gửi tới tổ chức
 * không có tài khoản thì không ai trả lời được, đúng cái ngõ cụt luồng ký gửi
 * sinh ra để dẹp. Muốn xem cả danh bạ thì truyền onlyAccounted: false.
 */
export function useMatchedOrgs(
  criteria: MatchCriteria | null,
  opts: { onlyAccounted?: boolean } = {},
) {
  const { onlyAccounted = true } = opts;
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

  const accounted = useQuery({
    queryKey: ["accounted-auction-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("accounted_auction_org_ids");
      if (error) throw error;
      return new Set((data ?? []) as string[]);
    },
    enabled: enabled && onlyAccounted,
    staleTime: 5 * 60 * 1000,
  });

  const results: OrgMatchResult[] = useMemo(() => {
    if (!criteria || !query.data) return [];
    const pool = onlyAccounted
      ? query.data.filter((o) => accounted.data?.has(o.id))
      : query.data;
    return rankOrgs(pool, criteria);
  }, [criteria, query.data, onlyAccounted, accounted.data]);

  return {
    results,
    isLoading: query.isLoading || (onlyAccounted && accounted.isLoading),
    error: query.error ?? accounted.error,
  };
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
      // qua unknown: ownership_declaration/delta_fields là Json ở client sinh tự động.
      return (data ?? []) as unknown as AssetPosting[];
    },
    enabled: !!userId,
  });
}

// ─── Chi tiết một hồ sơ (kèm tổ chức đã chọn + yêu cầu dịch vụ) ───────────────

export interface RequestOrg {
  id: string;
  name: string;
  province: string | null;
  phone: string | null;
  logo_url: string | null;
}

/** Một yêu cầu kèm thông tin tổ chức nhận — dùng cho bảng so sánh báo giá. */
export interface RequestWithOrg extends AssetServiceRequest {
  org: RequestOrg | null;
}

export interface PostingDetail {
  posting: AssetPosting;
  /** Tổ chức đã CHỐT (yêu cầu status='selected'), null khi chưa chốt. */
  org: RequestOrg | null;
  /** TẤT CẢ yêu cầu của hồ sơ — fan-out của sàn tạo nhiều dòng cùng lúc. */
  requests: RequestWithOrg[];
  /** Yêu cầu mới nhất; giữ cho chỗ nào chỉ cần một dòng. */
  request: AssetServiceRequest | null;
  brokerRequest: AssetBrokerRequest | null;
}

export function usePostingDetail(id: string | null) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["posting-detail", id],
    queryFn: async (): Promise<PostingDetail | null> => {
      if (!id) return null;

      const { data: posting, error } = await supabase.from("asset_postings").select("*").eq("id", id).single();
      if (error) throw error;

      const [{ data: reqRows }, { data: brokerRows }] = await Promise.all([
        supabase
          .from("asset_service_requests")
          .select("*")
          .eq("asset_posting_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("asset_broker_requests")
          .select("*")
          .eq("asset_posting_id", id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const rows = (reqRows ?? []) as unknown as AssetServiceRequest[];

      // Nạp tên tổ chức cho MỌI yêu cầu: chủ tài sản phải so sánh được các báo
      // giá theo tên, không phải theo uuid.
      const orgIds = [...new Set(rows.map((r) => r.auction_org_id))];
      let orgMap: Record<string, RequestOrg> = {};
      if (orgIds.length) {
        const { data: orgRows } = await supabase
          .from("auction_organizations")
          .select("id, name, province, phone, logo_url")
          .in("id", orgIds);
        orgMap = Object.fromEntries((orgRows ?? []).map((o) => [o.id, o as RequestOrg]));
      }

      const requests: RequestWithOrg[] = rows.map((r) => ({ ...r, org: orgMap[r.auction_org_id] ?? null }));

      // Tổ chức đã chốt suy ra từ yêu cầu 'selected', KHÔNG từ chosen_org_id:
      // luồng ký gửi cố ý không ghi vào asset_postings (trigger review guard).
      const selected = requests.find((r) => r.status === "selected") ?? null;
      const org =
        selected?.org ??
        (posting.chosen_org_id ? (orgMap[posting.chosen_org_id] ?? null) : null);

      return {
        posting: posting as unknown as AssetPosting,
        org,
        requests,
        request: rows[0] ?? null,
        brokerRequest: ((brokerRows ?? [])[0] as unknown as AssetBrokerRequest) ?? null,
      };
    },
    enabled: !!id && !!userId,
  });
}

// ─── Nhờ sàn chọn giúp (môi giới) ────────────────────────────────────────────

export function useCreateBrokerRequest() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postingId, note }: { postingId: string; note?: string }) => {
      if (!userId) throw new Error("Bạn cần đăng nhập để gửi yêu cầu.");

      const { error } = await supabase.from("asset_broker_requests").insert({
        asset_posting_id: postingId,
        user_id: userId,
        note: note?.trim() || null,
      });
      if (error) throw error;
      return { postingId };
    },
    onSuccess: ({ postingId }) => {
      queryClient.invalidateQueries({ queryKey: ["my-postings", userId] });
      queryClient.invalidateQueries({ queryKey: ["posting-detail", postingId] });
      toast.success("Đã gửi yêu cầu. Sàn sẽ tìm tổ chức đấu giá phù hợp cho bạn.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Không gửi được yêu cầu. Vui lòng thử lại.");
    },
  });
}

export function useCancelBrokerRequest() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ brokerRequestId, postingId }: { brokerRequestId: string; postingId: string }) => {
      const { error } = await supabase
        .from("asset_broker_requests")
        .update({ status: "cancelled" })
        .eq("id", brokerRequestId);
      if (error) throw error;
      return { postingId };
    },
    onSuccess: ({ postingId }) => {
      queryClient.invalidateQueries({ queryKey: ["posting-detail", postingId] });
      toast.success("Đã huỷ yêu cầu nhờ sàn chọn giúp.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Không huỷ được yêu cầu.");
    },
  });
}

/**
 * Chốt một báo giá. RPC lo hết: đặt 'selected', đóng các tổ chức còn lại thành
 * 'not_selected', và tạo lead + cơ hội trong CRM.
 */
export function useSelectQuote() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string; postingId: string }) => {
      const { error } = await supabase.rpc("owner_select_service_quote", { _request_id: requestId });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["my-postings", userId] });
      queryClient.invalidateQueries({ queryKey: ["posting-detail", vars.postingId] });
      toast.success("Đã chọn tổ chức đấu giá. Sàn sẽ liên hệ để hoàn tất hợp đồng.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Không chọn được tổ chức. Vui lòng thử lại.");
    },
  });
}
