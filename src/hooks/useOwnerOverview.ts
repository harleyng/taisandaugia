import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerPulse } from "@/hooks/useOwnerPulse";
import { useOwnerTargetProgress } from "@/hooks/useOwnerTargets";
import { useOwnerOutcomesOverview } from "@/hooks/useOwnerOutcomesOverview";
import { useOwnerListingRegistrations } from "@/hooks/useOwnerListingRegistrations";
import { pushCandidateNote, pushMarketingCandidates } from "@/lib/ownerMarketing/pushCandidates";
import { NEW_CAMPAIGN_HREF } from "@/lib/ownerMarketing/routes";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { todayIso } from "@/lib/ownerOutcomeReport";
import {
  SCOPE_ALL,
  TARGET_PERIOD_TYPES,
  recoveryOf,
  targetScopeOf,
  type TargetPeriodType,
} from "@/lib/ownerTargets";
import {
  assetScopeFilter,
  cumulativeWinByWeek,
  daysSince,
  overviewKpis,
  overviewWindow,
  rowInScope,
  stuckAsOf,
  summarizeTodo,
  upcomingCalendar,
  type TodoSummary,
} from "@/lib/ownerOverview";

/** Kiểu (không phải interface) để gán được vào Record<string, string> của useUrlFilterState. */
type OverviewFilterValues = { scope: string; period: string };

/** Tài sản chờ xác nhận — cần ngày tạo claim để biết đã chờ bao lâu. */
function usePendingClaims(workspaceId: string | null) {
  return useQuery({
    // Giữ key cũ: useAssetOwnerWorkspace invalidate key này khi xác nhận / từ chối claim.
    queryKey: ["pending-claims-dashboard", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select("id, created_at, asset_owner_id, listing:listings(id, title, price)")
        .eq("workspace_id", workspaceId!)
        .eq("status", "pending_confirmation");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60_000,
  });
}

/**
 * 4 danh sách việc của khối "Việc cần làm", đã lọc theo phạm vi đơn vị. "Chờ thu tiền" là
 * useOwnerPulse().awaitingPayment — đúng danh sách huy hiệu "Thu tiền" ở menu đếm, nên hai
 * số luôn khớp (khi lọc Toàn đơn vị).
 */
function useOwnerTodoSources(assetInScope: (assetOwnerId: string | null) => boolean) {
  const { workspaceId } = useOwnerWorkspace();
  const pulse = useOwnerPulse();
  const claims = usePendingClaims(workspaceId);

  const isLoading = pulse.isLoading || claims.isLoading;
  return useMemo(
    () => ({
      outcomeDue: pulse.outcomeDue.filter((i) => assetInScope(i.assetOwnerId)),
      awaitingPayment: pulse.awaitingPayment.filter((i) => assetInScope(i.assetOwnerId)),
      pendingConfirmation: (claims.data ?? []).flatMap((c) =>
        c.listing && assetInScope(c.asset_owner_id) ? [{ ...c, listing: c.listing }] : [],
      ),
      stuck: pulse.metrics.pendingAssets.filter((l) => assetInScope(l.assetOwnerId)),
      isLoading,
    }),
    [pulse.outcomeDue, pulse.awaitingPayment, pulse.metrics.pendingAssets, claims.data, assetInScope, isLoading],
  );
}

/**
 * Mọi số liệu của trang "Tổng quan" theo bộ lọc Đơn vị + Kỳ trên đầu trang (lưu
 * trên URL). Dùng lại cache của Nhịp đập, Chỉ tiêu và Kết quả phiên — không tải thêm
 * gì ngoài danh sách claim chờ xác nhận.
 */
export function useOwnerOverview() {
  const { workspaceId, isLoading: workspaceLoading, can } = useOwnerWorkspace();
  const pulse = useOwnerPulse();
  // "Đẩy truyền thông" chỉ hiện cho người soạn được chiến dịch.
  const canPush = can("truyen-thong", "create");
  const registrations = useOwnerListingRegistrations(workspaceId, canPush);
  const targets = useOwnerTargetProgress();
  const outcomes = useOwnerOutcomesOverview(workspaceId);
  const today = useMemo(() => todayIso(), []);

  const { branches, progress, preferredBranchIds } = targets;
  // Cán bộ bị giới hạn chi nhánh mở sẵn chi nhánh của mình; kỳ mở sẵn theo chỉ tiêu đầu tiên của phạm vi.
  const defaultScope = preferredBranchIds.find((id) => branches.some((b) => b.id === id)) ?? SCOPE_ALL;
  const defaultPeriod = progress.find((p) => targetScopeOf(p.target) === defaultScope)?.target.periodType ?? "month";
  const [filters, , setFilters] = useUrlFilterState<OverviewFilterValues>(
    { scope: defaultScope, period: defaultPeriod },
    { scope: [SCOPE_ALL, ...branches.map((b) => b.id)], period: TARGET_PERIOD_TYPES },
  );
  const scope = filters.scope;
  const periodType = filters.period as TargetPeriodType;

  const span = useMemo(() => overviewWindow(periodType, today), [periodType, today]);
  const assetInScope = useMemo(() => assetScopeFilter(scope, branches), [scope, branches]);

  const rows = useMemo(() => outcomes.rows.filter((r) => rowInScope(r.branchId, scope)), [outcomes.rows, scope]);
  const outcomeByListing = useMemo(
    () => new Map(outcomes.rows.flatMap((r) => (r.listingId ? [[r.listingId, r] as const] : []))),
    [outcomes.rows],
  );
  const listings = useMemo(
    () => pulse.metrics.allListings.filter((l) => assetInScope(l.assetOwnerId)),
    [pulse.metrics.allListings, assetInScope],
  );
  const todoSources = useOwnerTodoSources(assetInScope);
  const stuckNow = todoSources.stuck;

  // Khối Tổng quan chỉ vẽ tiền thu hồi / tài sản đấu thành ⇒ bỏ qua chỉ tiêu không có 2 tiêu chí đó.
  const target =
    progress.find(
      (p) =>
        targetScopeOf(p.target) === scope &&
        p.target.periodType === periodType &&
        (p.target.targetAmount !== null || p.target.targetCount !== null),
    ) ?? null;

  const chart = useMemo(() => cumulativeWinByWeek(rows, span), [rows, span]);

  const kpis = useMemo(() => {
    const history = listings.map((l) => {
      const o = outcomeByListing.get(l.id);
      return { sessionDays: l.priceHistory.map((h) => h.date), soldOn: o?.outcome === "sold" ? o.date : null };
    });
    return overviewKpis(rows, span, { now: stuckNow.length, lastYear: stuckAsOf(history, span.prevToday) });
  }, [rows, span, listings, stuckNow, outcomeByListing]);

  const todos = useMemo<TodoSummary[]>(() => {
    const outcomeDue = todoSources.outcomeDue.map((i) => ({
      title: i.title,
      days: i.daysOverdue,
      amount: i.startingPrice,
    }));

    // Số còn phải thu theo đúng luật của Chỉ tiêu (thu một phần ⇒ giá trúng − đã thu).
    const awaitingPayment = todoSources.awaitingPayment.map((i) => ({
      title: i.title,
      days: daysSince(i.auctionDay, today),
      amount: recoveryOf({
        day: null,
        branchId: null,
        price: i.winningPrice,
        paymentStatus: i.paymentStatus,
        paidAmount: outcomeByListing.get(i.listingId)?.paidAmount ?? null,
      }).awaiting,
    }));

    const pendingConfirmation = todoSources.pendingConfirmation.map((c) => ({
      title: c.listing.title,
      days: daysSince(c.created_at, today),
      amount: Number(c.listing.price ?? 0),
    }));

    // Tồn đọng: tính tuổi từ phiên đầu tiên (lịch sử phiên xếp tăng dần theo ngày).
    const stuck = todoSources.stuck.map((l) => ({
      title: l.title,
      days: daysSince(l.priceHistory[0]?.date, today),
      amount: l.price,
    }));

    // Đẩy truyền thông: đã sắp sẵn — tài sản đứng đầu là lối vào trình soạn.
    const push = canPush ? pushMarketingCandidates(listings, registrations.byListing, today) : [];
    const pushSummary: TodoSummary = {
      kind: "push_marketing",
      count: push.length,
      amount: push.reduce((n, c) => n + (c.price > 0 ? c.price : 0), 0),
      oldestTitle: push[0] ? pushCandidateNote(push[0]) : null,
      href: push[0] ? `${NEW_CAMPAIGN_HREF}?tai-san=${encodeURIComponent(push[0].listingId)}` : undefined,
    };

    return [
      summarizeTodo("outcome_due", outcomeDue),
      summarizeTodo("awaiting_payment", awaitingPayment),
      summarizeTodo("pending_confirmation", pendingConfirmation),
      summarizeTodo("stuck", stuck),
      pushSummary,
    ];
  }, [todoSources, outcomeByListing, today, canPush, listings, registrations.byListing]);

  const calendar = useMemo(() => upcomingCalendar(listings, today), [listings, today]);

  return {
    workspaceId,
    workspaceLoading,
    scope,
    periodType,
    setFilters,
    branches,
    canManage: targets.canManage,
    today,
    span,
    target,
    chart,
    kpis,
    todos,
    calendar,
    analysisError: outcomes.isError,
    retryAnalysis: outcomes.refetch,
    loading: {
      target: targets.isLoading,
      analysis: outcomes.isLoading || pulse.isLoading,
      todo: todoSources.isLoading || outcomes.isLoading || registrations.isLoading,
      calendar: pulse.isLoading,
    },
  };
}
