import { describe, expect, it } from "vitest";
import { INVITE_CSV_TEMPLATE, parseInviteCsv, splitCsvLine } from "./csv";

describe("splitCsvLine", () => {
  it("tách theo phẩy, chấm phẩy và tab", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
    expect(splitCsvLine("a;b;c")).toEqual(["a", "b", "c"]);
    expect(splitCsvLine("a\tb\tc")).toEqual(["a", "b", "c"]);
  });

  it("giữ nguyên ô bọc ngoặc kép", () => {
    expect(splitCsvLine('"x, y",z')).toEqual(["x, y", "z"]);
    expect(splitCsvLine('"nói ""thế""",z')).toEqual(['nói "thế"', "z"]);
  });
});

describe("parseInviteCsv", () => {
  it("đọc được mẫu CSV của chính nó", () => {
    const { rows, errors } = parseInviteCsv(INVITE_CSV_TEMPLATE);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { email: "canbo.xatandinh@example.gov.vn", admin_unit_code: "09169", role: "staff" },
      { email: "lanhdao.xatandinh@example.gov.vn", admin_unit_code: "09169", role: "viewer" },
    ]);
  });

  it("bỏ dòng tiêu đề, dòng trống và dòng trùng", () => {
    const { rows } = parseInviteCsv(
      ["email,ma_don_vi,vai_tro", "", "a@b.vn,09169,staff", "A@B.vn,09169,staff"].join("\n"),
    );
    expect(rows).toHaveLength(1);
  });

  it("vai trò để trống mặc định là cán bộ", () => {
    expect(parseInviteCsv("a@b.vn,09169").rows[0].role).toBe("staff");
    expect(parseInviteCsv("a@b.vn,09169,Cán bộ").rows[0].role).toBe("staff");
    expect(parseInviteCsv("a@b.vn,09169,Người xem").rows[0].role).toBe("viewer");
  });

  it("báo lỗi theo số dòng cho email, mã đơn vị và vai trò sai", () => {
    const { rows, errors } = parseInviteCsv(
      ["khong-phai-email,09169,staff", "a@b.vn,24,staff", "c@d.vn,09169,truong"].join("\n"),
    );
    expect(rows).toEqual([]);
    expect(errors.map((e) => [e.line, e.reason])).toEqual([
      [1, "Email không hợp lệ"],
      [2, "Mã đơn vị phải là 5 chữ số (cấp xã)"],
      [3, "Vai trò chỉ nhận staff hoặc viewer"],
    ]);
  });

  it("mã tỉnh 2 chữ số bị từ chối — lời mời luôn theo cấp xã", () => {
    expect(parseInviteCsv("a@b.vn,24,staff").errors).toHaveLength(1);
  });
});
