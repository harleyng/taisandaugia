import { describe, expect, it } from "vitest";
import { listingToItemDraft, wonRequestToItemDraft, type SourceListing } from "./snapshot";
import type { OrgServiceRequest } from "@/types/consignment";

const listing = (over: Partial<SourceListing> = {}): SourceListing =>
  ({
    id: "l1",
    title: "Nhà phố Đống Đa",
    price: 12_000_000_000,
    price_unit: "TOTAL",
    area: 80,
    image_url: "https://x/img.jpg",
    property_type_slug: "nha-pho",
    address: { province: "Hà Nội", district: "Đống Đa" },
    custom_attributes: { deposit_amount: 1_200_000_000, step_price: "50000000" },
    ...over,
  }) as SourceListing;

describe("listingToItemDraft", () => {
  it("lấy giá khởi điểm, cọc, bước giá (key thay thế step_price) và địa bàn", () => {
    const d = listingToItemDraft(listing());
    expect(d).toMatchObject({
      source: "listing",
      listing_id: "l1",
      starting_price: 12_000_000_000,
      deposit_amount: 1_200_000_000,
      province: "Hà Nội",
      district: "Đống Đa",
      category_slug: "nha-pho",
    });
    expect(d.bid_step).toBe(50_000_000);
  });

  it("giá theo m² được quy đổi, giá thuê/tháng thì để trống", () => {
    expect(listingToItemDraft(listing({ price: 100_000_000, price_unit: "PER_SQM" })).starting_price).toBe(
      8_000_000_000,
    );
    expect(listingToItemDraft(listing({ price_unit: "PER_MONTH" })).starting_price).toBeNull();
  });
});

describe("wonRequestToItemDraft", () => {
  const req = (over: Partial<OrgServiceRequest> = {}) =>
    ({
      posting_id: "p1",
      title: "Nhà phố Quận 5",
      parent_slug: "bat-dong-san",
      child_slug: "nha-pho",
      province: "TP. Hồ Chí Minh",
      district: "Quận 5",
      starting_price: 10_000_000_000,
      quote_starting_price: 12_500_000_000,
      image_urls: ["https://x/a.jpg", "https://x/b.jpg"],
      quote_plan: { price_step: 100_000_000, deposit_mode: "percent", deposit_value: 10 },
      ...over,
    }) as OrgServiceRequest;

  it("ưu tiên giá trong báo giá, cọc % quy ra VNĐ, ảnh đầu tiên", () => {
    expect(wonRequestToItemDraft(req())).toMatchObject({
      source: "posting",
      asset_posting_id: "p1",
      starting_price: 12_500_000_000,
      deposit_amount: 1_250_000_000,
      bid_step: 100_000_000,
      image_url: "https://x/a.jpg",
      category_slug: "nha-pho",
    });
  });

  it("không có báo giá chi tiết ⇒ lấy giá chủ tài sản, không bịa cọc / bước giá", () => {
    const d = wonRequestToItemDraft(req({ quote_starting_price: null, quote_plan: null, image_urls: null }));
    expect(d.starting_price).toBe(10_000_000_000);
    expect(d.deposit_amount).toBeNull();
    expect(d.bid_step).toBeNull();
    expect(d.image_url).toBeNull();
  });
});
