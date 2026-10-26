/* eslint-disable @typescript-eslint/no-explicit-any */
// Luồng DUYỆT của một kế hoạch đấu giá: trả lại · ghi nhận phê duyệt · mở điều
// chỉnh, cùng các số liệu của tab "Phê duyệt & lịch sử" (bản mốc, thay đổi so
// với bản mốc, nhật ký chuyển bước).
//
// ⚠️ `(supabase as any)` ở mọi truy vấn `auction_plan_*`: `src/integrations/supabase/types.ts`
// KHÔNG sinh lại được ở máy hiện tại (token CLI thuộc tài khoản Supabase khác,
// `--db-url` cần Docker) nên các bảng / RPC của module này không có trong kiểu
// tự sinh — xem đầu `src/lib/auctionPlan/types.ts`. `owner_audit_list` thì CÓ
// trong kiểu nên gọi bằng client đã định kiểu.
//
// ⚠️ Mọi thất bại DỰ KIẾN của RPC trả `{ok:false, reason}` (không RAISE) ⇒ phải
// `assertAuctionPlanRpcOk`, nếu không một lần trả lại thất bại vẫn hiện toast xanh.
//
// ⚠️ Bucket `auction-plan-docs` là PRIVATE và KHÔNG có policy UPDATE: luôn tải
// lên bằng TÊN MỚI (không upsert), lưu ĐƯỜNG DẪN chứ không lưu URL, và mở tệp
// bằng `createSignedUrl`. Thứ tự bắt buộc: tải tệp lên TRƯỚC, rồi mới gọi
// `auction_plan_record_approval` — RPC từ chối đường dẫn ngoài
// `{workspace_id}/{plan_id}/` hoặc không tồn tại thật trong storage.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";
import { assertAuctionPlanRpcOk } from "@/lib/auctionPlan/rpc";
import { fromServerBaselineDiff, type BaselineDiff } from "@/lib/auctionPlan/diff";
import {
  AUCTION_PLAN_DOCS_BUCKET,
  auctionPlanDocPrefix,
  type AuctionPlan,
  type AuctionPlanBaseline,
  type AuctionPlanBaselineDiff,
} from "@/lib/auctionPlan/types";
import { parseAuditPage, type AuditEntry } from "@/lib/ownerAudit";

const BASELINE_COLUMNS =
  "id, plan_id, workspace_id, branch_id, version, approved_at, approved_by, approval_doc_no, approval_doc_date, approval_doc_urls, payload, created_at";

/** Trần số dòng nhật ký của một kế hoạch — một kế hoạch có vài chục lần chuyển bước là nhiều. */
const HISTORY_LIMIT = 100;

/* ─── Đọc ─────────────────────────────────────────────────────────────────── */

/** Người xem có phải cấp trên của ĐÚNG kế hoạch này (hình A: cùng Trạm · hình B: Trạm cha). */
export function usePlanReviewerOk(planId: string | undefined) {
  return useQuery<boolean>({
    queryKey: qk.auctionPlanReviewerOk(planId),
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_reviewer_ok", { p_plan_id: planId });
      if (error) throw error;
      return data === true;
    },
  });
}

/** Quyền Duyệt kế hoạch trong một Trạm (không xét kế hoạch cụ thể) — dùng cho trang danh sách. */
export function usePlanCanApprove(workspaceId: string | null) {
  return useQuery<boolean>({
    queryKey: qk.auctionPlanCanApprove(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_can_approve", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return data === true;
    },
  });
}

/** Các bản mốc đã đóng băng, bản mới nhất trước. Bảng BẤT BIẾN nên cache lâu được. */
export function usePlanBaselines(planId: string | undefined) {
  return useQuery<AuctionPlanBaseline[]>({
    queryKey: qk.auctionPlanBaselines(planId),
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plan_baselines")
        .select(BASELINE_COLUMNS)
        .eq("plan_id", planId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AuctionPlanBaseline[];
    },
  });
}

/**
 * Thay đổi của danh mục HIỆN TẠI so với bản mốc mới nhất (luật D4).
 *
 * Đây là con số của SERVER — `src/lib/auctionPlan/diff.ts` là bản sao ở client
 * dùng để so hai bản mốc đã lưu với nhau. Hai bên phải cho cùng kết quả.
 */
export function usePlanBaselineDiff(plan: AuctionPlan | null, enabled = true) {
  const planId = plan?.id;
  return useQuery<BaselineDiff | null>({
    queryKey: qk.auctionPlanBaselineDiff(planId),
    enabled: !!planId && enabled && (plan?.baseline_version ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_baseline_diff", { p_plan_id: planId });
      if (error) throw error;
      return fromServerBaselineDiff(data as AuctionPlanBaselineDiff);
    },
  });
}

/**
 * Nhật ký chuyển bước của kế hoạch — ĐỌC LẠI đúng cổng của trang
 * /chu-tai-san/nhat-ky (`owner_audit_list`), chỉ thêm bộ lọc theo bản ghi; không
 * viết truy vấn riêng vào `owner_audit_log` (luật xem gì nằm ở SQL).
 *
 * ⚠️ Tầng xem do server quyết: người KHÔNG có quyền `nhat-ky:view` chỉ thấy
 * thao tác của CHÍNH MÌNH. Vì thế tab lịch sử luôn hiện thêm danh sách bản mốc
 * + góp ý hiện tại (đọc từ chính kế hoạch), để cán bộ xã không bị trống trang.
 */
export function usePlanHistory(plan: AuctionPlan | null) {
  const planId = plan?.id;
  const workspaceId = plan?.workspace_id ?? null;
  return useQuery<{ rows: AuditEntry[]; level: string }>({
    queryKey: qk.auctionPlanHistory(planId),
    enabled: !!planId && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_audit_list", {
        p_workspace_id: workspaceId as string,
        p_filters: {
          modules: ["ke-hoach"],
          kind: "changes",
          entity_type: "auction_plans",
          entity_id: planId,
        } as Json,
        p_limit: HISTORY_LIMIT,
        p_offset: 0,
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; reason?: string } | null;
      // Không có quyền xem nhật ký của Trạm ⇒ coi như danh sách rỗng, không chặn cả tab.
      if (payload && payload.ok === false) return { rows: [], level: "mine" };
      const page = parseAuditPage(data);
      return { rows: page.rows, level: page.level };
    },
  });
}

/* ─── Tệp quyết định ──────────────────────────────────────────────────────── */

export const PLAN_DOC_MAX_SIZE = 10 * 1024 * 1024;
export const PLAN_DOC_ACCEPT =
  "application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Tên tệp an toàn cho storage (bỏ dấu, bỏ ký tự lạ) — giữ phần mở rộng. */
function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "pdf";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "quyet-dinh"}-${Date.now()}.${ext}`;
}

/** Tải tệp quyết định lên ĐÚNG thư mục của kế hoạch; trả về ĐƯỜNG DẪN (không phải URL). */
export async function uploadPlanDoc(workspaceId: string, planId: string, file: File): Promise<string> {
  if (file.size > PLAN_DOC_MAX_SIZE) throw new Error("Tệp vượt quá 10MB.");
  const path = `${auctionPlanDocPrefix(workspaceId, planId)}${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(AUCTION_PLAN_DOCS_BUCKET).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message || "Không tải được tệp lên.");
  return path;
}

/** Link tạm để mở tệp trong bucket PRIVATE (`getPublicUrl` luôn 400). */
export async function planDocSignedUrl(path: string, ttlSeconds = 120): Promise<string> {
  const { data, error } = await supabase.storage
    .from(AUCTION_PLAN_DOCS_BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data) throw new Error(error?.message ?? "Không mở được tệp.");
  return data.signedUrl;
}

/* ─── Ghi: chuyển trạng thái ──────────────────────────────────────────────── */

/** Một kế hoạch đổi trạng thái ⇒ làm mới cả cây `["auction-plan", id]` (danh mục, bản mốc, lịch sử, diff). */
function useApprovalInvalidate(planId: string | undefined, workspaceId: string | null) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.auctionPlan(planId) });
    void qc.invalidateQueries({ queryKey: qk.auctionPlans(workspaceId) });
  };
}

/** "Trả lại" — cần `reviewer_ok`; lý do ≥ 10 ký tự (server chặn, client cũng chặn). */
export const PLAN_RETURN_MIN_COMMENT = 10;

export function useReturnPlan(plan: AuctionPlan | null) {
  const invalidate = useApprovalInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async (comment: string) => {
      const { data, error } = await (supabase as any).rpc("auction_plan_return", {
        p_plan_id: plan!.id,
        p_comment: comment.trim(),
      });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã trả lại kế hoạch kèm góp ý");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface RecordApprovalInput {
  docNo: string;
  docDate: string;
  /** Đường dẫn trong bucket — đã tải lên TRƯỚC khi gọi RPC. */
  docPaths: string[];
}

/** "Ghi nhận phê duyệt" — ghi một bản mốc mới và tăng `baseline_version` (D5: app không ký). */
export function useRecordPlanApproval(plan: AuctionPlan | null) {
  const invalidate = useApprovalInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async (input: RecordApprovalInput) => {
      const { data, error } = await (supabase as any).rpc("auction_plan_record_approval", {
        p_plan_id: plan!.id,
        p_doc_no: input.docNo.trim(),
        p_doc_date: input.docDate,
        p_doc_urls: input.docPaths,
      });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
      return data as { version?: number; item_count?: number };
    },
    onSuccess: (data) => {
      invalidate();
      toast.success(`Đã ghi nhận phê duyệt · bản mốc v${data?.version ?? ""}`.trim());
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** "Điều chỉnh kế hoạch" — `approved → adjusting`, mở lại trường mốc để sửa (cần `finalize`). */
export function useStartPlanAdjustment(plan: AuctionPlan | null) {
  const invalidate = useApprovalInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_start_adjustment", {
        p_plan_id: plan!.id,
      });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã mở điều chỉnh — sửa xong hãy trình lại để được phê duyệt");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
