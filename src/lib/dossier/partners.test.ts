import { describe, expect, it } from "vitest";
import { nameKey, partnerOptions, type OwnerPartner } from "./partners";

const P = (id: string, kind: OwnerPartner["kind"], name: string, auction_org_id: string | null = null): OwnerPartner => ({
  id,
  workspace_id: "w",
  user_id: null,
  kind,
  name,
  auction_org_id,
  created_at: "2026-10-04",
});

const partners = [
  P("1", "legal", "Công ty Luật Bình An"),
  P("2", "legal", "Văn phòng luật sư Đức"),
  P("3", "auction", "ĐG Hợp danh Sài Gòn", "org-1"),
  P("4", "appraisal", "Thẩm định ABC"),
];
const directory = [
  { id: "org-1", name: "ĐG Hợp danh Sài Gòn", province: "HCM" },
  { id: "org-2", name: "Công ty ĐG Đông Á", province: "Hà Nội" },
];

describe("partnerOptions", () => {
  it("lọc theo loại, tìm không dấu, sắp theo tên", () => {
    expect(partnerOptions(partners, "legal", "").mine.map((p) => p.id)).toEqual(["1", "2"]);
    expect(partnerOptions(partners, "legal", "duc").mine.map((p) => p.id)).toEqual(["2"]);
  });

  it("danh bạ chỉ ở phần Đấu giá và bỏ tổ chức đã có trong đối tác của tôi", () => {
    expect(partnerOptions(partners, "auction", "", directory).directory.map((o) => o.id)).toEqual(["org-2"]);
    expect(partnerOptions(partners, "legal", "", directory).directory).toEqual([]);
  });

  it("nút thêm theo tên gõ chỉ khi chưa trùng (không phân biệt hoa thường / dấu)", () => {
    expect(partnerOptions(partners, "appraisal", "thẩm định abc").canAddTyped).toBe(false);
    expect(partnerOptions(partners, "appraisal", "Thẩm định XYZ").canAddTyped).toBe(true);
    expect(partnerOptions(partners, "appraisal", "  ").canAddTyped).toBe(false);
  });

  it("nameKey gộp khoảng trắng, bỏ dấu, đ ⇒ d", () => {
    expect(nameKey("  Công ty  ĐẤT Việt ")).toBe("cong ty dat viet");
  });
});
