// Giai đoạn & nút bấm của hợp đồng mua bán. Mọi khẳng định ở đây phải trùng
// với thứ tự kiểm trong RPC tương ứng (20260914000001).

import { describe, expect, it } from "vitest";
import type { SaleContract, SaleSide } from "@/types/auction-sale-contract";
import {
  SALE_STEPS,
  awaitingSigningSides,
  canAttachSigned,
  canCancel,
  canConfirmHandover,
  canConfirmSigned,
  canEditTerms,
  canRecordPayment,
  canScheduleHandover,
  canSetTitleTransfer,
  canShareDraft,
  isSaleOpen,
  nextStepText,
  saleOverdueOf,
  saleStageOf,
  saleStepIndex,
} from "./stage";

type C = Parameters<typeof saleStageOf>[0];

const base = (o: Partial<SaleContract> = {}): C =>
  ({
    status: "drafting",
    paid_at: null,
    handed_over_at: null,
    signed_doc_path: null,
    draft_doc_path: null,
    org_signs: false,
    buyer_confirmed_at: null,
    seller_confirmed_at: null,
    org_confirmed_at: null,
    handover_buyer_confirmed_at: null,
    handover_seller_confirmed_at: null,
    sign_due_at: null,
    handover_due_at: null,
    handover_scheduled_at: null,
    ...o,
  }) as C;

const SIDES: SaleSide[] = ["buyer", "seller", "org"];

describe("saleStageOf — bản song sinh của SQL sale_contract_stage", () => {
  it("huỷ cắt ngang mọi thứ, kể cả khi đã trả đủ và bàn giao xong", () => {
    expect(saleStageOf(base({ status: "cancelled", paid_at: "x", handed_over_at: "y" }))).toBe("cancelled");
  });

  it("ba trạng thái ký đều là giai đoạn 'signing'", () => {
    for (const s of ["drafting", "awaiting_signatures", "awaiting_confirmation"] as const) {
      expect(saleStageOf(base({ status: s })), s).toBe("signing");
    }
  });

  it("đã ký nhưng chưa trả đủ ⇒ paying", () => {
    expect(saleStageOf(base({ status: "signed" }))).toBe("paying");
  });

  it("trả đủ nhưng chưa bàn giao ⇒ handover", () => {
    expect(saleStageOf(base({ status: "signed", paid_at: "2026-09-12" }))).toBe("handover");
  });

  it("trả đủ + bàn giao xong ⇒ completed kể cả khi status còn 'signed'", () => {
    expect(saleStageOf(base({ status: "signed", paid_at: "a", handed_over_at: "b" }))).toBe("completed");
  });

  it("status completed luôn là completed", () => {
    expect(saleStageOf(base({ status: "completed", paid_at: "a", handed_over_at: "b" }))).toBe("completed");
  });

  it("thanh tiến trình có 4 bước và cancelled KHÔNG nằm trên đó", () => {
    expect(SALE_STEPS.map((s) => s.key)).toEqual(["signing", "paying", "handover", "completed"]);
    expect(saleStepIndex("cancelled")).toBe(-1);
    expect(saleStepIndex("paying")).toBe(1);
  });
});

describe("saleOverdueOf — chỉ là cờ cảnh báo", () => {
  const past = "2020-01-01T00:00:00Z";
  const future = "2099-01-01T00:00:00Z";

  it("quá hạn ký khi còn ở giai đoạn ký", () => {
    const r = saleOverdueOf(base({ status: "awaiting_signatures", sign_due_at: past }), []);
    expect(r.sign).toBe(true);
    expect(r.any).toBe(true);
  });

  it("ký xong rồi thì hạn ký cũ KHÔNG còn kêu nữa", () => {
    const r = saleOverdueOf(base({ status: "signed", sign_due_at: past }), []);
    expect(r.sign).toBe(false);
  });

  it("quá hạn thanh toán khi có kỳ đến hạn còn thiếu tiền", () => {
    const r = saleOverdueOf(base({ status: "signed" }), [
      { due_at: past, amount: 100, paid_amount: 40 },
    ]);
    expect(r.payment).toBe(true);
  });

  it("kỳ đến hạn nhưng đã đóng đủ thì không kêu", () => {
    const r = saleOverdueOf(base({ status: "signed" }), [
      { due_at: past, amount: 100, paid_amount: 100 },
    ]);
    expect(r.payment).toBe(false);
  });

  it("kỳ chưa đến hạn thì không kêu", () => {
    const r = saleOverdueOf(base({ status: "signed" }), [
      { due_at: future, amount: 100, paid_amount: 0 },
    ]);
    expect(r.payment).toBe(false);
  });

  it("quá hạn bàn giao chỉ tính khi đã trả đủ", () => {
    expect(saleOverdueOf(base({ status: "signed", handover_due_at: past }), []).handover).toBe(false);
    expect(
      saleOverdueOf(base({ status: "signed", paid_at: "a", handover_due_at: past }), []).handover,
    ).toBe(true);
  });

  it("hợp đồng đã huỷ không bao giờ quá hạn", () => {
    const r = saleOverdueOf(base({ status: "cancelled", sign_due_at: past, handover_due_at: past }), [
      { due_at: past, amount: 100, paid_amount: 0 },
    ]);
    expect(r.any).toBe(false);
  });
});

describe("awaitingSigningSides", () => {
  it("chỉ đếm khi đang chờ xác nhận", () => {
    expect(awaitingSigningSides(base({ status: "awaiting_signatures" }))).toEqual([]);
  });

  it("hai bên chưa xác nhận", () => {
    expect(awaitingSigningSides(base({ status: "awaiting_confirmation" }))).toEqual(["buyer", "seller"]);
  });

  it("bên mua đã xác nhận thì chỉ còn bên bán", () => {
    expect(
      awaitingSigningSides(base({ status: "awaiting_confirmation", buyer_confirmed_at: "x" })),
    ).toEqual(["seller"]);
  });

  it("hợp đồng ba chữ ký đếm cả tổ chức", () => {
    expect(
      awaitingSigningSides(base({ status: "awaiting_confirmation", org_signs: true })),
    ).toEqual(["buyer", "seller", "org"]);
  });
});

describe("quyền thao tác", () => {
  it("chỉ tổ chức chia sẻ dự thảo, và chỉ khi chưa ký", () => {
    for (const s of SIDES) {
      expect(canShareDraft(base(), s), s).toBe(s === "org");
    }
    expect(canShareDraft(base({ status: "signed" }), "org")).toBe(false);
  });

  it("bên mua/bên bán luôn tải được bản ký; tổ chức chỉ khi là bên ký thứ ba", () => {
    expect(canAttachSigned(base(), "buyer")).toBe(true);
    expect(canAttachSigned(base(), "seller")).toBe(true);
    expect(canAttachSigned(base(), "org")).toBe(false);
    expect(canAttachSigned(base({ org_signs: true }), "org")).toBe(true);
  });

  it("xác nhận cần đúng trạng thái, có tệp, và chưa tự xác nhận", () => {
    const c = base({ status: "awaiting_confirmation", signed_doc_path: "p" });
    expect(canConfirmSigned(c, "buyer")).toBe(true);
    expect(canConfirmSigned(base({ ...c, buyer_confirmed_at: "x" } as Partial<SaleContract>), "buyer")).toBe(false);
    expect(canConfirmSigned(base({ status: "awaiting_confirmation" }), "buyer")).toBe(false);
  });

  it("huỷ được cả khi ĐÃ KÝ (hai bên thoả thuận), không được khi đã huỷ/hoàn tất", () => {
    expect(canCancel(base({ status: "signed" }))).toBe(true);
    expect(canCancel(base({ status: "cancelled" }))).toBe(false);
    expect(canCancel(base({ status: "completed" }))).toBe(false);
  });

  it("sửa điều khoản: chỉ tổ chức, chưa ký, và sổ tiền còn trống", () => {
    expect(canEditTerms(base(), "org", false)).toBe(true);
    expect(canEditTerms(base(), "org", true)).toBe(false);
    expect(canEditTerms(base({ status: "signed" }), "org", false)).toBe(false);
    expect(canEditTerms(base(), "buyer", false)).toBe(false);
  });

  it("ghi nhận tiền: chỉ tổ chức, cho phép TRƯỚC khi ký", () => {
    expect(canRecordPayment(base({ status: "drafting" }), "org")).toBe(true);
    expect(canRecordPayment(base({ status: "cancelled" }), "org")).toBe(false);
    expect(canRecordPayment(base({ status: "signed" }), "buyer")).toBe(false);
  });

  it("hẹn bàn giao: tổ chức, sau khi ký, chưa bàn giao", () => {
    expect(canScheduleHandover(base({ status: "signed" }), "org")).toBe(true);
    expect(canScheduleHandover(base({ status: "signed", handed_over_at: "x" }), "org")).toBe(false);
    expect(canScheduleHandover(base({ status: "drafting" }), "org")).toBe(false);
  });

  it("xác nhận bàn giao là việc của HAI BÊN, tổ chức không làm thay", () => {
    const c = base({ status: "signed", paid_at: "a" });
    expect(canConfirmHandover(c, "buyer")).toBe(true);
    expect(canConfirmHandover(c, "seller")).toBe(true);
    expect(canConfirmHandover(c, "org")).toBe(false);
  });

  it("sang tên: tổ chức ghi nhận, kể cả sau khi hoàn tất", () => {
    expect(canSetTitleTransfer(base({ status: "completed" }), "org")).toBe(true);
    expect(canSetTitleTransfer(base({ status: "cancelled" }), "org")).toBe(false);
    expect(canSetTitleTransfer(base({ status: "signed" }), "buyer")).toBe(false);
  });

  it("isSaleOpen", () => {
    expect(isSaleOpen({ status: "drafting" })).toBe(true);
    expect(isSaleOpen({ status: "completed" })).toBe(false);
    expect(isSaleOpen({ status: "cancelled" })).toBe(false);
  });
});

describe("nextStepText — luôn có câu, không bao giờ rỗng", () => {
  it("mỗi giai đoạn một câu nhắc khác nhau", () => {
    const seen = new Set<string>();
    for (const c of [
      base({ status: "drafting" }),
      base({ status: "awaiting_signatures" }),
      base({ status: "awaiting_confirmation" }),
      base({ status: "signed" }),
      base({ status: "signed", paid_at: "a" }),
      base({ status: "signed", paid_at: "a", handover_scheduled_at: "b" }),
      base({ status: "completed", paid_at: "a", handed_over_at: "b" }),
      base({ status: "cancelled" }),
    ]) {
      const t = nextStepText(c);
      expect(t.length).toBeGreaterThan(5);
      seen.add(t);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });
});
