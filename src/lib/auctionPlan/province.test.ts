// Luật thuần của màn "Toàn tỉnh" (Phase 7).
//
// Mẫu là BẢN CHỤP THẬT của `auction_plan_rollup('d10ba07b…', 2026, 'year',
// '2026-01-01')` trên Trạm demo "UBND tỉnh Bắc Ninh" (26/10/2026) — bốn xã, đợt
// năm ĐÃ ĐÓNG + đợt bổ sung ĐANG MỞ mà chưa xã nào lập kế hoạch cho nó. Nhờ vậy
// test này đồng thời là bằng chứng của tiêu chí nghiệm thu "xã chưa trình còn ở
// tầng L2 cho tới khi trình".
//
// Con số đối chiếu với tổng của tỉnh: 19 tài sản theo kế hoạch · 4 đấu thành ·
// tổng giá trúng 123.687.600.000 ₫ = đã thu · chỉ tiêu giao 225.000.000.000 ₫.

import { describe, expect, it } from "vitest";
import {
  communeRows,
  defaultSortDir,
  deadlineNote,
  provinceAttention,
  provinceSummary,
  sortProvinceRows,
  unitStatusLabel,
  type ProvinceRollupRow,
} from "./province";

const base: ProvinceRollupRow = {
  admin_unit_code: "00000",
  unit_name: "Xã mẫu",
  unit_level: "commune",
  shape: "branch",
  branch_id: "b",
  child_workspace_id: null,
  in_cycle: true,
  cycle_id: "c-supplement",
  cycle_kind: "supplement",
  cycle_status: "open",
  submit_deadline: "2026-11-16",
  cycle_plan_id: null,
  cycle_plan_status: null,
  assigned_revenue: 0,
  assigned_count: 0,
  plan_count: 1,
  plan_id: "p",
  plan_status: "approved",
  plan_statuses: ["approved"],
  has_submitted: true,
  is_returned: false,
  period_type: "year",
  period_start: "2026-01-01",
  period_end: "2026-12-31",
  planned_count: 0,
  planned_start_value: 0,
  offered_count: 0,
  sold_count: 0,
  actual_start_value: 0,
  winning_total: 0,
  collected: 0,
  recorded: 0,
  estimated: 0,
  awaiting: 0,
  done_pct: null,
  late_count: 0,
  at_risk_count: 0,
  last_update: "2026-10-26T11:51:33.745306+00:00",
};

/** Bản chụp thật của Trạm demo — bốn xã Bắc Ninh, kỳ "năm 2026". */
const ROWS: ProvinceRollupRow[] = [
  {
    ...base,
    admin_unit_code: "07210",
    unit_name: "Phường Bắc Giang",
    assigned_revenue: 45_000_000_000,
    assigned_count: 7,
    planned_count: 4,
    planned_start_value: 86_660_000_000,
    offered_count: 1,
    sold_count: 1,
    actual_start_value: 46_080_000_000,
    winning_total: 54_374_400_000,
    collected: 54_374_400_000,
    recorded: 54_374_400_000,
    done_pct: 25,
    late_count: 1,
    at_risk_count: 1,
  },
  {
    ...base,
    admin_unit_code: "07777",
    unit_name: "Phường Việt Yên",
    assigned_revenue: 90_000_000_000,
    assigned_count: 9,
    planned_count: 6,
    planned_start_value: 138_610_000_000,
    offered_count: 2,
    sold_count: 1,
    actual_start_value: 41_940_000_000,
    winning_total: 27_682_800_000,
    collected: 27_682_800_000,
    recorded: 27_682_800_000,
    done_pct: 16,
    late_count: 1,
    at_risk_count: 1,
  },
  {
    ...base,
    admin_unit_code: "09169",
    unit_name: "Phường Vũ Ninh",
    assigned_revenue: 60_000_000_000,
    assigned_count: 8,
    planned_count: 5,
    planned_start_value: 94_355_500_000,
    offered_count: 2,
    sold_count: 1,
    actual_start_value: 34_135_500_000,
    winning_total: 31_718_400_000,
    collected: 31_718_400_000,
    recorded: 31_718_400_000,
    done_pct: 20,
    late_count: 1,
    at_risk_count: 1,
  },
  {
    ...base,
    admin_unit_code: "07339",
    unit_name: "Xã Tân Yên",
    assigned_revenue: 30_000_000_000,
    assigned_count: 6,
    planned_count: 4,
    planned_start_value: 39_860_000_000,
    offered_count: 1,
    sold_count: 1,
    actual_start_value: 8_400_000_000,
    winning_total: 9_912_000_000,
    collected: 9_912_000_000,
    recorded: 9_912_000_000,
    done_pct: 25,
    late_count: 1,
    at_risk_count: 1,
  },
];

describe("provinceSummary", () => {
  it("cộng đúng tổng của tỉnh từ bản chụp thật", () => {
    const s = provinceSummary(ROWS);
    expect(s.unitCount).toBe(4);
    expect(s.plannedCount).toBe(19);
    expect(s.soldCount).toBe(4);
    expect(s.winningTotal).toBe(123_687_600_000);
    expect(s.collected).toBe(123_687_600_000);
    expect(s.plannedStartValue).toBe(359_485_500_000);
    expect(s.assignedRevenue).toBe(225_000_000_000);
    expect(s.lateCount).toBe(4);
    expect(s.atRiskCount).toBe(4);
  });

  it("tỷ lệ làm tròn XUỐNG, và null khi không có mẫu số", () => {
    // 4/19 = 21,05% ⇒ 21; 123.687.600.000 / 225.000.000.000 = 54,97% ⇒ 54.
    expect(provinceSummary(ROWS).donePct).toBe(21);
    expect(provinceSummary(ROWS).assignedPct).toBe(54);
    const empty = provinceSummary([{ ...base, planned_count: 0, assigned_revenue: null }]);
    expect(empty.donePct).toBeNull();
    expect(empty.assignedPct).toBeNull();
  });

  it('mẫu số "x/y xã đã trình" là số xã TRONG ĐỢT khi có đợt', () => {
    const s = provinceSummary([...ROWS, { ...base, admin_unit_code: "99999", in_cycle: false }]);
    expect(s.unitCount).toBe(5);
    expect(s.inCycleCount).toBe(4);
    expect(s.submittedOf).toBe(4);
  });

  it("bỏ kế hoạch CẤP TỈNH khỏi số đếm đơn vị nhưng vẫn cộng tiền của nó", () => {
    const withProvince: ProvinceRollupRow[] = [
      ...ROWS,
      { ...base, admin_unit_code: "24", unit_name: "Tỉnh Bắc Ninh", unit_level: "province", collected: 1_000 },
    ];
    const s = provinceSummary(withProvince);
    expect(s.unitCount).toBe(4);
    expect(s.collected).toBe(123_687_601_000);
    expect(communeRows(withProvince)).toHaveLength(4);
  });
});

describe("provinceAttention", () => {
  it("xã chưa lập kế hoạch cho ĐỢT ĐANG MỞ vẫn nằm ở L2 dù kế hoạch năm đã được duyệt", () => {
    const a = provinceAttention(ROWS);
    expect(a.notSubmitted.map((r) => r.admin_unit_code)).toEqual(["07210", "07777", "09169", "07339"]);
    expect(a.returned).toHaveLength(0);
    expect(a.awaitingReview).toHaveLength(0);
    expect(a.late).toHaveLength(4);
  });

  it("xã rời khỏi nhóm 'chưa trình' ngay khi kế hoạch của ĐỢT đó được trình", () => {
    const submitted = ROWS.map((r) =>
      r.admin_unit_code === "09169"
        ? { ...r, cycle_plan_id: "p-sup", cycle_plan_status: "submitted" as const }
        : r,
    );
    const a = provinceAttention(submitted);
    expect(a.notSubmitted.map((r) => r.admin_unit_code)).toEqual(["07210", "07777", "07339"]);
    expect(a.awaitingReview.map((r) => r.admin_unit_code)).toEqual([]);
  });

  it("bản nháp / bản bị trả lại của đợt KHÔNG tính là đã trình", () => {
    const drafts = provinceAttention([
      { ...base, admin_unit_code: "a", cycle_plan_id: "x", cycle_plan_status: "draft" },
      { ...base, admin_unit_code: "b", cycle_plan_id: "y", cycle_plan_status: "returned" },
      { ...base, admin_unit_code: "c", cycle_plan_id: "z", cycle_plan_status: "approved" },
    ]);
    expect(drafts.notSubmitted.map((r) => r.admin_unit_code)).toEqual(["a", "b"]);
  });

  it("đợt ĐÃ ĐÓNG không sinh việc 'chưa trình'", () => {
    const closed = provinceAttention([{ ...base, cycle_status: "closed", cycle_plan_status: null }]);
    expect(closed.notSubmitted).toHaveLength(0);
  });

  it("nhóm trả lại và chờ xem xét đọc từ MỌI kế hoạch của năm", () => {
    const a = provinceAttention([
      { ...base, admin_unit_code: "a", is_returned: true, plan_statuses: ["returned"] },
      { ...base, admin_unit_code: "b", plan_statuses: ["approved", "submitted"] },
    ]);
    expect(a.returned.map((r) => r.admin_unit_code)).toEqual(["a"]);
    expect(a.awaitingReview.map((r) => r.admin_unit_code)).toEqual(["b"]);
  });
});

describe("unitStatusLabel", () => {
  it("nói rõ khi chưa có kế hoạch nào", () => {
    expect(unitStatusLabel({ ...base, plan_count: 0, plan_statuses: [] })).toBe("Chưa lập kế hoạch");
  });

  it("ưu tiên việc gấp: bị trả lại > chờ xem xét > đang điều chỉnh > đã duyệt", () => {
    expect(unitStatusLabel({ ...base, is_returned: true, plan_statuses: ["returned", "approved"] })).toBe(
      "Bị trả lại",
    );
    expect(unitStatusLabel({ ...base, plan_statuses: ["approved", "submitted"] })).toBe("Chờ xem xét");
    expect(unitStatusLabel({ ...base, plan_statuses: ["adjusting"] })).toBe("Đang điều chỉnh");
    expect(unitStatusLabel({ ...base, plan_statuses: ["closed"] })).toBe("Đã đóng");
    expect(unitStatusLabel({ ...base, plan_statuses: ["draft"] })).toBe("Nháp");
  });
});

describe("sortProvinceRows", () => {
  it("tên xã so theo tiếng Việt", () => {
    const asc = sortProvinceRows(ROWS, "unit", "asc").map((r) => r.unit_name);
    expect(asc[0]).toBe("Phường Bắc Giang");
    expect(asc[3]).toBe("Xã Tân Yên");
  });

  it("cột số giảm dần theo mặc định, hoà thì so tên", () => {
    expect(defaultSortDir("assigned")).toBe("desc");
    expect(defaultSortDir("unit")).toBe("asc");
    expect(sortProvinceRows(ROWS, "assigned", "desc")[0].admin_unit_code).toBe("07777");
    expect(sortProvinceRows(ROWS, "collected", "desc")[0].admin_unit_code).toBe("07210");
    // Cả bốn xã đều 1 tài sản trễ ⇒ thứ tự rơi về tên.
    expect(sortProvinceRows(ROWS, "late", "desc").map((r) => r.unit_name)[0]).toBe("Phường Bắc Giang");
  });

  it("'—' (chưa có % hoàn thành) xếp sau mọi số khi giảm dần", () => {
    const rows = [
      { ...base, admin_unit_code: "a", done_pct: null },
      { ...base, admin_unit_code: "b", done_pct: 0 },
    ];
    expect(sortProvinceRows(rows, "done", "desc").map((r) => r.admin_unit_code)).toEqual(["b", "a"]);
  });

  it("không sửa mảng gốc", () => {
    const copy = [...ROWS];
    sortProvinceRows(ROWS, "collected", "desc");
    expect(ROWS).toEqual(copy);
  });
});

describe("deadlineNote", () => {
  it("đếm ngày tới hạn trình, quá hạn thì nói quá hạn", () => {
    expect(deadlineNote(ROWS[0], "2026-11-04")).toBe("còn 12 ngày tới hạn trình");
    expect(deadlineNote(ROWS[0], "2026-11-16")).toBe("hạn trình là hôm nay");
    expect(deadlineNote(ROWS[0], "2026-11-19")).toBe("quá hạn trình 3 ngày");
    expect(deadlineNote({ ...base, submit_deadline: null }, "2026-11-04")).toBeNull();
  });
});
