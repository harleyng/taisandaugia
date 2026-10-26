import { describe, expect, it } from "vitest";
import {
  areaLabel,
  groupByQuarter,
  parsePublicPlanItem,
  parsePublicPlanUnit,
  quarterLabel,
  type PublicPlanItem,
} from "./publicPlanItems";

const row = (over: Record<string, unknown> = {}) => ({
  code: "6e1b1678fe214ec6ab29ce948053835a",
  commune_code: "09169",
  commune_name: "Phường Vũ Ninh",
  title: "Khu dân cư mới Vũ Ninh — lô LK2",
  lot_labels: "LK2-01→06",
  area_m2: 720,
  land_use_code: "ODT",
  planned_quarter: "2026-Q2",
  follow_count: 3,
  followed: false,
  ...over,
});

describe("parsePublicPlanItem", () => {
  it("đọc một dòng đầy đủ", () => {
    const item = parsePublicPlanItem(row())!;
    expect(item.code).toBe("6e1b1678fe214ec6ab29ce948053835a");
    expect(item.areaM2).toBe(720);
    expect(item.followCount).toBe(3);
    expect(item.followed).toBe(false);
  });

  it("giá VẮNG MẶT khi đơn vị chưa bật công tắc giá ⇒ null, không phải 0", () => {
    const item = parsePublicPlanItem(row())!;
    expect(item.unitStartPrice).toBeNull();
    expect(item.expectedStartValue).toBeNull();
  });

  it("đọc giá khi RPC có trả", () => {
    const item = parsePublicPlanItem(row({ unit_start_price: 24000000, expected_start_value: 17280000000 }))!;
    expect(item.unitStartPrice).toBe(24_000_000);
    expect(item.expectedStartValue).toBe(17_280_000_000);
  });

  it("thiếu mã công khai ⇒ bỏ dòng", () => {
    expect(parsePublicPlanItem(row({ code: null }))).toBeNull();
    expect(parsePublicPlanItem(row({ commune_code: "" }))).toBeNull();
    expect(parsePublicPlanItem(null)).toBeNull();
  });

  it("các khoá bị jsonb_strip_nulls bỏ hẳn vẫn đọc được", () => {
    const bare = { code: "a".repeat(32), commune_code: "09169" };
    const item = parsePublicPlanItem(bare)!;
    expect(item.title).toBe("Tài sản chưa đặt tên");
    expect(item.lotLabels).toBeNull();
    expect(item.plannedQuarter).toBeNull();
    expect(item.followCount).toBe(0);
  });
});

describe("parsePublicPlanUnit", () => {
  it("đọc một xã đã công khai", () => {
    const unit = parsePublicPlanUnit({ code: "09169", name: "Phường Vũ Ninh", item_count: 3 })!;
    expect(unit).toEqual({ code: "09169", name: "Phường Vũ Ninh", itemCount: 3 });
  });
  it("thiếu mã ⇒ bỏ", () => expect(parsePublicPlanUnit({ name: "x" })).toBeNull());
});

describe("quarterLabel", () => {
  it("giữ NĂM trong nhãn", () => {
    expect(quarterLabel("2026-Q1")).toBe("Quý I/2026");
    expect(quarterLabel("2026-Q4")).toBe("Quý IV/2026");
    expect(quarterLabel("2027-Q3")).toBe("Quý III/2027");
  });
  it("chuỗi lạ ⇒ nhãn chưa xác định", () => {
    expect(quarterLabel(null)).toBe("Chưa xác định thời gian");
    expect(quarterLabel("Q4")).toBe("Chưa xác định thời gian");
    expect(quarterLabel("2026-Q5")).toBe("Chưa xác định thời gian");
  });
});

describe("groupByQuarter", () => {
  const item = (quarter: string | null, code: string): PublicPlanItem =>
    parsePublicPlanItem(row({ planned_quarter: quarter, code }))!;

  it("gom theo quý, giữ thứ tự server", () => {
    const groups = groupByQuarter([
      item("2026-Q2", "a"),
      item("2026-Q2", "b"),
      item("2026-Q4", "c"),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Quý II/2026", "Quý IV/2026"]);
    expect(groups[0].items).toHaveLength(2);
  });

  it("quý chưa xác định xuống CUỐI", () => {
    const groups = groupByQuarter([item(null, "a"), item("2026-Q4", "b")]);
    expect(groups.map((g) => g.quarter)).toEqual(["2026-Q4", null]);
  });

  it("danh sách rỗng ⇒ không nhóm nào", () => expect(groupByQuarter([])).toEqual([]));
});

describe("areaLabel", () => {
  it("nhóm nghìn bằng dấu phẩy, bỏ số 0 thừa", () => {
    expect(areaLabel(960)).toBe("960 m²");
    expect(areaLabel(4285.5)).toBe("4,285.5 m²");
    expect(areaLabel(1250.0)).toBe("1,250 m²");
  });
  it("không có diện tích ⇒ null", () => expect(areaLabel(null)).toBeNull());
});
