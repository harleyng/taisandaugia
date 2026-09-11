// Chụp ảnh (snapshot) một tài sản nguồn thành lô trong phiên.
//
// VÌ SAO snapshot: tổ chức không đọc được asset_postings (RLS owner-only), trang
// công khai cũng không nên JOIN sang nguồn — tin có thể bị ẩn / xoá, hồ sơ ký gửi
// là riêng tư. Giá trị ở đây chỉ là PREFILL, tổ chức sửa lại được trước khi công bố.

import { startValueOf } from "@/lib/reports/listingsReport";
import { caNumber, type AuctionListing } from "@/types/listing";
import type { OrgServiceRequest } from "@/types/consignment";
import type { SessionItemDraft } from "@/types/auction-session";
import { depositFromPlan } from "./deposit";

const money = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) || v < 0 ? null : Math.round(v);

export type SourceListing = Pick<
  AuctionListing,
  "id" | "title" | "price" | "price_unit" | "area" | "image_url" | "property_type_slug" | "address" | "custom_attributes"
>;

/** Tin đấu giá công khai → lô. Giá thuê/tháng không quy đổi được ⇒ để trống. */
export function listingToItemDraft(l: SourceListing): SessionItemDraft {
  const ca = (l.custom_attributes ?? {}) as Record<string, unknown>;
  return {
    source: "listing",
    listing_id: l.id,
    title: l.title,
    category_slug: l.property_type_slug ?? null,
    province: l.address?.province ?? null,
    district: l.address?.district ?? null,
    image_url: l.image_url ?? null,
    starting_price: money(startValueOf(l.price, l.price_unit, l.area)),
    deposit_amount: money(caNumber(ca.deposit_amount)),
    bid_step: money(caNumber(ca.bid_step ?? ca.step_price)),
  };
}

/** Tài sản ký gửi đã trúng → lô. Ưu tiên số trong BÁO GIÁ tổ chức đã chào. */
export function wonRequestToItemDraft(r: OrgServiceRequest): SessionItemDraft {
  const startingPrice = money(r.quote_starting_price ?? r.starting_price);
  const plan = r.quote_plan;
  return {
    source: "posting",
    asset_posting_id: r.posting_id,
    title: r.title,
    category_slug: r.child_slug || r.parent_slug || null,
    province: r.province,
    district: r.district,
    image_url: r.image_urls?.[0] ?? null,
    starting_price: startingPrice,
    deposit_amount: plan ? depositFromPlan(plan.deposit_mode, plan.deposit_value, startingPrice) : null,
    bid_step: money(plan?.price_step ?? null),
  };
}
