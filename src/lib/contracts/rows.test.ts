import { describe, expect, it } from "vitest";
import {
  contractActionCount,
  fromConsignment,
  fromService,
  isConsignmentContractAction,
  matchesContractSearch,
  matchesContractTab,
  sortContractRows,
  type OwnerConsignmentContractItem,
} from "./rows";
import type { OwnerServiceContractRow } from "@/types/service-contract";

const consignment = (over: Partial<OwnerConsignmentContractItem> = {}): OwnerConsignmentContractItem => ({
  id: "c1",
  code: "HDKG000001",
  status: "awaiting_confirmation",
  asset_posting_id: "p1",
  terms: { service_fee: 5_000_000 } as OwnerConsignmentContractItem["terms"],
  org_party: { name: "Công ty ĐG A" } as OwnerConsignmentContractItem["org_party"],
  asset_snapshot: { title: "Nhà phố" } as OwnerConsignmentContractItem["asset_snapshot"],
  created_at: "2026-09-01T00:00:00Z",
  signed_at: null,
  posting: { title: "Nhà phố (hồ sơ)" },
  ...over,
});

const service = (over: Partial<OwnerServiceContractRow> = {}): OwnerServiceContractRow => ({
  service_kind: "vr-tour",
  order_id: "o1",
  order_code: "VR000001",
  asset_posting_id: "p1",
  posting_title: "Shophouse",
  package_name: "Tiêu chuẩn",
  partner_name: "Silver Sea",
  order_status: "quoted",
  quoted_price: 5_000_000,
  quoted_at: "2026-09-20T00:00:00Z",
  quote_expires_at: null,
  paid_at: null,
  done_at: null,
  cancelled_at: null,
  contract_id: null,
  contract_code: null,
  accepted_at: null,
  needs_acceptance: true,
  can_accept: true,
  legacy: false,
  created_at: "2026-09-19T00:00:00Z",
  ...over,
});

describe("hợp đồng ký gửi", () => {
  it("chỉ hai việc của hợp đồng mới là việc cần làm; chọn báo giá thuộc menu Ký gửi", () => {
    expect(isConsignmentContractAction("confirm_contract")).toBe(true);
    expect(isConsignmentContractAction("add_address")).toBe(true);
    expect(isConsignmentContractAction("choose_quote")).toBe(false);
    expect(fromConsignment(consignment(), "confirm_contract")).toMatchObject({
      needsAction: true,
      actionLabel: "Xác nhận bản đã ký",
      href: "/chu-tai-san/hop-dong/ky-gui/c1",
      value: 5_000_000,
      title: "Nhà phố",
    });
    expect(fromConsignment(consignment(), "choose_quote").needsAction).toBe(false);
  });
});

describe("hợp đồng dịch vụ", () => {
  it("báo giá chờ chính mình đồng ý ⇒ việc cần làm, mở tại danh sách", () => {
    const r = fromService(service());
    expect(r).toMatchObject({ needsAction: true, statusLabel: "Chờ đồng ý", code: null });
    expect(r.service).toEqual({ kind: "vr-tour", orderId: "o1", postingId: "p1" });
  });

  it("đồng nghiệp chưa đồng ý ⇒ không phải việc của mình, ghi chú rõ", () => {
    const r = fromService(service({ can_accept: false }));
    expect(r.needsAction).toBe(false);
    expect(r.note).toContain("chờ người gửi yêu cầu");
  });

  it("đã đồng ý ⇒ mở trang hợp đồng; đơn trả trước khi có hợp đồng gắn cờ", () => {
    const r = fromService(service({ contract_id: "sc1", contract_code: "HDCU000001", needs_acceptance: false, order_status: "paid" }));
    expect(r).toMatchObject({ href: "/chu-tai-san/hop-dong/dich-vu/sc1", statusLabel: "Đang thực hiện", needsAction: false });
    expect(fromService(service({ legacy: true, needs_acceptance: false, order_status: "paid" })).note).toContain("trước khi có hợp đồng");
  });
});

describe("danh sách gộp", () => {
  it("việc cần làm lên đầu, còn lại mới nhất trước; đếm huy hiệu", () => {
    const rows = sortContractRows([
      fromConsignment(consignment({ id: "old", created_at: "2026-01-01T00:00:00Z", status: "signed" }), null),
      fromService(service()),
      fromConsignment(consignment({ id: "new", created_at: "2026-09-25T00:00:00Z", status: "signed" }), null),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["dich-vu:don:vr-tour:o1", "ky-gui:new", "ky-gui:old"]);
    expect(contractActionCount(rows)).toBe(1);
    expect(rows.filter((r) => matchesContractTab("ky-gui", r))).toHaveLength(2);
    expect(rows.filter((r) => matchesContractTab("tat-ca", r))).toHaveLength(3);
    expect(rows.filter((r) => matchesContractTab("can-xu-ly", r)).map((r) => r.key)).toEqual(["dich-vu:don:vr-tour:o1"]);
  });

  it("tìm không phân biệt dấu theo mã / tài sản / bên kia", () => {
    const r = fromConsignment(consignment(), null);
    expect(matchesContractSearch(r, "nha pho")).toBe(true);
    expect(matchesContractSearch(r, "hdkg000001")).toBe(true);
    expect(matchesContractSearch(r, "cong ty dg a")).toBe(true);
    expect(matchesContractSearch(r, "biệt thự")).toBe(false);
  });
});
