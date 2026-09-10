// Hàng chờ duyệt hồ sơ tài sản (admin).
//
// Enforce nằm ở DB, không ở đây: RLS asset_postings_admin_read/write kiểm quyền
// 'tai-san-tu-nguyen', còn trigger asset_postings_review_guard chỉ cho người có
// action 'approve' ghi vào 5 cột duyệt. Nên `.update()` thẳng qua typed client
// là đủ an toàn — không cần RPC riêng.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import type { AssetPosting } from "@/types/asset-posting";

/** Người nộp hồ sơ, join từ profiles. */
export interface PostingSubmitter {
  name: string | null;
  email: string;
}

export interface AdminAssetPosting extends AssetPosting {
  profiles: PostingSubmitter | null;
}

const SELECT = "*, profiles!asset_postings_user_id_fkey(name, email)";

// ─── Đọc ─────────────────────────────────────────────────────────────────────

/** Toàn bộ hồ sơ, KHÔNG lọc status — admin xem được cả hồ sơ nháp. */
export function useAdminAssetPostings() {
  return useQuery({
    queryKey: qk.adminAssetPostings.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_postings")
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminAssetPosting[];
    },
  });
}

export function useAdminAssetPosting(id: string | undefined) {
  return useQuery({
    queryKey: qk.adminAssetPostings.byId(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_postings")
        .select(SELECT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AdminAssetPosting) ?? null;
    },
    enabled: !!id,
  });
}

// ─── Xét duyệt ───────────────────────────────────────────────────────────────

export type ReviewAction =
  | { action: "approve"; id: string }
  | { action: "reject"; id: string; reason: string; notes?: string }
  /** rejected → pending: mở lại để chủ tài sản sửa và duyệt lại. */
  | { action: "reopen"; id: string };

const REVIEW_TOAST: Record<ReviewAction["action"], string> = {
  approve: "Đã phê duyệt hồ sơ tài sản.",
  reject: "Đã từ chối hồ sơ tài sản.",
  reopen: "Đã mở lại hồ sơ để duyệt lại.",
};

export function useReviewAssetPosting() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: ReviewAction) => {
      const now = new Date().toISOString();

      const patch =
        args.action === "approve"
          ? {
              review_status: "approved",
              reviewed_at: now,
              reviewed_by: userId,
              rejection_reason: null,
            }
          : args.action === "reject"
            ? {
                review_status: "rejected",
                reviewed_at: now,
                reviewed_by: userId,
                rejection_reason: args.reason.trim(),
                // Chỉ ghi đè ghi chú nội bộ khi admin thực sự nhập.
                ...(args.notes?.trim() ? { review_notes: args.notes.trim() } : {}),
              }
            : {
                review_status: "pending",
                reviewed_at: null,
                reviewed_by: null,
                rejection_reason: null,
              };

      const { data, error } = await supabase
        .from("asset_postings")
        .update(patch)
        .eq("id", args.id)
        .select("id, review_status")
        .maybeSingle();
      if (error) throw error;

      // Trigger nuốt thay đổi thay vì báo lỗi khi thiếu quyền 'approve' — nếu
      // không kiểm ở đây thì toast vẫn xanh trong lúc DB không hề đổi.
      if (!data) throw new Error("Bạn không có quyền duyệt hồ sơ tài sản.");
      const expected =
        args.action === "approve" ? "approved" : args.action === "reject" ? "rejected" : "pending";
      if (data.review_status !== expected) {
        throw new Error("Bạn không có quyền duyệt hồ sơ tài sản.");
      }

      return args;
    },
    onSuccess: (args) => {
      queryClient.invalidateQueries({ queryKey: qk.adminAssetPostings.all });
      toast.success(REVIEW_TOAST[args.action]);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật hồ sơ.");
    },
  });
}

// ─── Admin bổ sung / sửa nội dung hồ sơ ──────────────────────────────────────

/** Chỉ các cột nội dung — 5 cột duyệt đi qua useReviewAssetPosting(). */
export type AdminPostingPatch = Partial<
  Pick<
    AssetPosting,
    | "title"
    | "description"
    | "province"
    | "district"
    | "ward"
    | "address"
    | "pricing_mode"
    | "starting_price"
    | "auction_format"
    | "commission_pct"
    | "expected_timeline"
    | "has_dispute"
    | "has_mortgage"
    | "is_seized"
    | "right_to_sell"
    | "legal_notes"
    | "delta_fields"
  >
>;

export function useUpdateAssetPostingByAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AdminPostingPatch }) => {
      const { error } = await supabase
        .from("asset_postings")
        // delta_fields là JSONB nên kiểu sinh ra là Json — cast tại ranh giới này.
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.adminAssetPostings.all });
      toast.success("Đã lưu thông tin tài sản.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Không thể lưu thông tin.");
    },
  });
}
