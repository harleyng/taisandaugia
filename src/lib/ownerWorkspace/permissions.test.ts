import { describe, expect, it } from "vitest";
import {
  countOwnerMatrix,
  flattenOwnerMatrix,
  fullOwnerMatrix,
  HQ_VIEW_MATRIX,
  normalizeOwnerMatrix,
  OWNER_MODULE_DEFINITIONS,
  OWNER_TOTAL_PERMISSIONS,
  ownerMatrixFromRows,
  ownerMatrixHasWrite,
  ownerMatrixSubset,
  STAFF_DEFAULT_MATRIX,
  VIEWER_DEFAULT_MATRIX,
} from "./permissions";

// Phải khớp owner_ws_permission_catalog() / owner_ws_default_role_permissions()
// (migration 20260927170000 — self-check ở đó: 41 / 28 / 14; 20261001100000 thêm so-hoa:share ⇒ 42 / 29 / 14;
// 20261001214152 thêm truyen-thong, 20261001230000 gộp cả hai ⇒ 48 / 32 / 15;
// 20261002120000 thêm nhat-ky (view, share) — KHÔNG vào vai trò mặc định ⇒ 50 / 32 / 15).
describe("danh mục quyền", () => {
  it("50 quyền, mọi module đều có 'Xem' và không trùng mã", () => {
    expect(OWNER_TOTAL_PERMISSIONS).toBe(50);
    expect(countOwnerMatrix(fullOwnerMatrix())).toBe(50);
    expect(new Set(OWNER_MODULE_DEFINITIONS.map((d) => d.module)).size).toBe(OWNER_MODULE_DEFINITIONS.length);
    for (const d of OWNER_MODULE_DEFINITIONS) expect(d.actions[0]).toBe("view");
  });

  it("vai trò mặc định: Cán bộ 32 quyền = quyền 'staff' cũ + chia sẻ hồ sơ + truyền thông (xem/tạo/sửa); Người xem 15", () => {
    expect(countOwnerMatrix(STAFF_DEFAULT_MATRIX)).toBe(32);
    expect(countOwnerMatrix(VIEWER_DEFAULT_MATRIX)).toBe(15);
    // Nhật ký của mọi người không nằm trong vai trò mặc định — Trưởng đơn vị tự cấp.
    expect(VIEWER_DEFAULT_MATRIX["nhat-ky"]).toBeUndefined();
    expect(STAFF_DEFAULT_MATRIX["nhat-ky"]).toBeUndefined();
    // Cán bộ cũ KHÔNG có: chốt / chia sẻ báo cáo, chỉ tiêu, thành viên, chi nhánh, liên kết.
    expect(STAFF_DEFAULT_MATRIX["bao-cao-dinh-ky"]).not.toContain("finalize");
    expect(STAFF_DEFAULT_MATRIX["chi-tieu"]).toEqual(["view"]);
    expect(STAFF_DEFAULT_MATRIX["thanh-vien"]).toEqual(["view"]);
    // Truyền thông: Cán bộ soạn được, nhưng Duyệt / Gửi / Xoá là của Trưởng đơn vị (B7).
    expect(STAFF_DEFAULT_MATRIX["truyen-thong"]).toEqual(["view", "create", "update"]);
    expect(ownerMatrixSubset(STAFF_DEFAULT_MATRIX, fullOwnerMatrix())).toBe(true);
  });

  it("trụ sở chỉ xem, không có thành viên / vai trò / liên kết", () => {
    expect(ownerMatrixHasWrite(HQ_VIEW_MATRIX)).toBe(false);
    expect(HQ_VIEW_MATRIX["thanh-vien"]).toBeUndefined();
    expect(HQ_VIEW_MATRIX["vai-tro"]).toBeUndefined();
    expect(HQ_VIEW_MATRIX["lien-ket"]).toBeUndefined();
    expect(HQ_VIEW_MATRIX["nhat-ky"]).toEqual(["view"]);
  });
});

describe("ownerMatrixFromRows / flattenOwnerMatrix", () => {
  it("bỏ dòng ngoài danh mục và dòng trùng", () => {
    const m = ownerMatrixFromRows([
      { module: "thu-tien", action: "create" },
      { module: "thu-tien", action: "create" },
      { module: "thu-tien", action: "approve" },
      { module: "khong-co", action: "view" },
    ]);
    expect(m).toEqual({ "thu-tien": ["create"] });
    expect(flattenOwnerMatrix(m)).toEqual([{ module: "thu-tien", action: "create" }]);
  });
});

describe("normalizeOwnerMatrix", () => {
  it("module có thao tác thì tự có 'Xem' (thứ tự theo danh mục)", () => {
    expect(normalizeOwnerMatrix({ "thu-tien": ["delete", "create"] })).toEqual({ "thu-tien": ["view", "create", "delete"] });
  });

  it("bỏ 'Xem' của module đang có thao tác ⇒ bỏ cả module", () => {
    const prev = { "thu-tien": ["view", "create"] as const };
    expect(normalizeOwnerMatrix({ "thu-tien": ["create"] }, { "thu-tien": [...prev["thu-tien"]] })).toEqual({});
  });

  it("module rỗng bị bỏ khoá", () => {
    expect(normalizeOwnerMatrix({ "thu-tien": [] })).toEqual({});
  });
});

describe("ownerMatrixSubset", () => {
  it("a ⊆ b theo từng cặp module × thao tác", () => {
    expect(ownerMatrixSubset({ "ket-qua": ["view"] }, VIEWER_DEFAULT_MATRIX)).toBe(true);
    expect(ownerMatrixSubset(VIEWER_DEFAULT_MATRIX, { "ket-qua": ["view", "update"] })).toBe(false);
    expect(ownerMatrixSubset({}, {})).toBe(true);
  });
});
