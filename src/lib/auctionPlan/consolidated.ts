// Danh mục hợp nhất toàn tỉnh (Phase 7): kiểu dòng của `auction_plan_consolidated`
// và phép GOM theo đơn vị hành chính dùng cho bản in + Excel.
//
// Nguồn số liệu là BẢN MỐC đã đóng băng của từng kế hoạch — RPC lo việc đó. Ở đây
// chỉ gom nhóm và cộng tổng, dùng lại `planPrintRows` / `planItemTotals` của
// Phase 3-4 để bảng bảy cột của tỉnh và của xã không bao giờ lệch nhau.

import { planPrintRows, type PlanPrintRow } from "./print";
import { planItemTotals, type PlanTotals } from "./totals";
import type {
  AuctionPlanAssetType,
  AuctionPlanBaselinePayload,
  AuctionPlanStatus,
} from "./types";

/** Một dòng `auction_plan_consolidated` — khớp 1:1 cột của RPC. */
export interface ConsolidatedItemRow {
  admin_unit_code: string;
  unit_name: string;
  unit_level: "province" | "commune";
  plan_id: string;
  plan_title: string | null;
  plan_kind: "annual" | "supplement";
  plan_level: string;
  plan_status: AuctionPlanStatus;
  baseline_version: number;
  approval_doc_no: string | null;
  approval_doc_date: string | null;
  seq: number | null;
  item_code: string | null;
  asset_type: AuctionPlanAssetType | null;
  title: string | null;
  lot_labels: string | null;
  lot_count: number | null;
  map_sheet: string | null;
  parcel_no: string | null;
  location: string | null;
  area_m2: number | null;
  land_use_code: string | null;
  allocation_form: string | null;
  unit_start_price: number | null;
  expected_start_value: number | null;
  planned_month: string | null;
  planned_method: string | null;
  executing_unit: string | null;
}

export interface ConsolidatedUnit {
  code: string;
  unitName: string;
  unitLevel: "province" | "commune";
  /** Các kế hoạch của đơn vị đó (một đơn vị có thể có kế hoạch năm + bổ sung). */
  plans: Array<{
    planId: string;
    planKind: "annual" | "supplement";
    baselineVersion: number;
    approvalDocNo: string | null;
    approvalDocDate: string | null;
  }>;
  /** Dòng bảng bảy cột — CÙNG hàm dựng với bản in của một kế hoạch. */
  rows: PlanPrintRow[];
  totals: PlanTotals;
}

/**
 * Gom dòng hợp nhất theo đơn vị hành chính, giữ nguyên thứ tự RPC trả về
 * (cấp tỉnh trước, rồi xã theo tên; trong mỗi đơn vị: kế hoạch năm trước, theo STT).
 *
 * STT trong bảng in của mỗi đơn vị được ĐÁNH LẠI từ 1 (`planPrintRows`), vì tờ
 * giấy của tỉnh in một bảng cho mỗi xã.
 */
export function consolidatedByUnit(rows: readonly ConsolidatedItemRow[]): ConsolidatedUnit[] {
  const order: string[] = [];
  const bucket = new Map<string, ConsolidatedItemRow[]>();
  for (const r of rows) {
    if (!bucket.has(r.admin_unit_code)) {
      bucket.set(r.admin_unit_code, []);
      order.push(r.admin_unit_code);
    }
    bucket.get(r.admin_unit_code)!.push(r);
  }

  return order.map((code) => {
    const items = bucket.get(code)!;
    const first = items[0];
    const planSeen = new Map<string, ConsolidatedUnit["plans"][number]>();
    for (const i of items) {
      if (!planSeen.has(i.plan_id)) {
        planSeen.set(i.plan_id, {
          planId: i.plan_id,
          planKind: i.plan_kind,
          baselineVersion: i.baseline_version,
          approvalDocNo: i.approval_doc_no,
          approvalDocDate: i.approval_doc_date,
        });
      }
    }
    return {
      code,
      unitName: first.unit_name,
      unitLevel: first.unit_level,
      plans: [...planSeen.values()],
      rows: planPrintRows(
        items.map<AuctionPlanBaselinePayload["items"][number]>((i, index) => ({
          id: `${i.plan_id}:${i.item_code ?? index}`,
          seq: i.seq ?? index + 1,
          item_code: i.item_code ?? "",
          asset_type: i.asset_type ?? "land_use_right",
          title: i.title ?? "",
          lot_labels: i.lot_labels,
          lot_count: i.lot_count,
          map_sheet: i.map_sheet,
          parcel_no: i.parcel_no,
          location: i.location,
          area_m2: i.area_m2,
          land_use_code: i.land_use_code,
          allocation_form: null,
          unit_start_price: i.unit_start_price,
          expected_start_value: i.expected_start_value,
          planned_month: i.planned_month,
          planned_method: "chua_xac_dinh",
          executing_unit: i.executing_unit,
        })),
      ),
      totals: planItemTotals(
        items.map((i) => ({
          planned_month: i.planned_month,
          area_m2: i.area_m2,
          expected_start_value: i.expected_start_value,
          exec_status: "active" as const,
        })),
      ),
    };
  });
}

/** Tổng của cả tỉnh — vẫn là `planItemTotals`, chỉ gọi trên TOÀN BỘ dòng. */
export function consolidatedTotals(rows: readonly ConsolidatedItemRow[]): PlanTotals {
  return planItemTotals(
    rows.map((i) => ({
      planned_month: i.planned_month,
      area_m2: i.area_m2,
      expected_start_value: i.expected_start_value,
      exec_status: "active" as const,
    })),
  );
}
