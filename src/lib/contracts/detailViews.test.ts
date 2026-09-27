import { describe, expect, it } from "vitest";
import type { ConsignmentContract, ContractEvent } from "@/types/consignment-contract";
import type { SaleContractDetail } from "@/types/auction-sale-contract";
import type { ServiceContractDetail } from "@/types/service-contract";
import {
  consignmentActivity,
  consignmentFee,
  consignmentNextStep,
  consignmentStepper,
  consignmentTerms,
} from "./consignmentView";
import { ownerSides, saleNextStep, saleStepper, saleSummary, saleTerms } from "./saleView";
import { serviceNextStep, serviceStepper } from "./serviceView";
import { postingIdOfRow, toPostingBrief } from "./postingBrief";

const consignment = (over: Partial<ConsignmentContract> = {}) =>
  ({
    status: "awaiting_confirmation",
    terms: {
      commission_pct: 1.2,
      service_fee: null,
      starting_price: 4_300_000_000,
      lead_time_days: 30,
      plan: null,
      fee_items: [
        { key: "thu-lao", label: "Thù lao đấu giá", amount: 51_600_000, optional: false },
        { key: "ho-so", label: "Phí hồ sơ", amount: 1_000_000, optional: false },
        { key: "qc", label: "Quảng cáo mở rộng", amount: 2_000_000, optional: true },
      ],
      note: null,
      quote_doc_path: null,
      quoted_at: null,
    },
    created_at: "2026-09-20T07:30:00Z",
    draft_uploaded_at: "2026-09-24T09:05:00Z",
    signed_uploaded_at: "2026-09-26T03:42:00Z",
    signed_uploaded_side: "org",
    signed_doc_path: "x/signed.pdf",
    owner_confirmed_at: null,
    org_confirmed_at: "2026-09-26T03:42:00Z",
    signed_at: null,
    signed_date: null,
    cancelled_at: null,
    cancelled_side: null,
    cancel_reason: null,
    contract_no: null,
    ...over,
  }) as ConsignmentContract;

describe("ký gửi", () => {
  it("stepper follows status, dates from the contract timestamps", () => {
    const v = consignmentStepper(consignment());
    expect(v.current).toBe(2);
    expect(v.steps.map((s) => s.date)).toEqual(["20/09", "24/09", "26/09", null]);
    expect(consignmentStepper(consignment({ status: "signed", signed_at: "2026-09-28T00:00:00Z" })).finished).toBe(true);
  });

  it("cancelled stops at the last step reached", () => {
    const v = consignmentStepper(
      consignment({ status: "cancelled", signed_uploaded_at: null, cancelled_at: "2026-09-25T00:00:00Z" }),
    );
    expect(v).toMatchObject({ current: 1, cancelled: true });
  });

  it("confirming the signed copy is the owner's job", () => {
    expect(consignmentNextStep(consignment(), "Sài Gòn Phát", false)).toMatchObject({
      headline: "Xác nhận bản đã ký",
      mine: true,
    });
    expect(
      consignmentNextStep(consignment({ owner_confirmed_at: "2026-09-26T05:00:00Z" }), "Sài Gòn Phát", false),
    ).toMatchObject({ headline: "Chờ Sài Gòn Phát xác nhận bản đã ký", mine: false });
    expect(consignmentNextStep(consignment({ status: "drafting" }), "Thăng Long", true)).toMatchObject({
      headline: "Bổ sung địa chỉ Bên A",
      mine: true,
    });
  });

  it("fee total counts only required items", () => {
    expect(consignmentFee(consignment())).toBe(52_600_000);
    const t = consignmentTerms(consignment());
    expect(t.rows.map((r) => [r.title, !!r.dim, !!r.total])).toEqual([
      ["Thù lao đấu giá", false, false],
      ["Phí hồ sơ", false, false],
      ["Quảng cáo mở rộng", true, false],
      ["Tổng chi phí dịch vụ", false, true],
    ]);
  });

  it("activity is newest first and names the actor", () => {
    const events: ContractEvent[] = [
      { action: "created", side: "owner", created_at: "2026-09-20T07:30:00Z", data: null },
      { action: "signed_uploaded", side: "org", created_at: "2026-09-26T03:42:00Z", data: null },
    ];
    expect(consignmentActivity(events, "Sài Gòn Phát", null).map((a) => a.text)).toEqual([
      "Sài Gòn Phát tải bản đã ký",
      "Bạn chốt báo giá — hợp đồng được tạo",
    ]);
  });
});

const sale = (over: Partial<SaleContractDetail["contract"]> = {}): SaleContractDetail =>
  ({
    ok: true,
    stage: "paying",
    balance: 8_680_000_000,
    net_paid: 3_720_000_000,
    payments: [],
    events: [],
    can_act: { buyer: false, seller: true, org: false },
    installments: [
      { id: "i1", seq: 1, label: "Tiền đặt trước", amount: 1_240_000_000, paid_amount: 1_240_000_000, due_at: "2026-09-23T00:00:00Z" },
      { id: "i2", seq: 2, label: "Đợt 2", amount: 8_680_000_000, paid_amount: 0, due_at: "2099-10-22T00:00:00Z" },
    ],
    contract: {
      status: "signed",
      price: 12_400_000_000,
      signed_at: "2026-09-24T00:00:00Z",
      paid_at: null,
      handed_over_at: null,
      completed_at: null,
      handover_scheduled_at: null,
      handover_buyer_confirmed_at: null,
      handover_seller_confirmed_at: null,
      sign_due_at: null,
      handover_due_at: null,
      buyer_party: { full_name: "Công ty CP An Khang" },
      org_party: { name: "Công ty ĐGHD Sài Gòn Phát" },
      asset_snapshot: { session_code: "PDG000112", lot_no: 1 },
      contract_no: "41/2026/HĐMB",
      ...over,
    },
  }) as unknown as SaleContractDetail;

describe("mua bán", () => {
  it("owner portal only acts as seller / buyer", () => {
    expect(ownerSides({ buyer: false, seller: true, org: true })).toEqual(["seller"]);
  });

  it("paying stage shows next due date and payment notes", () => {
    const d = sale();
    expect(saleStepper(d)).toMatchObject({ current: 1, finished: false });
    expect(saleNextStep(d, ["seller"])).toMatchObject({ headline: "Chờ bên mua thanh toán", mine: false, aux: "Hạn đợt tới 22/10/2099" });
    expect(saleTerms(d).rows.map((r) => r.note?.text)).toEqual(["Đã thu", "Chưa đến hạn"]);
  });

  it("handover is the seller's job once paid", () => {
    const d = sale({ paid_at: "2026-09-25T00:00:00Z" });
    expect(saleNextStep(d, ["seller"])).toMatchObject({ headline: "Xác nhận bàn giao tài sản", mine: true });
  });

  it("summary shows price, collected share and remaining", () => {
    const s = saleSummary(sale());
    expect(s.bigValue).toBe("12.4 tỷ");
    expect(s.progress).toBe(30);
    expect(s.rows.find((r) => r.label === "Phiên")?.value).toBe("PDG000112 · Lô 1");
    expect(s.rows.find((r) => r.label === "Tổ chức")?.value).toBe("ĐGHD Sài Gòn Phát");
  });
});

describe("dịch vụ", () => {
  const svc = (status: string, over: Partial<NonNullable<ServiceContractDetail["order"]>> = {}) =>
    ({
      is_current: true,
      accepted_by_name: "Trần Văn Phát",
      contract: {
        accepted_at: "2026-09-12T09:40:00Z",
        provider_party: { name: "Sàn Tài Sản Đấu Giá", partner_name: "Silver Sea" },
      },
      order: { status, quoted_at: null, quoted_price: null, paid_at: null, done_at: null, cancelled_at: null, ...over },
    }) as unknown as ServiceContractDetail;

  it("an accepted quote waits for payment — the owner's job", () => {
    expect(serviceStepper(svc("quoted")).current).toBe(1);
    expect(serviceNextStep(svc("quoted"))).toMatchObject({ headline: "Thanh toán phí dịch vụ", mine: true });
  });

  it("a requote voids the contract", () => {
    const d = { ...svc("quoted"), is_current: false } as ServiceContractDetail;
    expect(serviceStepper(d).cancelled).toBe(true);
    expect(serviceNextStep(d).headline).toBe("Sàn đã báo giá lại");
  });
});

describe("posting brief", () => {
  it("maps a posting row and resolves a sale row through its consignment", () => {
    expect(
      toPostingBrief({
        id: "p1",
        code: "HS-0142",
        title: "Căn hộ",
        child_slug: "can-ho-chung-cu",
        district: "Bình Thạnh",
        province: "TP.HCM",
        image_urls: ["", "a.jpg"],
      }),
    ).toMatchObject({ code: "HS-0142", location: "Bình Thạnh, TP.HCM", imageUrl: "a.jpg" });
    const map = new Map([["cc1", "p9"]]);
    expect(postingIdOfRow({ postingId: null, consignmentContractId: "cc1" }, map)).toBe("p9");
    expect(postingIdOfRow({ postingId: "p1", consignmentContractId: null }, map)).toBe("p1");
  });
});
