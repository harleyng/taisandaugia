import { describe, expect, it } from "vitest";
import {
  fromOrgConsignment,
  fromOrgSale,
  matchesPortalContractSearch,
  matchesPortalContractTab,
  matchesPortalSaleFilters,
  orgSaleActionOf,
  sortPortalContractRows,
} from "./portalRows";
import type { OrgConsignmentContractListRow } from "@/types/consignment-contract";
import type { SaleContract } from "@/types/auction-sale-contract";

const NOW = new Date("2026-10-10T00:00:00Z");

const consignment = (over: Partial<OrgConsignmentContractListRow> = {}): OrgConsignmentContractListRow => ({
  id: "c1",
  code: "HDKG000015",
  contract_no: null,
  status: "drafting",
  service_request_id: "r1",
  posting_code: "HS-0070",
  title: "Shophouse Nam Định",
  child_slug: null,
  owner_name: "Nguyễn Hoàng Long",
  service_fee: 26_000_000,
  created_at: "2026-10-01T00:00:00Z",
  signed_at: null,
  updated_at: "2026-10-02T00:00:00Z",
  org_action: "share_draft",
  ...over,
});

const sale = (over: Partial<SaleContract> = {}): SaleContract =>
  ({
    id: "s1",
    code: "HDMB000001",
    contract_no: null,
    status: "awaiting_confirmation",
    session_id: "ss1",
    price: 3_000_000_000,
    org_signs: false,
    org_confirmed_at: null,
    seller_kind: "owner_user",
    seller_confirmed_at: null,
    buyer_confirmed_at: null,
    paid_at: null,
    handed_over_at: null,
    handover_scheduled_at: null,
    handover_due_at: null,
    sign_due_at: null,
    signed_at: null,
    draft_doc_path: null,
    signed_doc_path: null,
    consignment_contract_id: null,
    asset_snapshot: { title: "Nhà phố", lot_no: 2, session_code: "PDG000014" },
    buyer_party: { full_name: "Trần Văn B", bidder_no: "07" },
    created_at: "2026-10-03T00:00:00Z",
    updated_at: "2026-10-04T00:00:00Z",
    ...over,
  }) as unknown as SaleContract;

describe("hợp đồng ký gửi (cổng tổ chức)", () => {
  it("việc lấy từ org_action của server, mở ở trang hợp đồng", () => {
    const row = fromOrgConsignment(consignment());
    expect(row).toMatchObject({
      type: "ky-gui",
      needsAction: true,
      actionLabel: "Soạn & chia sẻ dự thảo",
      counterparty: "Nguyễn Hoàng Long",
      href: "/portal/hop-dong/ky-gui/c1",
    });
    expect(row.brief?.code).toBe("HS-0070");
  });

  it("đã ký / đã huỷ không còn việc; huỷ thì không còn thấy chủ tài sản", () => {
    expect(fromOrgConsignment(consignment({ status: "signed", org_action: null })).needsAction).toBe(false);
    const cancelled = fromOrgConsignment(consignment({ status: "cancelled", org_action: null, owner_name: null }));
    expect(cancelled).toMatchObject({ tone: "muted", counterparty: null, counterpartyRole: null });
  });
});

describe("hợp đồng mua bán (cổng tổ chức)", () => {
  it("nhân bản action_needed của org_sale_contract_counts", () => {
    expect(orgSaleActionOf(sale({ status: "drafting" }))).toBe("share_draft");
    // Hợp đồng 2 chữ ký, bên bán là chủ tài sản ⇒ tổ chức không phải xác nhận.
    expect(orgSaleActionOf(sale())).toBeNull();
    expect(orgSaleActionOf(sale({ org_signs: true }))).toBe("confirm_signed");
    expect(orgSaleActionOf(sale({ org_signs: true, org_confirmed_at: "x" }))).toBeNull();
    expect(orgSaleActionOf(sale({ seller_kind: "org_on_behalf" }))).toBe("confirm_signed");
    expect(orgSaleActionOf(sale({ status: "signed", paid_at: "x" }))).toBe("schedule_handover");
    expect(orgSaleActionOf(sale({ status: "signed", paid_at: "x", handover_scheduled_at: "y" }))).toBeNull();
  });

  it("quá hạn ký cũng là việc cần làm", () => {
    const row = fromOrgSale(sale({ sign_due_at: "2026-10-05T00:00:00Z" }), NOW);
    expect(row).toMatchObject({ needsAction: true, actionLabel: "Quá hạn ký", overdue: true, tone: "warning" });
  });

  it("dòng phụ = mã phiên + lô; bên mua kèm số báo danh; mở trang chi tiết mua bán", () => {
    const row = fromOrgSale(sale(), NOW);
    expect(row.brief).toMatchObject({ code: "PDG000014", category: "Lô 2" });
    expect(row.counterpartyRole).toBe("Bên mua · SBD 07");
    expect(row.href).toBe("/portal/hop-dong/mua-ban/s1");
  });
});

describe("lọc & sắp xếp", () => {
  const k = fromOrgConsignment(consignment({ org_action: null, status: "signed", updated_at: "2026-10-09T00:00:00Z" }));
  const m = fromOrgSale(sale({ status: "drafting" }), NOW);

  it("tab theo loại và Cần xử lý", () => {
    expect(matchesPortalContractTab("ky-gui", k)).toBe(true);
    expect(matchesPortalContractTab("ky-gui", m)).toBe(false);
    expect(matchesPortalContractTab("can-xu-ly", m)).toBe(true);
    expect(matchesPortalContractTab("can-xu-ly", k)).toBe(false);
  });

  it("tìm không dấu theo mã hồ sơ / bên kia", () => {
    expect(matchesPortalContractSearch(k, "hs-0070")).toBe(true);
    expect(matchesPortalContractSearch(m, "tran van")).toBe(true);
    expect(matchesPortalContractSearch(m, "nguyen hoang")).toBe(false);
  });

  it("bộ lọc mua bán không đụng dòng ký gửi", () => {
    const f = { session: "khac", stage: "all", overdue: "all" };
    expect(matchesPortalSaleFilters(m, f)).toBe(false);
    expect(matchesPortalSaleFilters(k, f)).toBe(true);
  });

  it("việc cần làm lên đầu dù cập nhật cũ hơn", () => {
    expect(sortPortalContractRows([k, m]).map((r) => r.type)).toEqual(["mua-ban", "ky-gui"]);
  });
});
