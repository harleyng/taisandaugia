// Đối chiếu BẢN SAO SQL ↔ TS của sức khoẻ tài sản trong kế hoạch (A5).
//
// Mẫu: Trạm demo "UBND tỉnh Bắc Ninh" (`is_demo`), 4 kế hoạch năm 2026 đã duyệt,
// 20 tài sản — đủ 6 nhánh của bảng A5 (done 4 · late 4 · at_risk 4 ·
// failed_retry 2 · on_track 5 · dropped 1), trong đó 6 tài sản có liên kết hồ sơ
// số hoá (6 kết quả phiên) và 14 tài sản KHÔNG có kết quả thực tế (nhánh "chưa
// liên kết ⇒ không có thực tế").
//
// ⚠️ Cập nhật 26/10 (Phase 6, quyết định D8): `auction_plan_item_outcomes` nay
// đọc bộ hợp nhất `owner_outcomes_overview_core`, nên `payment_status` của một
// kết quả KHÔNG THÀNH là NULL (trước đây là 'pending' thô của
// `owner_asset_outcomes`) — tình trạng thu tiền chỉ có nghĩa với dòng đã bán.
// Sức khoẻ của cả 20 tài sản KHÔNG đổi (`failed_retry` cả trước và sau).
//
// `sqlHealth` của mỗi dòng là kết quả THẬT của
// `auction_plan_item_health_rows(plan, DATE '2026-10-26')` chạy trên DB sống
// (migration 20261026130000), chụp lại ngày 2026-10-26. `asOf` CỐ ĐỊNH để mẫu
// không mục theo thời gian.
//
// Đây là cổng chống lệch: sửa luật ở một bên mà quên bên kia thì test này đỏ.
// Sau khi sửa cả hai bên, chụp lại mẫu bằng
// `auction_plan_item_health_rows(p_plan_id, DATE '2026-10-26')`.

import { describe, expect, it } from "vitest";
import { planItemHealth, type PlanItemHealth } from "./health";

const AS_OF = "2026-10-26";

interface ParityRow {
  itemCode: string;
  title: string;
  item: {
    exec_status: "active" | "dropped";
    planned_month: string | null;
    forecast_month: string | null;
    baseline_month: string | null;
  };
  steps: Array<{ sort_order: number; planned_date: string | null; done_on: string | null }>;
  outcome: { outcome: string | null; payment_status: string | null } | null;
  sqlHealth: PlanItemHealth;
}

/** Chụp từ DB sống — xem đầu file. */
const SAMPLE: ParityRow[] = [
  {
    itemCode: "KH26-001",
    title: "Khu dân cư Bắc Giang — lô A",
    item: { exec_status: "active", planned_month: "2026-06-01", forecast_month: null, baseline_month: "2026-06-01" },
    steps: [{sort_order:1,planned_date:"2026-02-13",done_on:"2026-06-07"},{sort_order:2,planned_date:"2026-02-25",done_on:"2026-06-13"},{sort_order:3,planned_date:"2026-03-09",done_on:"2026-06-19"},{sort_order:4,planned_date:"2026-03-21",done_on:"2026-05-17"},{sort_order:5,planned_date:"2026-04-02",done_on:"2026-05-20"},{sort_order:6,planned_date:"2026-04-14",done_on:"2026-07-07"},{sort_order:7,planned_date:"2026-04-26",done_on:"2026-06-15"},{sort_order:8,planned_date:"2026-05-08",done_on:"2026-07-19"},{sort_order:9,planned_date:"2026-05-20",done_on:"2026-07-05"},{sort_order:10,planned_date:"2026-06-01",done_on:"2026-07-31"}],
    outcome: { outcome: "sold", payment_status: "paid" },
    sqlHealth: "done",
  },
  {
    itemCode: "KH26-001",
    title: "Khu dân cư Tân Yên — lô E",
    item: { exec_status: "active", planned_month: "2026-05-01", forecast_month: null, baseline_month: "2026-05-01" },
    steps: [{sort_order:1,planned_date:"2026-01-13",done_on:"2026-04-11"},{sort_order:2,planned_date:"2026-01-25",done_on:"2026-04-11"},{sort_order:3,planned_date:"2026-02-06",done_on:null},{sort_order:4,planned_date:"2026-02-18",done_on:null},{sort_order:5,planned_date:"2026-03-02",done_on:null},{sort_order:6,planned_date:"2026-03-14",done_on:null},{sort_order:7,planned_date:"2026-03-26",done_on:null},{sort_order:8,planned_date:"2026-04-07",done_on:null},{sort_order:9,planned_date:"2026-04-19",done_on:null},{sort_order:10,planned_date:"2026-05-01",done_on:null}],
    outcome: null,
    sqlHealth: "late",
  },
  {
    itemCode: "KH26-001",
    title: "Khu dân cư Việt Yên — lô C",
    item: { exec_status: "active", planned_month: "2026-05-01", forecast_month: null, baseline_month: "2026-05-01" },
    steps: [{sort_order:1,planned_date:"2026-01-13",done_on:"2026-04-11"},{sort_order:2,planned_date:"2026-01-25",done_on:"2026-04-11"},{sort_order:3,planned_date:"2026-02-06",done_on:null},{sort_order:4,planned_date:"2026-02-18",done_on:null},{sort_order:5,planned_date:"2026-03-02",done_on:null},{sort_order:6,planned_date:"2026-03-14",done_on:null},{sort_order:7,planned_date:"2026-03-26",done_on:null},{sort_order:8,planned_date:"2026-04-07",done_on:null},{sort_order:9,planned_date:"2026-04-19",done_on:null},{sort_order:10,planned_date:"2026-05-01",done_on:null}],
    outcome: null,
    sqlHealth: "late",
  },
  {
    itemCode: "KH26-001",
    title: "Khu dân cư mới Vũ Ninh — lô LK1",
    item: { exec_status: "active", planned_month: "2026-06-01", forecast_month: null, baseline_month: "2026-06-01" },
    steps: [{sort_order:1,planned_date:"2026-02-13",done_on:"2026-06-07"},{sort_order:2,planned_date:"2026-02-25",done_on:"2026-06-13"},{sort_order:3,planned_date:"2026-03-09",done_on:"2026-06-19"},{sort_order:4,planned_date:"2026-03-21",done_on:"2026-05-17"},{sort_order:5,planned_date:"2026-04-02",done_on:"2026-05-20"},{sort_order:6,planned_date:"2026-04-14",done_on:"2026-07-07"},{sort_order:7,planned_date:"2026-04-26",done_on:"2026-06-15"},{sort_order:8,planned_date:"2026-05-08",done_on:"2026-07-19"},{sort_order:9,planned_date:"2026-05-20",done_on:"2026-07-05"},{sort_order:10,planned_date:"2026-06-01",done_on:"2026-07-31"}],
    outcome: { outcome: "sold", payment_status: "paid" },
    sqlHealth: "done",
  },
  {
    itemCode: "KH26-002",
    title: "Khu dân cư Bắc Giang — lô B",
    item: { exec_status: "active", planned_month: "2026-08-01", forecast_month: null, baseline_month: "2026-08-01" },
    steps: [{sort_order:1,planned_date:"2026-04-15",done_on:"2026-07-12"},{sort_order:2,planned_date:"2026-04-27",done_on:"2026-07-12"},{sort_order:3,planned_date:"2026-05-09",done_on:null},{sort_order:4,planned_date:"2026-05-21",done_on:null},{sort_order:5,planned_date:"2026-06-02",done_on:null},{sort_order:6,planned_date:"2026-06-14",done_on:null},{sort_order:7,planned_date:"2026-06-26",done_on:null},{sort_order:8,planned_date:"2026-07-08",done_on:null},{sort_order:9,planned_date:"2026-07-20",done_on:null},{sort_order:10,planned_date:"2026-08-01",done_on:null}],
    outcome: null,
    sqlHealth: "late",
  },
  {
    itemCode: "KH26-002",
    title: "Khu dân cư Việt Yên — lô D",
    item: { exec_status: "active", planned_month: "2026-06-01", forecast_month: null, baseline_month: "2026-06-01" },
    steps: [{sort_order:1,planned_date:"2026-02-13",done_on:"2026-06-05"},{sort_order:2,planned_date:"2026-02-25",done_on:"2026-06-09"},{sort_order:3,planned_date:"2026-03-09",done_on:"2026-06-13"},{sort_order:4,planned_date:"2026-03-21",done_on:"2026-06-17"},{sort_order:5,planned_date:"2026-04-02",done_on:"2026-06-21"},{sort_order:6,planned_date:"2026-04-14",done_on:"2026-06-25"},{sort_order:7,planned_date:"2026-04-26",done_on:"2026-06-13"},{sort_order:8,planned_date:"2026-05-08",done_on:null},{sort_order:9,planned_date:"2026-05-20",done_on:null},{sort_order:10,planned_date:"2026-06-01",done_on:null}],
    outcome: { outcome: "unsold", payment_status: null },
    sqlHealth: "failed_retry",
  },
  {
    itemCode: "KH26-002",
    title: "Khu dân cư mới Vũ Ninh — lô LK2",
    item: { exec_status: "active", planned_month: "2026-05-01", forecast_month: null, baseline_month: "2026-05-01" },
    steps: [{sort_order:1,planned_date:"2026-01-13",done_on:"2026-04-11"},{sort_order:2,planned_date:"2026-01-25",done_on:"2026-04-11"},{sort_order:3,planned_date:"2026-02-06",done_on:null},{sort_order:4,planned_date:"2026-02-18",done_on:null},{sort_order:5,planned_date:"2026-03-02",done_on:null},{sort_order:6,planned_date:"2026-03-14",done_on:null},{sort_order:7,planned_date:"2026-03-26",done_on:null},{sort_order:8,planned_date:"2026-04-07",done_on:null},{sort_order:9,planned_date:"2026-04-19",done_on:null},{sort_order:10,planned_date:"2026-05-01",done_on:null}],
    outcome: null,
    sqlHealth: "late",
  },
  {
    itemCode: "KH26-002",
    title: "Đất ở Ngọc Thiện",
    item: { exec_status: "active", planned_month: "2026-07-01", forecast_month: null, baseline_month: "2026-07-01" },
    steps: [{sort_order:1,planned_date:"2026-03-15",done_on:"2026-07-07"},{sort_order:2,planned_date:"2026-03-27",done_on:"2026-07-13"},{sort_order:3,planned_date:"2026-04-08",done_on:"2026-07-19"},{sort_order:4,planned_date:"2026-04-20",done_on:"2026-07-25"},{sort_order:5,planned_date:"2026-05-02",done_on:"2026-07-31"},{sort_order:6,planned_date:"2026-05-14",done_on:"2026-08-06"},{sort_order:7,planned_date:"2026-05-26",done_on:"2026-07-15"},{sort_order:8,planned_date:"2026-06-07",done_on:"2026-08-18"},{sort_order:9,planned_date:"2026-06-19",done_on:"2026-08-04"},{sort_order:10,planned_date:"2026-07-01",done_on:"2026-08-30"}],
    outcome: { outcome: "sold", payment_status: "paid" },
    sqlHealth: "done",
  },
  {
    itemCode: "KH26-003",
    title: "Khu đấu giá Cao Thượng",
    item: { exec_status: "active", planned_month: "2026-11-01", forecast_month: null, baseline_month: "2026-11-01" },
    steps: [{sort_order:1,planned_date:"2026-07-16",done_on:"2026-10-11"},{sort_order:2,planned_date:"2026-07-28",done_on:"2026-10-11"},{sort_order:3,planned_date:"2026-10-31",done_on:null},{sort_order:4,planned_date:"2026-10-31",done_on:null},{sort_order:5,planned_date:"2026-10-31",done_on:null},{sort_order:6,planned_date:"2026-10-31",done_on:null},{sort_order:7,planned_date:"2026-10-31",done_on:null},{sort_order:8,planned_date:"2026-10-31",done_on:null},{sort_order:9,planned_date:"2026-10-31",done_on:null},{sort_order:10,planned_date:"2026-11-01",done_on:null}],
    outcome: null,
    sqlHealth: "on_track",
  },
  {
    itemCode: "KH26-003",
    title: "Đất ở Bích Động",
    item: { exec_status: "active", planned_month: "2026-07-01", forecast_month: null, baseline_month: "2026-07-01" },
    steps: [{sort_order:1,planned_date:"2026-03-15",done_on:"2026-07-07"},{sort_order:2,planned_date:"2026-03-27",done_on:"2026-07-13"},{sort_order:3,planned_date:"2026-04-08",done_on:"2026-07-19"},{sort_order:4,planned_date:"2026-04-20",done_on:"2026-07-25"},{sort_order:5,planned_date:"2026-05-02",done_on:"2026-07-31"},{sort_order:6,planned_date:"2026-05-14",done_on:"2026-08-06"},{sort_order:7,planned_date:"2026-05-26",done_on:"2026-07-15"},{sort_order:8,planned_date:"2026-06-07",done_on:"2026-08-18"},{sort_order:9,planned_date:"2026-06-19",done_on:"2026-08-04"},{sort_order:10,planned_date:"2026-07-01",done_on:"2026-08-30"}],
    outcome: { outcome: "sold", payment_status: "paid" },
    sqlHealth: "done",
  },
  {
    itemCode: "KH26-003",
    title: "Đất ở Thọ Xương",
    item: { exec_status: "active", planned_month: "2026-11-01", forecast_month: null, baseline_month: "2026-11-01" },
    steps: [{sort_order:1,planned_date:"2026-07-16",done_on:"2026-10-11"},{sort_order:2,planned_date:"2026-07-28",done_on:"2026-10-11"},{sort_order:3,planned_date:"2026-10-31",done_on:null},{sort_order:4,planned_date:"2026-10-31",done_on:null},{sort_order:5,planned_date:"2026-10-31",done_on:null},{sort_order:6,planned_date:"2026-10-31",done_on:null},{sort_order:7,planned_date:"2026-10-31",done_on:null},{sort_order:8,planned_date:"2026-10-31",done_on:null},{sort_order:9,planned_date:"2026-10-31",done_on:null},{sort_order:10,planned_date:"2026-11-01",done_on:null}],
    outcome: null,
    sqlHealth: "on_track",
  },
  {
    itemCode: "KH26-003",
    title: "Đất ở xen kẹp tổ 4 Vũ Ninh",
    item: { exec_status: "active", planned_month: "2026-07-01", forecast_month: null, baseline_month: "2026-07-01" },
    steps: [{sort_order:1,planned_date:"2026-03-15",done_on:"2026-07-05"},{sort_order:2,planned_date:"2026-03-27",done_on:"2026-07-09"},{sort_order:3,planned_date:"2026-04-08",done_on:"2026-07-13"},{sort_order:4,planned_date:"2026-04-20",done_on:"2026-07-17"},{sort_order:5,planned_date:"2026-05-02",done_on:"2026-07-21"},{sort_order:6,planned_date:"2026-05-14",done_on:"2026-07-25"},{sort_order:7,planned_date:"2026-05-26",done_on:"2026-07-13"},{sort_order:8,planned_date:"2026-06-07",done_on:null},{sort_order:9,planned_date:"2026-06-19",done_on:null},{sort_order:10,planned_date:"2026-07-01",done_on:null}],
    outcome: { outcome: "unsold", payment_status: null },
    sqlHealth: "failed_retry",
  },
  {
    itemCode: "KH26-004",
    title: "Khu tái định cư Dĩnh Kế — phần còn lại",
    item: { exec_status: "active", planned_month: "2026-12-01", forecast_month: "2027-03-01", baseline_month: "2026-12-01" },
    steps: [{sort_order:1,planned_date:"2026-10-17",done_on:null},{sort_order:2,planned_date:"2026-08-27",done_on:null},{sort_order:3,planned_date:"2026-09-08",done_on:null},{sort_order:4,planned_date:"2026-09-20",done_on:null},{sort_order:5,planned_date:"2026-10-02",done_on:null},{sort_order:6,planned_date:"2026-10-14",done_on:null},{sort_order:7,planned_date:"2026-10-26",done_on:null},{sort_order:8,planned_date:"2026-11-07",done_on:null},{sort_order:9,planned_date:"2026-11-19",done_on:null},{sort_order:10,planned_date:"2026-12-01",done_on:null}],
    outcome: null,
    sqlHealth: "at_risk",
  },
  {
    itemCode: "KH26-004",
    title: "Khu đấu giá Nếnh — đợt 1",
    item: { exec_status: "active", planned_month: "2026-11-01", forecast_month: null, baseline_month: "2026-11-01" },
    steps: [{sort_order:1,planned_date:"2026-07-16",done_on:"2026-10-11"},{sort_order:2,planned_date:"2026-07-28",done_on:"2026-10-11"},{sort_order:3,planned_date:"2026-10-31",done_on:null},{sort_order:4,planned_date:"2026-10-31",done_on:null},{sort_order:5,planned_date:"2026-10-31",done_on:null},{sort_order:6,planned_date:"2026-10-31",done_on:null},{sort_order:7,planned_date:"2026-10-31",done_on:null},{sort_order:8,planned_date:"2026-10-31",done_on:null},{sort_order:9,planned_date:"2026-10-31",done_on:null},{sort_order:10,planned_date:"2026-11-01",done_on:null}],
    outcome: null,
    sqlHealth: "on_track",
  },
  {
    itemCode: "KH26-004",
    title: "Khu đấu giá Đồng Mạ — đợt 1",
    item: { exec_status: "active", planned_month: "2026-11-01", forecast_month: null, baseline_month: "2026-11-01" },
    steps: [{sort_order:1,planned_date:"2026-07-16",done_on:"2026-10-11"},{sort_order:2,planned_date:"2026-07-28",done_on:"2026-10-11"},{sort_order:3,planned_date:"2026-10-31",done_on:null},{sort_order:4,planned_date:"2026-10-31",done_on:null},{sort_order:5,planned_date:"2026-10-31",done_on:null},{sort_order:6,planned_date:"2026-10-31",done_on:null},{sort_order:7,planned_date:"2026-10-31",done_on:null},{sort_order:8,planned_date:"2026-10-31",done_on:null},{sort_order:9,planned_date:"2026-10-31",done_on:null},{sort_order:10,planned_date:"2026-11-01",done_on:null}],
    outcome: null,
    sqlHealth: "on_track",
  },
  {
    itemCode: "KH26-004",
    title: "Đất ở Quang Tiến",
    item: { exec_status: "active", planned_month: "2026-12-01", forecast_month: "2027-03-01", baseline_month: "2026-12-01" },
    steps: [{sort_order:1,planned_date:"2026-10-17",done_on:null},{sort_order:2,planned_date:"2026-08-27",done_on:null},{sort_order:3,planned_date:"2026-09-08",done_on:null},{sort_order:4,planned_date:"2026-09-20",done_on:null},{sort_order:5,planned_date:"2026-10-02",done_on:null},{sort_order:6,planned_date:"2026-10-14",done_on:null},{sort_order:7,planned_date:"2026-10-26",done_on:null},{sort_order:8,planned_date:"2026-11-07",done_on:null},{sort_order:9,planned_date:"2026-11-19",done_on:null},{sort_order:10,planned_date:"2026-12-01",done_on:null}],
    outcome: null,
    sqlHealth: "at_risk",
  },
  {
    itemCode: "KH26-005",
    title: "Khu đấu giá Nếnh — đợt 2",
    item: { exec_status: "active", planned_month: "2026-12-01", forecast_month: "2027-03-01", baseline_month: "2026-12-01" },
    steps: [{sort_order:1,planned_date:"2026-10-17",done_on:null},{sort_order:2,planned_date:"2026-08-27",done_on:null},{sort_order:3,planned_date:"2026-09-08",done_on:null},{sort_order:4,planned_date:"2026-09-20",done_on:null},{sort_order:5,planned_date:"2026-10-02",done_on:null},{sort_order:6,planned_date:"2026-10-14",done_on:null},{sort_order:7,planned_date:"2026-10-26",done_on:null},{sort_order:8,planned_date:"2026-11-07",done_on:null},{sort_order:9,planned_date:"2026-11-19",done_on:null},{sort_order:10,planned_date:"2026-12-01",done_on:null}],
    outcome: null,
    sqlHealth: "at_risk",
  },
  {
    itemCode: "KH26-005",
    title: "Khu đấu giá Đồng Mạ — đợt 2",
    item: { exec_status: "active", planned_month: "2026-12-01", forecast_month: "2027-03-01", baseline_month: "2026-12-01" },
    steps: [{sort_order:1,planned_date:"2026-10-17",done_on:null},{sort_order:2,planned_date:"2026-08-27",done_on:null},{sort_order:3,planned_date:"2026-09-08",done_on:null},{sort_order:4,planned_date:"2026-09-20",done_on:null},{sort_order:5,planned_date:"2026-10-02",done_on:null},{sort_order:6,planned_date:"2026-10-14",done_on:null},{sort_order:7,planned_date:"2026-10-26",done_on:null},{sort_order:8,planned_date:"2026-11-07",done_on:null},{sort_order:9,planned_date:"2026-11-19",done_on:null},{sort_order:10,planned_date:"2026-12-01",done_on:null}],
    outcome: null,
    sqlHealth: "at_risk",
  },
  {
    itemCode: "KH26-005",
    title: "Đất ở Đa Mai (chuyển sang năm sau)",
    item: { exec_status: "dropped", planned_month: "2026-09-01", forecast_month: null, baseline_month: "2026-09-01" },
    steps: [{sort_order:1,planned_date:"2026-05-16",done_on:null},{sort_order:2,planned_date:"2026-05-28",done_on:null},{sort_order:3,planned_date:"2026-06-09",done_on:null},{sort_order:4,planned_date:"2026-06-21",done_on:null},{sort_order:5,planned_date:"2026-07-03",done_on:null},{sort_order:6,planned_date:"2026-07-15",done_on:null},{sort_order:7,planned_date:"2026-07-27",done_on:null},{sort_order:8,planned_date:"2026-08-08",done_on:null},{sort_order:9,planned_date:"2026-08-20",done_on:null},{sort_order:10,planned_date:"2026-09-01",done_on:null}],
    outcome: null,
    sqlHealth: "dropped",
  },
  {
    itemCode: "KH26-006",
    title: "Nhà làm việc cũ UBND phường (tài sản công)",
    item: { exec_status: "active", planned_month: "2026-12-01", forecast_month: null, baseline_month: "2026-12-01" },
    steps: [{sort_order:2,planned_date:"2026-08-27",done_on:"2026-10-11"},{sort_order:3,planned_date:"2026-10-31",done_on:null},{sort_order:4,planned_date:"2026-10-31",done_on:null},{sort_order:5,planned_date:"2026-10-31",done_on:null},{sort_order:6,planned_date:"2026-10-31",done_on:null},{sort_order:7,planned_date:"2026-10-31",done_on:null},{sort_order:8,planned_date:"2026-11-07",done_on:null},{sort_order:9,planned_date:"2026-11-19",done_on:null}],
    outcome: null,
    sqlHealth: "on_track",
  },
];

describe("auction_plan_item_health (SQL) ↔ planItemHealth (TS)", () => {
  it("mẫu demo có cả 6 nhánh của bảng A5", () => {
    const seen = new Set(SAMPLE.map((r) => r.sqlHealth));
    expect([...seen].sort()).toEqual(["at_risk", "done", "dropped", "failed_retry", "late", "on_track"]);
    expect(SAMPLE).toHaveLength(20);
    expect(SAMPLE.filter((r) => r.outcome === null)).toHaveLength(14);
  });

  it.each(SAMPLE.map((r) => [`${r.itemCode} · ${r.title}`, r] as const))("%s", (_name, row) => {
    expect(planItemHealth(row.item, row.steps, row.outcome, AS_OF)).toBe(row.sqlHealth);
  });

  it("khớp 100% trên toàn mẫu", () => {
    const mismatched = SAMPLE.filter((r) => planItemHealth(r.item, r.steps, r.outcome, AS_OF) !== r.sqlHealth);
    expect(mismatched.map((r) => r.itemCode)).toEqual([]);
  });
});
