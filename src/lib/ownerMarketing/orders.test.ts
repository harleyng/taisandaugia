import { describe, expect, it } from "vitest";
import {
  MKT_ORDER_BENEFIT,
  MKT_ORDER_PACKAGES,
  MKT_PACKAGE_META,
  MKT_PICKABLE_PACKAGES,
  MktOrderError,
  adminNextAction,
  expectedQuoteBy,
  isQuoteExpired,
  mktOrderCheckoutPath,
  mktOrderErrorMessage,
  needsOwnerAction,
  orderFilterOf,
  orderTimeline,
  ownerNextStep,
  ownerOrderHeadline,
  ownerOrdersHref,
  unwrapMktOrderRpc,
  type MktOrderTimes,
} from "./orders";

const NOW = new Date("2026-10-02T10:00:00+07:00").getTime();
const PAST = "2026-10-01T10:00:00+07:00";
const FUTURE = "2026-10-05T10:00:00+07:00";

const order = (over: Partial<MktOrderTimes>): MktOrderTimes => ({
  status: "requested",
  pricing: "quote",
  quote_expires_at: null,
  created_at: "2026-09-30T09:00:00+07:00",
  quoted_at: null,
  paid_at: null,
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  ...over,
});

describe("gói", () => {
  it("khớp owner_mkt_order_variant_keys() và KHÔNG bán gói email (đang hoãn)", () => {
    expect([...MKT_ORDER_PACKAGES]).toEqual(["mkt_featured_owner", "mkt_social_owner", "mkt_banner_owner", "mkt_full_owner"]);
    expect(MKT_ORDER_PACKAGES as readonly string[]).not.toContain("mkt_email_owner");
  });

  it("hộp chọn gói không chào bài đăng mạng xã hội", () => {
    expect([...MKT_PICKABLE_PACKAGES]).toEqual(["mkt_featured_owner", "mkt_banner_owner", "mkt_full_owner"]);
  });

  it("giá cố định = credit, banner / trọn gói = báo giá", () => {
    expect(MKT_PACKAGE_META.mkt_featured_owner.pricing).toBe("credits");
    expect(MKT_PACKAGE_META.mkt_social_owner.pricing).toBe("credits");
    expect(MKT_PACKAGE_META.mkt_banner_owner.pricing).toBe("quote");
    expect(MKT_PACKAGE_META.mkt_full_owner.pricing).toBe("quote");
  });

  it("chỉ tin nổi bật dùng hạn mức gói dịch vụ (owner_mkt_order_benefit_key)", () => {
    expect(MKT_ORDER_BENEFIT).toEqual({ mkt_featured_owner: "priority_listing" });
  });
});

describe("trạng thái", () => {
  it("báo giá hết hạn chỉ tính ở quoted", () => {
    expect(isQuoteExpired(order({ status: "quoted", quote_expires_at: PAST }), NOW)).toBe(true);
    expect(isQuoteExpired(order({ status: "quoted", quote_expires_at: FUTURE }), NOW)).toBe(false);
    expect(isQuoteExpired(order({ status: "paid", quote_expires_at: PAST }), NOW)).toBe(false);
  });

  it("việc của chủ tài sản = báo giá còn hạn", () => {
    expect(needsOwnerAction(order({ status: "quoted", quote_expires_at: FUTURE }), NOW)).toBe(true);
    expect(needsOwnerAction(order({ status: "quoted", quote_expires_at: PAST }), NOW)).toBe(false);
    expect(needsOwnerAction(order({ status: "requested" }), NOW)).toBe(false);
  });

  it("việc tiếp theo hai phía", () => {
    expect(ownerNextStep(order({ status: "quoted", quote_expires_at: PAST }), NOW)).toMatch(/hết hạn/);
    expect(ownerNextStep(order({ status: "quoted", quote_expires_at: FUTURE }), NOW)).toMatch(/thanh toán/);
    expect(adminNextAction(order({ status: "requested" }), NOW)).toBe("Báo giá");
    expect(adminNextAction(order({ status: "paid" }), NOW)).toBe("Nhận việc");
    expect(adminNextAction(order({ status: "quoted", quote_expires_at: PAST }), NOW)).toMatch(/Báo giá lại/);
  });

  it("nhóm lọc", () => {
    expect(orderFilterOf("in_progress")).toBe("dang-mo");
    expect(orderFilterOf("completed")).toBe("hoan-tat");
    expect(orderFilterOf("cancelled")).toBe("da-huy");
  });
});

describe("dòng thời gian", () => {
  it("gói giá cố định bỏ bước báo giá; bước kế tiếp là 'current'", () => {
    const steps = orderTimeline(order({ pricing: "credits", status: "paid", paid_at: "2026-09-30T09:00:00+07:00" }));
    expect(steps.map((s) => s.key)).toEqual(["requested", "paid", "in_progress", "completed"]);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "todo"]);
  });

  it("gói báo giá có bước báo giá", () => {
    const steps = orderTimeline(order({ status: "quoted", quoted_at: "2026-10-01T09:00:00+07:00" }));
    expect(steps.map((s) => s.key)).toEqual(["requested", "quoted", "paid", "in_progress", "completed"]);
    expect(steps[2].state).toBe("current");
  });

  it("đơn huỷ không có bước 'current'", () => {
    const steps = orderTimeline(order({ status: "cancelled", cancelled_at: PAST }));
    expect(steps.some((s) => s.state === "current")).toBe(false);
  });
});

describe("RPC & đường dẫn", () => {
  it("unwrap ném lỗi có lý do, thông điệp tiếng Việt", () => {
    expect(unwrapMktOrderRpc({ ok: true, code: "GVS000001" }).code).toBe("GVS000001");
    let caught: unknown;
    try {
      unwrapMktOrderRpc({ ok: false, reason: "insufficient" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MktOrderError);
    expect(mktOrderErrorMessage(caught)).toMatch(/credit không đủ/);
    expect(mktOrderErrorMessage(new MktOrderError("la_hoac"))).toMatch(/thử lại/);
  });

  it("link đặt gói cho một tài sản + trang thanh toán quay về chi tiết đơn", () => {
    expect(ownerOrdersHref("abc")).toBe("/chu-tai-san/truyen-thong?tab=giao-viec&dat=abc");
    const checkout = new URL(mktOrderCheckoutPath("o1"), "https://x.vn");
    expect(checkout.pathname).toBe("/payment/vnpay");
    expect(checkout.searchParams.get("mkt_order")).toBe("o1");
    expect(checkout.searchParams.get("return")).toBe("/chu-tai-san/truyen-thong/giao-viec/o1");
  });
});

describe("hero trang chi tiết đơn", () => {
  it("câu tình trạng theo trạng thái; huỷ phân biệt trước / sau thanh toán", () => {
    expect(ownerOrderHeadline(order({ status: "quoted", quote_expires_at: FUTURE }), NOW)).toMatch(/Thanh toán/);
    expect(ownerOrderHeadline(order({ status: "quoted", quote_expires_at: PAST }), NOW)).toMatch(/hết hạn/);
    expect(ownerOrderHeadline(order({ status: "cancelled" }), NOW)).toMatch(/trước khi thanh toán/);
    expect(ownerOrderHeadline(order({ status: "cancelled", paid_at: PAST }), NOW)).toMatch(/sau khi thanh toán/);
  });

  it("báo giá dự kiến: 1 ngày làm việc, bỏ qua cuối tuần", () => {
    // Thứ Sáu 02/10/2026 → Thứ Hai 05/10.
    expect(expectedQuoteBy("2026-10-02T09:00:00+07:00").getDate()).toBe(5);
  });
});
