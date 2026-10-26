/* eslint-disable @typescript-eslint/no-explicit-any */
// Theo dõi thực hiện kế hoạch đấu giá (Phase 5): mốc công việc, kết quả thực
// tế, sức khoẻ, liên kết hồ sơ / tin đăng.
//
// ⚠️ `(supabase as any)` ở mọi truy vấn `auction_plan_*` — xem đầu
// `useAuctionPlans.ts` để biết vì sao (types.ts chưa sinh lại được trên máy
// hiện tại nên các bảng này không có trong kiểu tự sinh).
//
// ⚠️ Quyền CỘT của `auction_plan_item_steps`: client chỉ được gửi
// `item_id, step, sort_order, planned_date, done_on, doc_no, doc_date,
// evidence_urls, note`. GỬI THÊM MỘT CỘT NGOÀI DANH SÁCH (ví dụ `source`) thì
// Postgres trả 42501 "permission denied for table auction_plan_item_steps" —
// lỗi nêu tên BẢNG, không nêu cột. Vì thế payload luôn dựng TƯỜNG MINH, không
// bao giờ spread một dòng đã đọc vào `update`.
//
// ⚠️ Trường THỰC HIỆN của tài sản có payload RIÊNG (`itemExecPayload`), KHÔNG
// nới `itemWritePayload` của Phase 3: hai nhóm cột có luật khoá khác nhau
// (trường mốc khoá theo trạng thái kế hoạch, trường thực hiện thì không) và
// `exec_status` lại bị guard coi là thay đổi MỐC.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { usePlanBaselines } from "@/hooks/useAuctionPlanApproval";
import { assertAuctionPlanRpcOk, auctionPlanWriteMessage } from "@/lib/auctionPlan/rpc";
import {
  baselineMonthMap,
  planHealthToday,
  planItemHealth,
  withBaselineMonth,
  type PlanItemHealth,
} from "@/lib/auctionPlan/health";
import { groupStepsByItem, planStepProgress, type PlanStepProgress } from "@/lib/auctionPlan/steps";
import type {
  AuctionPlan,
  AuctionPlanItem,
  AuctionPlanItemStep,
  AuctionPlanStep,
} from "@/lib/auctionPlan/types";

const STEP_COLUMNS =
  "id, item_id, plan_id, workspace_id, branch_id, step, sort_order, planned_date, done_on, doc_no, doc_date, evidence_urls, source, note, created_at, updated_at";

/* ─── Đọc ─────────────────────────────────────────────────────────────────── */

export function usePlanItemSteps(planId: string | undefined) {
  return useQuery<AuctionPlanItemStep[]>({
    queryKey: qk.auctionPlanItemSteps(planId),
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plan_item_steps")
        .select(STEP_COLUMNS)
        .eq("plan_id", planId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AuctionPlanItemStep[];
    },
  });
}

/** Kết quả phiên thực tế của từng tài sản — khớp theo hồ sơ số hoá HOẶC tin đăng. */
export interface PlanItemOutcome {
  item_id: string;
  link: "posting" | "listing";
  outcome: string | null;
  payment_status: string | null;
  auction_date: string | null;
  starting_price: number | null;
  winning_price: number | null;
  paid_amount: number | null;
  paid_at: string | null;
  round_no: number | null;
}

export function usePlanItemOutcomes(planId: string | undefined) {
  return useQuery<PlanItemOutcome[]>({
    queryKey: qk.auctionPlanItemOutcomes(planId),
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_item_outcomes", { p_plan_id: planId! });
      if (error) throw error;
      return (data ?? []) as PlanItemOutcome[];
    },
  });
}

/** Mốc sàn xác nhận được nhưng CHƯA ghi vào bảng mốc (gợi ý nút "Đồng bộ"). */
export interface PlanPlatformStep {
  item_id: string;
  step: AuctionPlanStep;
  platform_date: string;
  detail: string;
}

export function usePlanPlatformSteps(planId: string | undefined, enabled = true) {
  return useQuery<PlanPlatformStep[]>({
    queryKey: qk.auctionPlanPlatformSteps(planId),
    enabled: !!planId && enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_platform_steps", { p_plan_id: planId! });
      if (error) throw error;
      return (data ?? []) as PlanPlatformStep[];
    },
  });
}

/* ─── Gộp: tài sản + mốc + kết quả + sức khoẻ ─────────────────────────────── */

export interface PlanItemProgress {
  item: AuctionPlanItem;
  steps: AuctionPlanItemStep[];
  outcome: PlanItemOutcome | null;
  health: PlanItemHealth;
  progress: PlanStepProgress;
  /** Tháng của bản mốc — cái mà "trễ kế hoạch" so với (A5). */
  baselineMonth: string | null;
}

/**
 * Một lần đọc cho cả tab "Tiến độ": mốc của mọi tài sản, kết quả thực tế, bản
 * mốc mới nhất; sức khoẻ tính ở client bằng `planItemHealth` (A5) để lưới và
 * chip trong bảng không bao giờ lệch nhau.
 */
export function usePlanProgress(plan: AuctionPlan | null, items: readonly AuctionPlanItem[]) {
  const planId = plan?.id;
  const stepsQuery = usePlanItemSteps(planId);
  const outcomesQuery = usePlanItemOutcomes(planId);
  const baselinesQuery = usePlanBaselines(planId);
  const platformQuery = usePlanPlatformSteps(planId);

  const asOf = useMemo(() => planHealthToday(), []);

  const rows = useMemo<PlanItemProgress[]>(() => {
    const byItem = groupStepsByItem(stepsQuery.data ?? []);
    const outcomes = new Map((outcomesQuery.data ?? []).map((o) => [o.item_id, o]));
    const months = baselineMonthMap((baselinesQuery.data ?? [])[0] ?? null);
    return items.map((item) => {
      const steps = byItem.get(item.id) ?? [];
      const outcome = outcomes.get(item.id) ?? null;
      const withMonth = withBaselineMonth(item, months);
      return {
        item,
        steps,
        outcome,
        baselineMonth: withMonth.baseline_month,
        health: planItemHealth(withMonth, steps, outcome, asOf),
        progress: planStepProgress(steps, asOf),
      };
    });
  }, [items, stepsQuery.data, outcomesQuery.data, baselinesQuery.data, asOf]);

  /** Số mốc sàn xác nhận được mà bảng mốc chưa ghi đúng ⇒ nút "Đồng bộ" có việc. */
  const pendingPlatform = useMemo(() => {
    const steps = stepsQuery.data ?? [];
    const key = (itemId: string, step: string) => `${itemId}|${step}`;
    const saved = new Map(steps.map((s) => [key(s.item_id, s.step), s]));
    return (platformQuery.data ?? []).filter((p) => {
      const row = saved.get(key(p.item_id, p.step));
      return !row || row.source !== "platform" || row.done_on !== p.platform_date;
    }).length;
  }, [platformQuery.data, stepsQuery.data]);

  return {
    rows,
    asOf,
    pendingPlatform,
    isLoading: stepsQuery.isLoading || outcomesQuery.isLoading,
    isError: stepsQuery.isError,
  };
}

/* ─── Ghi: mốc công việc ──────────────────────────────────────────────────── */

export interface PlanStepFormValues {
  planned_date: string | null;
  done_on: string | null;
  doc_no: string | null;
  doc_date: string | null;
  evidence_urls: string[];
  note: string | null;
}

/** Dựng tường minh — bản sao danh sách GRANT cột UPDATE, đừng thay bằng spread. */
const stepWritePayload = (v: PlanStepFormValues) => ({
  planned_date: v.planned_date,
  done_on: v.done_on,
  doc_no: v.doc_no,
  doc_date: v.doc_date,
  evidence_urls: v.evidence_urls,
  note: v.note,
});

function usePlanInvalidate(planId: string | undefined, workspaceId: string | null) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.auctionPlan(planId) });
    void qc.invalidateQueries({ queryKey: qk.auctionPlans(workspaceId) });
  };
}

export function useSavePlanStep(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async ({ stepId, values }: { stepId: string; values: PlanStepFormValues }) => {
      const { error } = await (supabase as any)
        .from("auction_plan_item_steps")
        .update(stepWritePayload(values))
        .eq("id", stepId);
      if (error) throw new Error(auctionPlanWriteMessage(error));
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã lưu mốc công việc");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Đồng bộ mốc do dữ liệu sàn xác nhận.
 *
 * `source` không nằm trong quyền cột của client ⇒ việc này BẮT BUỘC đi qua RPC
 * `auction_plan_sync_platform_steps` (SECURITY DEFINER). RPC trả
 * `{ok:false, reason}` nên phải assert, nếu không một lần đồng bộ bị từ chối
 * vẫn hiện toast xanh.
 */
export function useSyncPlatformSteps(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_sync_platform_steps", {
        p_plan_id: plan!.id,
      });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
      return data as { updated?: number; kept_manual?: number };
    },
    onSuccess: (data) => {
      invalidate();
      const n = data?.updated ?? 0;
      toast.success(
        n === 0
          ? "Không có mốc nào mới từ dữ liệu sàn"
          : `Đã cập nhật ${n} mốc từ dữ liệu sàn${data?.kept_manual ? ` · giữ ${data.kept_manual} ngày tự khai trong ghi chú` : ""}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ─── Ghi: trường THỰC HIỆN của tài sản ───────────────────────────────────── */

/** Luôn sửa được với `ke-hoach:update` + đúng chi nhánh, kể cả khi kế hoạch ĐÃ DUYỆT. */
export interface PlanItemExecValues {
  forecast_month: string | null;
  forecast_reason: string | null;
  responsible_user_id: string | null;
  asset_posting_id: string | null;
  listing_id: string | null;
  exec_note: string | null;
}

/** Payload RIÊNG của nhóm thực hiện — KHÔNG gộp vào `itemWritePayload` (xem đầu file). */
const itemExecPayload = (v: Partial<PlanItemExecValues>) => {
  const out: Record<string, unknown> = {};
  if ("forecast_month" in v) out.forecast_month = v.forecast_month ?? null;
  if ("forecast_reason" in v) out.forecast_reason = v.forecast_reason ?? null;
  if ("responsible_user_id" in v) out.responsible_user_id = v.responsible_user_id ?? null;
  if ("asset_posting_id" in v) out.asset_posting_id = v.asset_posting_id ?? null;
  if ("listing_id" in v) out.listing_id = v.listing_id ?? null;
  if ("exec_note" in v) out.exec_note = v.exec_note ?? null;
  return out;
};

export function useSavePlanItemExec(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async ({
      itemId,
      values,
      silent,
    }: {
      itemId: string;
      values: Partial<PlanItemExecValues>;
      silent?: boolean;
    }) => {
      const payload = itemExecPayload(values);
      if (Object.keys(payload).length === 0) return { silent };
      const { error } = await (supabase as any).from("auction_plan_items").update(payload).eq("id", itemId);
      if (error) throw new Error(auctionPlanWriteMessage(error));
      return { silent };
    },
    onSuccess: (res) => {
      invalidate();
      if (!res?.silent) toast.success("Đã lưu thông tin thực hiện");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Bỏ / đưa lại tài sản vào kế hoạch.
 *
 * ⚠️ `exec_status` nằm trong nhóm bị guard của DB coi là thay đổi MỐC (A4.6),
 * nên chỉ ghi được khi kế hoạch ở `draft` / `adjusting` — UI phải khoá nút theo
 * `baselineOpen`, đừng để người dùng bấm rồi nhận lỗi tiếng Việt của trigger.
 */
export function useSetPlanItemExecStatus(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async ({ itemId, dropped }: { itemId: string; dropped: boolean }) => {
      const { error } = await (supabase as any)
        .from("auction_plan_items")
        .update({ exec_status: dropped ? "dropped" : "active" })
        .eq("id", itemId);
      if (error) throw new Error(auctionPlanWriteMessage(error));
      return dropped;
    },
    onSuccess: (dropped) => {
      invalidate();
      toast.success(dropped ? "Đã bỏ tài sản khỏi kế hoạch" : "Đã đưa tài sản trở lại kế hoạch");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
