import { describe, expect, it } from "vitest";
import { campaignSchema } from "@/lib/marketing/campaignSchema";
import { buildAdPrefill, buildEmailPrefill, orderListingUrl } from "./fulfilment";

const ORDER = { id: "o1", code: "GVS000007", listing_id: "l1", listing_title: "Kho xưởng 168.8m² tại Cần Thơ" };
const LISTING = {
  id: "l1",
  title: "Kho xưởng 168.8m² tại Cần Thơ",
  price: 2500000000,
  address: { district: "Ninh Kiều", province: "Cần Thơ" },
  custom_attributes: {
    auction_time: "2026-10-20T09:00:00+07:00",
    registration_deadline: "2026-10-15T17:00:00+07:00",
    asset_owner_name: "Ngân hàng X",
  },
};

describe("điền sẵn từ đơn", () => {
  it("link tin gắn utm theo mã đơn", () => {
    expect(orderListingUrl("https://x.vn", ORDER, "email")).toBe(
      "https://x.vn/listings/l1?utm_source=email&utm_campaign=gvs000007",
    );
    expect(orderListingUrl("https://x.vn", { ...ORDER, listing_id: null }, "banner")).toBe("https://x.vn");
  });

  it("email: dữ kiện tin, đối tượng người mua cùng tỉnh, qua được schema của trình soạn", () => {
    const e = buildEmailPrefill(ORDER, LISTING, "https://x.vn");
    expect(e.content_html).toContain("2,500,000,000₫");
    expect(e.content_html).toContain("utm_campaign=gvs000007");
    expect(e.content_html).not.toContain("Ngân hàng X");
    expect(e.audience.kind).toBe("criteria");
    expect(e.audience.criteria.accountTypes).toEqual(["buyer"]);
    expect(e.audience.criteria.provinces).toEqual(["Cần Thơ"]);
    const parsed = campaignSchema.safeParse({
      name: e.name,
      notes: e.notes,
      subject: e.subject,
      preview_text: e.preview_text,
      schedule_type: "immediate",
      scheduled_at: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("email vẫn dựng được khi không đọc được tin", () => {
    const e = buildEmailPrefill(ORDER, null, "https://x.vn");
    expect(e.subject).toContain(ORDER.listing_title);
    expect(e.audience.criteria.provinces).toEqual([]);
  });

  it("thoát HTML trong tiêu đề tin", () => {
    const e = buildEmailPrefill(ORDER, { ...LISTING, title: "Nhà <b>đẹp</b>" }, "https://x.vn");
    expect(e.content_html).toContain("Nhà &lt;b&gt;đẹp&lt;/b&gt;");
  });

  it("banner: tên + đích bấm", () => {
    expect(buildAdPrefill(ORDER, "https://x.vn")).toEqual({
      name: "GVS000007 · Kho xưởng 168.8m² tại Cần Thơ",
      nav_url: "https://x.vn/listings/l1?utm_source=banner&utm_campaign=gvs000007",
    });
  });
});
