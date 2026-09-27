import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import {
  IMPORT_GROUPS,
  classifyPostingRows,
  mergePostingImportResults,
  parseImportNumber,
  parseYesNo,
  postingRowsFromSheet,
  postingRowsFromWorkbook,
  type PostingImportContext,
} from "./postingImport";

const personal: PostingImportContext = { isWorkspace: false, branches: [], branchScope: null, existing: [] };

const HEADER = [
  "Tên tài sản *",
  "Loại tài sản *",
  "Tỉnh/Thành phố *",
  "Quận/Huyện",
  "Phường/Xã",
  "Chi nhánh",
  "Giá khởi điểm (VND)",
  "Hình thức đấu giá",
  "Đang tranh chấp",
  "Diện tích đất (m²) *",
  "Hướng nhà",
  "Hãng / Model *",
  "Hộp số",
];

const sheet = (...rows: unknown[][]) => postingRowsFromSheet("Bất động sản", [HEADER, ...rows]);

describe("IMPORT_GROUPS", () => {
  it("bỏ nhóm không có loại con và hợp trường riêng theo tên cột", () => {
    expect(IMPORT_GROUPS.find((g) => g.slug === "khac")).toBeUndefined();
    const bds = IMPORT_GROUPS.find((g) => g.slug === "bat-dong-san")!;
    const headers = bds.deltaColumns.map((d) => d.header);
    expect(headers).toContain("Diện tích đất (m²) *");
    expect(new Set(headers).size).toBe(headers.length);
  });
});

describe("parse helpers", () => {
  it("đọc số theo dấu phẩy nhóm nghìn và dấu phẩy thập phân", () => {
    expect(parseImportNumber("1,250.5")).toBe(1250.5);
    expect(parseImportNumber("85,5")).toBe(85.5);
    expect(parseImportNumber("120 m2")).toBe(120);
    expect(parseImportNumber(42)).toBe(42);
    expect(parseImportNumber("abc")).toBeNull();
  });

  it("Có/Không", () => {
    expect(parseYesNo("Có")).toBe(true);
    expect(parseYesNo("không")).toBe(false);
    expect(parseYesNo("")).toBeNull();
    expect(parseYesNo("có lẽ")).toBeUndefined();
  });
});

describe("classifyPostingRows", () => {
  it("dựng payload đủ cột cho một dòng hợp lệ", () => {
    const res = classifyPostingRows(
      sheet(["Nhà phố Quận 1", "Nhà phố", "TP HCM", "quận 1", "Bến Nghé", "", "2,5 tỷ", "Trực tuyến", "Không", "85,5", "Đông Nam"]),
      personal,
    );
    expect(res.invalid).toEqual([]);
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].payload).toEqual({
      parent_slug: "bat-dong-san",
      child_slug: "nha-pho",
      title: "Nhà phố Quận 1",
      description: null,
      province: "TP. Hồ Chí Minh",
      district: "Quận 1",
      ward: "Phường Bến Nghé",
      address: null,
      branch_id: null,
      starting_price: 2_500_000_000,
      auction_format: "truc_tuyen",
      has_dispute: false,
      has_mortgage: null,
      is_seized: null,
      legal_notes: null,
      delta_fields: { land_area: 85.5, direction: "dong-nam" },
    });
    expect(res.valid[0].warnings).toEqual([]);
  });

  it("chỉ lấy trường riêng của đúng loại tài sản", () => {
    const res = classifyPostingRows(
      sheet(["Toyota Camry 2019", "Ô tô", "Hà Nội", "", "", "", "", "", "", "120", "", "Toyota Camry", "Số tự động"]),
      personal,
    );
    expect(res.valid[0].payload.parent_slug).toBe("xe-co");
    expect(res.valid[0].payload.delta_fields).toEqual({ brand: "Toyota Camry", transmission: "so-tu-dong" });
  });

  it("báo lỗi thiếu tên / loại / tỉnh không nhận ra", () => {
    const res = classifyPostingRows(
      sheet(["AB", "Nhà phố", "Hà Nội"], ["Căn A", "Tàu thuỷ", "Hà Nội"], ["Căn B", "Căn hộ", "Atlantis"], ["Căn C", "", "Hà Nội"]),
      personal,
    );
    expect(res.valid).toHaveLength(0);
    expect(res.invalid.map((i) => i.row)).toEqual([2, 3, 4, 5]);
  });

  it("tỉnh không có dữ liệu quận/phường vẫn giữ nguyên chữ", () => {
    const res = classifyPostingRows(sheet(["Đất Biên Hoà", "Đất ở", "tỉnh đồng nai", "TP Biên Hoà", "Tân Phong"]), personal);
    expect(res.valid[0].payload).toMatchObject({ province: "Đồng Nai", district: "TP Biên Hoà", ward: "Tân Phong" });
  });

  it("quận không có trong tỉnh ⇒ cảnh báo, bỏ quận + phường", () => {
    const res = classifyPostingRows(sheet(["Căn hộ X", "Căn hộ", "Hà Nội", "Quận 99", "Phường Y"]), personal);
    expect(res.valid[0].payload).toMatchObject({ district: null, ward: null });
    expect(res.valid[0].warnings[0]).toMatch(/quận\/huyện/);
  });

  it("giá trị rác ⇒ cảnh báo và để trống, không làm hỏng dòng", () => {
    const res = classifyPostingRows(
      sheet(["Nhà phố B", "Nhà phố", "Hà Nội", "", "", "", "rất đắt", "qua thư", "hình như", "lớn", "Giữa"]),
      personal,
    );
    const v = res.valid[0];
    expect(v.payload).toMatchObject({ starting_price: null, auction_format: null, has_dispute: null, delta_fields: {} });
    expect(v.warnings).toHaveLength(5);
  });

  it("trùng trong file là lỗi; trùng hồ sơ đã có chỉ cảnh báo", () => {
    const res = classifyPostingRows(
      sheet(["Căn hộ A1", "Căn hộ", "Hà Nội"], ["căn hộ a1", "Căn hộ", "TP. Hà Nội"]),
      { ...personal, existing: [{ title: "Căn hộ A1", province: "Hà Nội", code: "HS-0007" }] },
    );
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].warnings).toContain("Có thể trùng hồ sơ HS-0007");
    expect(res.invalid[0].reason).toMatch(/Trùng/);
  });

  describe("chi nhánh", () => {
    const branches = [
      { id: "b1", label: "Chi nhánh Hà Nội" },
      { id: "b2", label: "Chi nhánh Đà Nẵng" },
      { id: "b3", label: "Chi nhánh cũ", isActive: false },
    ];
    const row = (branch: string) => sheet(["Căn hộ Z", "Căn hộ", "Hà Nội", "", "", branch]);

    it("tenant cá nhân bỏ qua cột chi nhánh", () => {
      expect(classifyPostingRows(row("Chi nhánh Hà Nội"), personal).valid[0].payload.branch_id).toBeNull();
    });

    it("không giới hạn: khớp theo tên, không thấy thì cảnh báo", () => {
      const ctx = { ...personal, isWorkspace: true, branches };
      expect(classifyPostingRows(row("chi nhanh ha noi"), ctx).valid[0].payload.branch_id).toBe("b1");
      const miss = classifyPostingRows(row("Chi nhánh cũ"), ctx).valid[0];
      expect(miss.payload.branch_id).toBeNull();
      expect(miss.warnings[0]).toMatch(/Không tìm thấy chi nhánh/);
    });

    it("cán bộ chi nhánh: tự gắn khi phạm vi có 1 chi nhánh, chặn ngoài phạm vi", () => {
      const one = { ...personal, isWorkspace: true, branches, branchScope: ["b1"] };
      expect(classifyPostingRows(row(""), one).valid[0].payload.branch_id).toBe("b1");
      expect(classifyPostingRows(row("Chi nhánh Đà Nẵng"), one).invalid[0].reason).toMatch(/ngoài phạm vi/);

      const two = { ...one, branchScope: ["b1", "b2"] };
      expect(classifyPostingRows(row(""), two).invalid[0].reason).toMatch(/Chọn chi nhánh/);
      expect(classifyPostingRows(row("Chi nhánh Đà Nẵng"), two).valid[0].payload.branch_id).toBe("b2");
    });
  });
});

describe("postingRowsFromWorkbook", () => {
  it("đọc mọi sheet có cột Tên tài sản, bỏ sheet Hướng dẫn", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER, ["Nhà A", "Nhà phố", "Hà Nội"]]), "Bất động sản");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER, [], ["Xe B", "Ô tô", "Hà Nội"]]), "Xe cộ");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Tên tài sản *", "Cách điền"], ["x", "y"]]), "Hướng dẫn");
    const parsed = postingRowsFromWorkbook(wb);
    expect(parsed.missingColumns).toEqual([]);
    expect(parsed.rows.map((r) => [r.sheet, r.row])).toEqual([
      ["Bất động sản", 2],
      ["Xe cộ", 3],
    ]);
  });

  it("báo thiếu cột bắt buộc", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Tên tài sản"], ["Nhà A"]]), "Sheet1");
    expect(postingRowsFromWorkbook(wb).missingColumns).toEqual(["Loại tài sản", "Tỉnh/Thành phố"]);
  });
});

describe("mergePostingImportResults", () => {
  it("ghép kết quả server theo thứ tự payload", () => {
    const { valid } = classifyPostingRows(sheet(["Nhà A", "Nhà phố", "Hà Nội"], ["Nhà B", "Nhà phố", "Hà Nội"]), personal);
    const out = mergePostingImportResults(valid, [
      { idx: 0, ok: true, id: "p1", posting_code: "HS-0101" },
      { idx: 1, ok: false, code: "42501", message: "new row violates row-level security policy" },
    ]);
    expect(out.created).toEqual([{ sheet: "Bất động sản", row: 2, title: "Nhà A", id: "p1", code: "HS-0101" }]);
    expect(out.failures[0]).toMatchObject({ row: 3, reason: expect.stringMatching(/quyền/) });
  });
});
