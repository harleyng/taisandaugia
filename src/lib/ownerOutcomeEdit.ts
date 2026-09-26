// Sửa một lượt đã khai + dựng target "khai lượt tiếp theo" (Phase 8).
// Thuần — dùng chung schema / toOutcomeInsert của ownerOutcomeReport.ts để luật
// lý do / số người tham gia chỉ viết một chỗ.

import type { Database } from "@/integrations/supabase/types";
import { UNSOLD_REASONS, type UnsoldReason } from "@/lib/ownerOutcomes";
import type { OutcomeOverviewRow } from "@/lib/ownerOutcomesOverview";
import {
  VOID_OUTCOMES,
  toOutcomeInsert,
  type OutcomeDialogTarget,
  type ReportOutcomeForm,
  type VoidOutcome,
} from "@/lib/ownerOutcomeReport";

export type OwnerOutcomeRecord = Database["public"]["Tables"]["owner_asset_outcomes"]["Row"];
export type OwnerOutcomeUpdate = Database["public"]["Tables"]["owner_asset_outcomes"]["Update"];

const isUnsoldCode = (v: string | null): v is UnsoldReason =>
  !!v && (UNSOLD_REASONS as readonly string[]).includes(v);
const isVoid = (v: string): v is VoidOutcome => (VOID_OUTCOMES as readonly string[]).includes(v);

/** Bản ghi ⇒ target của dialog (tên tin trên sàn truyền vào vì bản ghi không lưu). */
export function recordToTarget(r: OwnerOutcomeRecord, listingTitle = "Tài sản"): OutcomeDialogTarget {
  if (r.listing_id) {
    return {
      listingId: r.listing_id,
      title: listingTitle,
      startingPrice: r.starting_price,
      auctionTime: r.auction_date,
    };
  }
  return {
    kind: "offplatform",
    title: r.asset_title ?? "",
    titleKey: r.title_key,
    assetCategory: r.asset_category,
    auctionOrgId: r.auction_org_id,
    branchId: r.branch_id,
    startingPrice: r.starting_price,
  };
}

/** Giá trị form khi mở dialog ở chế độ sửa. */
export function recordToFormDefaults(r: OwnerOutcomeRecord): ReportOutcomeForm {
  const reason = r.failure_reason;
  const kind = r.outcome === "sold" ? "sold" : r.outcome === "unsold" ? "unsold" : "void";
  let unsoldReason: UnsoldReason | null = null;
  let note = "";
  if (kind === "unsold") {
    unsoldReason = isUnsoldCode(reason) ? reason : reason ? "other" : null;
    if (!isUnsoldCode(reason) && reason) note = reason;
  } else if (kind === "void") {
    note = reason ?? "";
  }
  const base: ReportOutcomeForm = {
    kind,
    roundNo: String(r.round_no),
    auctionDate: r.auction_date,
    winningPrice: r.winning_price ? String(Math.round(r.winning_price)) : "",
    participants: kind === "sold" && r.participants !== null ? String(r.participants) : "",
    unsoldReason,
    voidOutcome: isVoid(r.outcome) ? r.outcome : "postponed",
    note,
  };
  if (r.listing_id) return base;
  return {
    ...base,
    assetTitle: r.asset_title ?? "",
    assetCategory: r.asset_category,
    auctionOrgId: r.auction_org_id,
    branchId: r.branch_id,
    startingPrice: r.starting_price ? String(Math.round(r.starting_price)) : "",
  };
}

/**
 * Dòng UPDATE khi sửa. Tin trên sàn: không đổi tin, giá khởi điểm, chi nhánh
 * (server suy từ claim). Đổi kết quả/giá/lượt/ngày ⇒ server tự huỷ quyết định
 * xử lý lệch cũ (trigger owner_asset_outcomes_guard_scope).
 */
export function toOutcomeUpdate(form: ReportOutcomeForm, r: OwnerOutcomeRecord): OwnerOutcomeUpdate {
  const ins = toOutcomeInsert(form, {
    id: r.id,
    workspaceId: r.workspace_id,
    target: recordToTarget(r),
    reportedBy: r.reported_by,
  });
  const patch: OwnerOutcomeUpdate = {
    round_no: ins.round_no,
    auction_date: ins.auction_date,
    outcome: ins.outcome,
    failure_reason: ins.failure_reason,
    winning_price: ins.winning_price,
    participants: ins.participants,
  };
  if (r.listing_id) return patch;
  return {
    ...patch,
    asset_title: ins.asset_title,
    asset_category: ins.asset_category,
    auction_org_id: ins.auction_org_id,
    branch_id: ins.branch_id,
    starting_price: ins.starting_price,
  };
}

/** Dòng "Kết quả phiên" ⇒ target khai lượt tiếp theo (ưu tiên bản ghi mới nhất nếu đã tải). */
export function overviewRowToTarget(
  row: OutcomeOverviewRow,
  latest?: OwnerOutcomeRecord | null,
): OutcomeDialogTarget {
  if (row.listingId) {
    return { listingId: row.listingId, title: row.title, startingPrice: row.startingPrice, auctionTime: null };
  }
  return {
    kind: "offplatform",
    title: row.title,
    titleKey: row.titleKey,
    assetCategory: latest?.asset_category ?? row.category,
    auctionOrgId: latest?.auction_org_id ?? null,
    branchId: latest?.branch_id ?? row.branchId,
    startingPrice: latest?.starting_price ?? row.startingPrice,
  };
}
