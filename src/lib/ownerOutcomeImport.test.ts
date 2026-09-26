import { describe, it, expect } from "vitest";
import {
  classifyOutcomeRows,
  detectOutcomeColumns,
  importFailureReason,
  mergeImportResults,
  missingRequiredColumns,
  offPlatformKey,
  outcomeRowsFromSheet,
  parseImportDate,
  parseOutcomeWord,
  OUTCOME_TEMPLATE_HEADERS,
  type ImportContext,
  type ParsedOutcomeRow,
} from "./ownerOutcomeImport";

const L1 = "3f9a12bc-1111-4000-8000-000000000001";
const L2 = "7e00aa01-2222-4000-8000-000000000002";
const L3 = "7e00aa99-3333-4000-8000-000000000003";

const ctx = (over: Partial<ImportContext> = {}): ImportContext => ({
  listings: [
    { id: L1, title: "Nhà phố Quận 7" },
    { id: L2, title: "Đất nền Bình Dương" },
    { id: L3, title: "Đất nền Bình Dương" },
  ],
  branches: [
    { id: "b1", label: "BIDV – Chi nhánh Hà Nội" },
    { id: "b2", label: "ACB – Chi nhánh Bình Dương" },
  ],
  orgs: [{ id: "org1", name: "Công ty Đấu giá Hợp danh Miền Nam" }],
  branchScope: null,
  canWriteListing: () => true,
  today: "2026-09-26",
  ...over,
});

const row = (over: Partial<ParsedOutcomeRow> = {}): ParsedOutcomeRow => ({
  row: 2,
  code: "",
  title: "Xe tải Hino 2019",
  category: "",
  branch: "",
  org: "",
  round: "",
  date: "10/09/2026",
  outcome: "Thành",
  startingPrice: "",
  winningPrice: "1,2 tỷ",
  participants: "",
  note: "",
  ...over,
});

describe("reading the sheet", () => {
  it("detects the template headers in any order and with or without accents", () => {
    const cols = detectOutcomeColumns(OUTCOME_TEMPLATE_HEADERS);
    expect(cols).toEqual({
      code: 0, title: 1, category: 2, branch: 3, org: 4, round: 5, date: 6, outcome: 7,
      startingPrice: 8, winningPrice: 9, participants: 10, note: 11,
    });
    expect(detectOutcomeColumns(["KET QUA", "ngay dau gia", "Ten tai san", "Gia trung"])).toEqual({
      outcome: 0, date: 1, title: 2, winningPrice: 3,
    });
  });

  it("reports missing required columns", () => {
    expect(missingRequiredColumns(["Tên tài sản", "Giá trúng"])).toEqual(["Ngày đấu giá", "Kết quả"]);
    expect(missingRequiredColumns(OUTCOME_TEMPLATE_HEADERS)).toEqual([]);
  });

  it("drops fully blank rows and keeps sheet row numbers", () => {
    const rows = outcomeRowsFromSheet([
      ["Tên tài sản", "Ngày đấu giá", "Kết quả"],
      ["Xe tải", "01/09/2026", "Thành"],
      ["", "", ""],
      ["Máy xúc\u00a0", 46266, "Không thành"],
    ]);
    expect(rows.map((r) => [r.row, r.title])).toEqual([[2, "Xe tải"], [4, "Máy xúc"]]);
  });
});

describe("cell parsing", () => {
  it("understands Vietnamese result words", () => {
    expect(parseOutcomeWord("Thành")).toBe("sold");
    expect(parseOutcomeWord("thanh cong")).toBe("sold");
    expect(parseOutcomeWord("Không thành")).toBe("unsold");
    expect(parseOutcomeWord("KHONG THANH")).toBe("unsold");
    expect(parseOutcomeWord("Hoãn")).toBe("postponed");
    expect(parseOutcomeWord("Hủy")).toBe("cancelled");
    expect(parseOutcomeWord("Huỷ phiên")).toBe("cancelled");
    expect(parseOutcomeWord("Rút")).toBe("withdrawn");
    expect(parseOutcomeWord("được")).toBeNull();
  });

  it("parses Excel serials and dd/mm/yyyy, rejecting rolled-over dates", () => {
    expect(parseImportDate(46266)).toBe("2026-09-01");
    expect(parseImportDate("05/09/2026")).toBe("2026-09-05");
    expect(parseImportDate("5-9-2026")).toBe("2026-09-05");
    expect(parseImportDate("2026-09-05")).toBe("2026-09-05");
    expect(parseImportDate("31/02/2026")).toBeNull();
    expect(parseImportDate("29/02/2028")).toBe("2028-02-29");
    expect(parseImportDate("hôm qua")).toBeNull();
  });

  it("keys off-platform assets like the server", () => {
    expect(offPlatformKey("  Đất  NÔNG\u00a0nghiệp ")).toBe("đất nông nghiệp");
  });
});

describe("classifyOutcomeRows", () => {
  it("imports 20 rows with 2 invalid as 18 valid rows and 2 clear errors", () => {
    const rows: ParsedOutcomeRow[] = Array.from({ length: 18 }, (_, i) =>
      row({ row: i + 2, title: `Tài sản ngoài sàn ${i + 1}`, outcome: i % 3 === 0 ? "Không thành" : "Thành", winningPrice: i % 3 === 0 ? "" : "900000000" }),
    );
    rows.push(row({ row: 20, title: "Thiếu giá", winningPrice: "" }));
    rows.push(row({ row: 21, title: "Ngày sai", date: "31/02/2026" }));
    const res = classifyOutcomeRows(rows, ctx());
    expect(res.valid).toHaveLength(18);
    expect(res.invalid).toEqual([
      { row: 20, title: "Thiếu giá", reason: "Phiên thành phải có giá trúng" },
      { row: 21, title: "Ngày sai", reason: "Ngày đấu giá không hợp lệ (dd/mm/yyyy)" },
    ]);
  });

  it("skips rows without a result instead of flagging them", () => {
    const res = classifyOutcomeRows([row({ outcome: "" })], ctx());
    expect(res).toEqual({ valid: [], skipped: [2], invalid: [] });
  });

  it("matches by asset code, and never turns an unknown code into an off-platform asset", () => {
    const res = classifyOutcomeRows(
      [
        row({ row: 2, code: "3F9A12BC", title: "" }),
        row({ row: 3, code: "DEADBEEF" }),
        row({ row: 4, code: "7E00AA" }),
        row({ row: 5, code: "7e00aa01", title: "" }),
      ],
      ctx(),
    );
    expect(res.valid.map((v) => [v.row, v.listingId, v.matchedBy, v.title])).toEqual([
      [2, L1, "code", "Nhà phố Quận 7"],
      [5, L2, "code", "Đất nền Bình Dương"],
    ]);
    expect(res.invalid.map((i) => i.reason)).toEqual([
      "Mã tài sản không có trong danh mục của đơn vị",
      "Mã tài sản không hợp lệ (8 ký tự như ở danh sách tài sản)",
    ]);
    // Tin trên sàn không mang tên / chi nhánh / loại (server suy từ claim).
    expect(res.valid[0].payload).toMatchObject({ listing_id: L1, asset_title: null, branch_id: null, asset_category: null });
  });

  it("matches a unique listing name, refuses ambiguous names, else goes off-platform", () => {
    const res = classifyOutcomeRows(
      [
        row({ row: 2, title: "nha pho quan 7" }),
        row({ row: 3, title: "Đất nền Bình Dương" }),
        row({ row: 4, title: "Kho hàng Long An", category: "Nhà xưởng", branch: "acb – chi nhánh bình dương", org: "Công ty đấu giá hợp danh miền nam" }),
      ],
      ctx(),
    );
    expect(res.valid.map((v) => [v.row, v.listingId, v.matchedBy])).toEqual([
      [2, L1, "name"],
      [4, null, null],
    ]);
    expect(res.invalid).toEqual([{ row: 3, title: "Đất nền Bình Dương", reason: "Tên trùng nhiều tài sản trên sàn — ghi mã tài sản" }]);
    expect(res.valid[1].payload).toMatchObject({
      asset_title: "Kho hàng Long An",
      asset_category: "nha-xuong",
      branch_id: "b2",
      auction_org_id: "org1",
      winning_price: 1_200_000_000,
    });
    expect(res.valid[1].warnings).toEqual([]);
  });

  it("warns (without failing) on unknown branch, organisation or category", () => {
    const res = classifyOutcomeRows([row({ branch: "Chi nhánh X", org: "Công ty Y", category: "Tàu biển" })], ctx());
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].payload).toMatchObject({ branch_id: null, auction_org_id: null, asset_category: null });
    expect(res.valid[0].warnings).toHaveLength(3);
  });

  it("flags duplicate (asset, round) pairs within the file", () => {
    const res = classifyOutcomeRows(
      [row({ row: 2, title: "Xe tải  Hino" }), row({ row: 3, title: "xe tải hino" }), row({ row: 4, title: "Xe tải Hino", round: "2" })],
      ctx(),
    );
    expect(res.valid.map((v) => v.row)).toEqual([2, 4]);
    expect(res.invalid).toEqual([{ row: 3, title: "xe tải hino", reason: "Trùng lượt 1 của cùng tài sản với dòng 2" }]);
  });

  it("validates dates, rounds, amounts and participants", () => {
    const res = classifyOutcomeRows(
      [
        row({ row: 2, date: "" }),
        row({ row: 3, date: "01/10/2026" }),
        row({ row: 4, round: "0" }),
        row({ row: 5, winningPrice: "rất cao" }),
        row({ row: 6, participants: "0" }),
        row({ row: 7, title: "AB" }),
        row({ row: 8, outcome: "được" }),
      ],
      ctx(),
    );
    expect(res.invalid.map((i) => [i.row, i.reason])).toEqual([
      [2, "Thiếu ngày đấu giá"],
      [3, "Ngày đấu giá không được sau hôm nay"],
      [4, "Lượt phải là số từ 1 đến 99"],
      [5, "Giá trúng không đọc được"],
      [6, "Phiên thành có ít nhất 1 người tham gia"],
      [7, "Thiếu tên tài sản (ít nhất 3 ký tự) hoặc mã tài sản"],
      [8, "Kết quả không hợp lệ — dùng Thành / Không thành / Hoãn / Huỷ / Rút"],
    ]);
  });

  it("maps unsold reasons like the dialog does", () => {
    const res = classifyOutcomeRows(
      [
        row({ row: 2, title: "Tài sản A", outcome: "Không thành", winningPrice: "", note: "Không ai đăng ký" }),
        row({ row: 3, title: "Tài sản B", outcome: "Không thành", winningPrice: "", note: "chỉ 1 người" }),
        row({ row: 4, title: "Tài sản C", outcome: "Không thành", winningPrice: "", note: "Tranh chấp" }),
        row({ row: 5, title: "Tài sản D", outcome: "Hoãn", winningPrice: "5 tỷ", note: "Có quyết định tạm dừng" }),
      ],
      ctx(),
    );
    expect(res.valid.map((v) => [v.payload.failure_reason, v.payload.participants, v.payload.winning_price])).toEqual([
      ["no_registrants", 0, null],
      ["single_bidder", 1, null],
      ["Tranh chấp", null, null],
      ["Có quyết định tạm dừng", null, null],
    ]);
  });

  it("enforces the branch scope of branch-limited staff", () => {
    const scoped = ctx({ branchScope: ["b1"], canWriteListing: (id) => id !== L1 });
    const res = classifyOutcomeRows(
      [
        row({ row: 2, code: "3F9A12BC" }),
        row({ row: 3, title: "Máy xúc" }),
        row({ row: 4, title: "Máy ủi", branch: "ACB – Chi nhánh Bình Dương" }),
      ],
      scoped,
    );
    expect(res.invalid.map((i) => [i.row, i.reason])).toEqual([
      [2, "Tài sản thuộc chi nhánh ngoài phạm vi của bạn"],
      [4, "Chi nhánh ngoài phạm vi của bạn"],
    ]);
    expect(res.valid[0].payload.branch_id).toBe("b1");
    expect(res.valid[0].warnings).toContain("Gắn vào chi nhánh của bạn");

    const twoBranches = classifyOutcomeRows([row({ title: "Máy xúc" })], ctx({ branchScope: ["b1", "b2"] }));
    expect(twoBranches.invalid[0].reason).toBe("Chọn chi nhánh trong phạm vi của bạn");
  });
});

describe("server results", () => {
  it("maps per-row failures back to sheet rows in Vietnamese", () => {
    const valid = classifyOutcomeRows([row({ row: 2 }), row({ row: 3, title: "Máy xúc" }), row({ row: 4, title: "Máy ủi" })], ctx()).valid;
    expect(
      mergeImportResults(valid, [
        { idx: 0, ok: true },
        { idx: 1, ok: false, code: "23505" },
        { idx: 2, ok: false, code: "42501" },
      ]),
    ).toEqual({
      written: 1,
      failures: [
        { row: 3, title: "Máy xúc", reason: "Lượt này đã được khai cho tài sản này" },
        { row: 4, title: "Máy ủi", reason: "Ngoài phạm vi chi nhánh hoặc không có quyền ghi" },
      ],
    });
  });

  it("passes guard messages through and names format errors", () => {
    expect(importFailureReason("P0001", "Tài sản này không thuộc danh mục của đơn vị")).toBe("Tài sản này không thuộc danh mục của đơn vị");
    expect(importFailureReason("22007", "invalid date")).toBe("Dữ liệu không đúng định dạng");
    expect(importFailureReason("23514", 'violates check constraint "outcome_title_len"')).toBe("Tên tài sản cần từ 3 đến 300 ký tự");
  });
});
