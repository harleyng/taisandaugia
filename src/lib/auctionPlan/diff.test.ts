import { describe, expect, it } from "vitest";
import {
  baselineDiffHasChanges,
  baselineDiffSummary,
  diffBaselines,
  fromServerBaselineDiff,
  isValueShift,
  quarterKeyOf,
  type BaselineDiffItem,
} from "./diff";

const item = (over: Partial<BaselineDiffItem> & { item_code: string }): BaselineDiffItem => ({
  planned_month: "2027-03-01",
  expected_start_value: 1_000_000_000,
  asset_type: "land_use_right",
  title: "Lô LK1",
  lot_labels: "LK1-01",
  lot_count: 1,
  map_sheet: "12",
  parcel_no: "88",
  location: "Thôn Đoài",
  area_m2: 100,
  land_use_code: "ONT",
  allocation_form: "giao_co_thu_tien",
  unit_start_price: 10_000_000,
  planned_method: "truc_tiep_loi_noi",
  executing_unit: "Phòng Kinh tế",
  ...over,
});

describe("quarterKeyOf", () => {
  it("gộp theo năm + quý", () => {
    expect(quarterKeyOf("2027-01-01")).toBe("2027-Q1");
    expect(quarterKeyOf("2027-03-01")).toBe("2027-Q1");
    expect(quarterKeyOf("2027-04-01")).toBe("2027-Q2");
    expect(quarterKeyOf("2027-12-01")).toBe("2027-Q4");
    expect(quarterKeyOf("2026-03-01")).toBe("2026-Q1");
  });

  it("trống / sai định dạng ⇒ null", () => {
    expect(quarterKeyOf(null)).toBeNull();
    expect(quarterKeyOf("")).toBeNull();
    expect(quarterKeyOf("2027-13-01")).toBeNull();
    expect(quarterKeyOf("tháng 6")).toBeNull();
  });
});

describe("isValueShift — bản sao điều kiện SQL", () => {
  it("đúng 10% KHÔNG tính (dấu lớn hơn ngặt)", () => {
    expect(isValueShift(1_000_000_000, 1_100_000_000)).toBe(false);
    expect(isValueShift(1_000_000_000, 900_000_000)).toBe(false);
  });

  it("vượt 10% dù chỉ một đồng thì tính", () => {
    expect(isValueShift(1_000_000_000, 1_100_000_001)).toBe(true);
    expect(isValueShift(1_000_000_000, 899_999_999)).toBe(true);
  });

  it("bản trước trống hoặc bằng 0 ⇒ không bao giờ tính", () => {
    expect(isValueShift(null, 5_000_000_000)).toBe(false);
    expect(isValueShift(0, 5_000_000_000)).toBe(false);
    expect(isValueShift("", 5_000_000_000)).toBe(false);
  });

  it("bản sau trống = 0 ⇒ lệch 100%", () => {
    expect(isValueShift(1_000_000_000, null)).toBe(true);
  });

  it("đọc được số dạng chuỗi (numeric qua PostgREST)", () => {
    expect(isValueShift("1000000000", "1200000000")).toBe(true);
    expect(isValueShift("1000000000", "1050000000")).toBe(false);
  });
});

describe("diffBaselines", () => {
  it("không thay đổi ⇒ mọi nhóm rỗng", () => {
    const base = [item({ item_code: "KH27-001" }), item({ item_code: "KH27-002" })];
    const diff = diffBaselines(base, base.map((i) => ({ ...i })));
    expect(diff).toMatchObject({ added: [], dropped: [], movedQuarter: [], valueShift: [], other: [], affected: 0 });
    expect(baselineDiffHasChanges(diff)).toBe(false);
    expect(baselineDiffSummary(diff)).toBeNull();
  });

  it("thêm và bỏ theo MÃ tài sản", () => {
    const prev = [item({ item_code: "KH27-001" }), item({ item_code: "KH27-002" })];
    const next = [item({ item_code: "KH27-002" }), item({ item_code: "KH27-003" })];
    const diff = diffBaselines(prev, next);
    expect(diff.added).toEqual(["KH27-003"]);
    expect(diff.dropped).toEqual(["KH27-001"]);
    expect(diff.affected).toBe(2);
  });

  it("bỏ rồi thêm lại = một dòng bỏ + một dòng thêm (mã mới, không gộp)", () => {
    const prev = [item({ item_code: "KH27-001", title: "Lô A" })];
    const next = [item({ item_code: "KH27-009", title: "Lô A" })];
    const diff = diffBaselines(prev, next);
    expect(diff.dropped).toEqual(["KH27-001"]);
    expect(diff.added).toEqual(["KH27-009"]);
    expect(diff.other).toEqual([]);
  });

  it("dời trong cùng quý KHÔNG tính, khác quý thì tính", () => {
    const prev = [item({ item_code: "KH27-001", planned_month: "2027-01-01" })];
    expect(diffBaselines(prev, [item({ item_code: "KH27-001", planned_month: "2027-03-01" })]).movedQuarter).toEqual([]);
    expect(diffBaselines(prev, [item({ item_code: "KH27-001", planned_month: "2027-04-01" })]).movedQuarter).toEqual([
      "KH27-001",
    ]);
  });

  it("cùng số quý nhưng khác NĂM vẫn là dời quý (date_trunc giữ năm)", () => {
    const prev = [item({ item_code: "KH27-001", planned_month: "2027-02-01" })];
    const next = [item({ item_code: "KH27-001", planned_month: "2028-02-01" })];
    expect(diffBaselines(prev, next).movedQuarter).toEqual(["KH27-001"]);
  });

  it("có tháng → xoá trắng là dời quý; trống → trống thì không", () => {
    const withMonth = item({ item_code: "KH27-001", planned_month: "2027-02-01" });
    const noMonth = item({ item_code: "KH27-001", planned_month: null });
    expect(diffBaselines([withMonth], [noMonth]).movedQuarter).toEqual(["KH27-001"]);
    expect(diffBaselines([noMonth], [{ ...noMonth }]).movedQuarter).toEqual([]);
  });

  it("lệch giá trị quá 10% vào nhóm riêng", () => {
    const prev = [item({ item_code: "KH27-001", expected_start_value: 1_000_000_000 })];
    const next = [item({ item_code: "KH27-001", expected_start_value: 1_300_000_000 })];
    const diff = diffBaselines(prev, next);
    expect(diff.valueShift).toEqual(["KH27-001"]);
    expect(diff.other).toEqual([]);
  });

  it("một tài sản vừa dời quý vừa lệch giá chỉ đếm một lần trong affected", () => {
    const prev = [item({ item_code: "KH27-001", planned_month: "2027-02-01", expected_start_value: 1_000_000_000 })];
    const next = [item({ item_code: "KH27-001", planned_month: "2027-07-01", expected_start_value: 2_000_000_000 })];
    const diff = diffBaselines(prev, next);
    expect(diff.movedQuarter).toEqual(["KH27-001"]);
    expect(diff.valueShift).toEqual(["KH27-001"]);
    expect(diff.affected).toBe(1);
  });

  it("đổi trường mốc khác ⇒ nhóm 'other' (chỉ có ở client)", () => {
    const prev = [item({ item_code: "KH27-001", title: "Lô LK1", area_m2: 100 })];
    expect(diffBaselines(prev, [item({ item_code: "KH27-001", title: "Lô LK2" })]).other).toEqual(["KH27-001"]);
    expect(diffBaselines(prev, [item({ item_code: "KH27-001", area_m2: 120 })]).other).toEqual(["KH27-001"]);
  });

  it("'other' nhường chỗ cho dời quý / lệch giá", () => {
    const prev = [item({ item_code: "KH27-001", title: "Lô LK1", planned_month: "2027-02-01" })];
    const next = [item({ item_code: "KH27-001", title: "Lô LK9", planned_month: "2027-08-01" })];
    const diff = diffBaselines(prev, next);
    expect(diff.movedQuarter).toEqual(["KH27-001"]);
    expect(diff.other).toEqual([]);
  });

  it("số dạng chuỗi và số không coi là khác nhau", () => {
    const prev = [item({ item_code: "KH27-001", area_m2: 100, unit_start_price: 10_000_000 })];
    const next = [item({ item_code: "KH27-001", area_m2: "100", unit_start_price: "10000000" })];
    expect(diffBaselines(prev, next).other).toEqual([]);
  });

  it("thiếu trường (payload bản mốc cũ) thì không kết luận 'other'", () => {
    const prev = [{ item_code: "KH27-001", planned_month: "2027-02-01", expected_start_value: 1_000 }];
    const next = [item({ item_code: "KH27-001", planned_month: "2027-02-01", expected_start_value: 1_000 })];
    expect(diffBaselines(prev, next).other).toEqual([]);
  });

  it("mảng kết quả sắp theo mã tăng dần như SQL", () => {
    const next = [item({ item_code: "KH27-010" }), item({ item_code: "KH27-002" }), item({ item_code: "KH27-005" })];
    expect(diffBaselines([], next).added).toEqual(["KH27-002", "KH27-005", "KH27-010"]);
  });
});

describe("baselineDiffSummary", () => {
  it('đọc thành "Thêm 3 · Bỏ 1 · Dời quý 2"', () => {
    const prev = [
      item({ item_code: "KH27-001" }),
      item({ item_code: "KH27-002", planned_month: "2027-01-01" }),
      item({ item_code: "KH27-003", planned_month: "2027-01-01" }),
    ];
    const next = [
      item({ item_code: "KH27-002", planned_month: "2027-05-01" }),
      item({ item_code: "KH27-003", planned_month: "2027-11-01" }),
      item({ item_code: "KH27-004" }),
      item({ item_code: "KH27-005" }),
      item({ item_code: "KH27-006" }),
    ];
    expect(baselineDiffSummary(diffBaselines(prev, next))).toBe("Thêm 3 · Bỏ 1 · Dời quý 2");
  });

  it("null khi không có bản mốc", () => {
    expect(baselineDiffSummary(null)).toBeNull();
    expect(baselineDiffHasChanges(null)).toBe(false);
  });
});

describe("fromServerBaselineDiff", () => {
  it("chưa từng duyệt ⇒ null", () => {
    expect(fromServerBaselineDiff({ baseline: false })).toBeNull();
    expect(fromServerBaselineDiff(null)).toBeNull();
  });

  it("ép về cùng kiểu với diffBaselines", () => {
    const diff = fromServerBaselineDiff({
      baseline: true,
      added: ["KH27-004"],
      dropped: [],
      moved_quarter: ["KH27-002", "KH27-003"],
      value_shift: ["KH27-002"],
    });
    expect(baselineDiffSummary(diff)).toBe("Thêm 1 · Dời quý 2 · Đổi giá trị 1");
    expect(diff?.affected).toBe(3);
    expect(diff?.other).toEqual([]);
  });
});
