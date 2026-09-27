import { describe, expect, it } from "vitest";
import { buildServiceContractDocDefinition, type ServiceContractPdfInput } from "./document";
import { formatVnd } from "@/lib/advertising/slug";

function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => texts(n, out));
  else if (node && typeof node === "object") Object.values(node as Record<string, unknown>).forEach((v) => texts(v, out));
  return out;
}

const base: ServiceContractPdfInput = {
  kind: "giam-dinh",
  code: "HDCU000007",
  templateVersion: "HDCU-GD-MAU-2026-09",
  clauses: {
    legal_bases: ["Căn cứ Bộ luật Dân sự;"],
    scope: ["Giám định tính xác thực."],
    deliverables: "Chứng thư giám định.",
    payment_terms: "Thanh toán một lần.",
    electronic_acceptance: "Giao kết điện tử khi bấm đồng ý.",
    effect: ["Có hiệu lực khi đồng ý."],
  },
  terms: {
    service_label: "Giám định tài sản",
    order_code: "GD000003",
    package_name: "Gửi hiện vật",
    posting_title: "Bình gốm",
    price: 3_500_000,
    quote_note: null,
    quoted_at: "2026-09-20T03:00:00Z",
    quote_expires_at: null,
    extra: { method: "ship_item" },
  },
  owner: { kind: "individual", full_name: "Trần Thị B", signatory: { user_id: "u1", name: "Trần Thị B", email: "b@x.vn" } },
  provider: {
    name: "Công ty Sàn", tax_code: "0101", address: "Hà Nội", representative: "Lê C", rep_title: "Giám đốc",
    email: null, partner_name: "Đối tác GD", expert_name: null,
  },
  acceptedAt: "2026-09-21T02:00:00Z",
  acceptedByName: "Trần Thị B",
  contentHash: "ab".repeat(32),
  generatedAt: new Date("2026-09-21T03:00:00Z"),
};

describe("buildServiceContractDocDefinition", () => {
  it("in các bên, giá đã đồng ý, câu chữ mẫu và mã kiểm tra", () => {
    const dd = buildServiceContractDocDefinition(base);
    const s = texts(dd.content);
    expect(s).toContain("HỢP ĐỒNG CUNG ỨNG DỊCH VỤ");
    expect(s).toContain("GIÁM ĐỊNH TÀI SẢN");
    expect(s).toContain("Trần Thị B");
    expect(s).toContain(formatVnd(3_500_000));
    expect(s).toContain("Giám định tính xác thực.");
    expect(s).toContain("Gửi hiện vật");
    expect(s).toContain("ab".repeat(32));
    expect(dd.watermark).toBeUndefined();
  });

  it("bản xem trước (chưa đồng ý) có dấu XEM TRƯỚC và không có mã kiểm tra", () => {
    const dd = buildServiceContractDocDefinition({ ...base, code: null, owner: null, contentHash: null, acceptedAt: null });
    expect((dd.watermark as { text: string }).text).toBe("XEM TRƯỚC");
    expect(texts(dd.content).some((t) => t.includes("Bản xem trước"))).toBe(true);
  });

  it("slot thiếu in chỗ trống chứ không bịa câu chữ", () => {
    const dd = buildServiceContractDocDefinition({ ...base, clauses: {} });
    expect(texts(dd.content).some((t) => t.startsWith("……"))).toBe(true);
  });
});
