// Kiểu dùng chung cho bảng `listings` và hai cột JSONB của nó.
//
// Trước đây `AuctionListing` được khai báo tay trong useAuctionListings.tsx với
// `address: any` + `custom_attributes: any`, và chỉ liệt kê 15/N cột. Hệ quả là
// call site phải `as any` hai lần: một lần để đọc JSONB, một lần nữa để với tới
// những cột không được liệt kê (`updated_at`, `auction_org_id`…). Đó là nguồn
// gốc của phần lớn lỗi no-explicit-any trong domain đấu giá.
//
// Nay lấy kiểu thẳng từ types.ts sinh tự động, chỉ thay riêng hai cột JSONB.

import type { Tables } from "@/integrations/supabase/types";

/** Cột JSONB `listings.address`. Mọi trường đều tuỳ chọn — dữ liệu cũ thiếu trường. */
export interface ListingAddress {
  street?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
}

/**
 * Cột JSONB `listings.custom_attributes`.
 *
 * CỐ Ý để khoá mở: schema của cột này khác nhau theo loại tài sản (QSDĐ, tang
 * vật, phương tiện…) và còn đang mở rộng. Khoá đóng sẽ vỡ mỗi lần thêm loại
 * tài sản mới. Giá trị là `unknown` chứ không phải `any`, nên nơi đọc buộc
 * phải thu hẹp kiểu — dùng caNumber/caString/caStringArray bên dưới.
 */
export type ListingCustomAttributes = Record<string, unknown>;

/** Cột JSONB `listings.coordinates` — toạ độ để dựng bản đồ Leaflet. */
export interface ListingCoordinates {
  lat?: number | null;
  lng?: number | null;
}

/** Một dòng `listings` với cả ba cột JSONB đã được gán kiểu. */
export type AuctionListing = Omit<
  Tables<"listings">,
  "address" | "custom_attributes" | "coordinates"
> & {
  address: ListingAddress | null;
  custom_attributes: ListingCustomAttributes | null;
  coordinates: ListingCoordinates | null;
};

/**
 * Ép một dòng `listings` thô (address/custom_attributes vẫn là `Json`) về
 * AuctionListing, GIỮ NGUYÊN mọi cột join thêm (vd. `property_types(name, slug)`).
 *
 * Supabase sinh kiểu hai cột JSONB là `Json`, không mô tả được nội dung bên
 * trong. Thay vì rải `as any` ở từng nơi đọc, ép đúng một lần tại chỗ fetch.
 */
export function toAuctionListing<
  T extends { address: unknown; custom_attributes: unknown; coordinates?: unknown },
>(
  row: T,
): Omit<T, "address" | "custom_attributes" | "coordinates"> & {
  address: ListingAddress | null;
  custom_attributes: ListingCustomAttributes | null;
  coordinates: ListingCoordinates | null;
} {
  return {
    ...row,
    address: (row.address ?? null) as ListingAddress | null,
    custom_attributes: (row.custom_attributes ?? null) as ListingCustomAttributes | null,
    coordinates: (row.coordinates ?? null) as ListingCoordinates | null,
  };
}

// ─── Thu hẹp kiểu cho giá trị đọc từ custom_attributes ───────────────────────

/** Số từ JSONB. Chấp nhận cả chuỗi có phân tách nhóm ("1,500,000") → 1500000. */
export function caNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Chuỗi từ JSONB. Số cũng được ép về chuỗi vì dữ liệu cũ lưu lẫn hai kiểu. */
export function caString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

/** Mảng chuỗi từ JSONB; phần tử không phải chuỗi bị loại bỏ. */
export function caStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Mảng object từ JSONB (đính kèm, tài sản con…). */
export function caRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
}

/**
 * Địa danh ngắn để hiển thị trên thẻ tin đăng.
 * Trước đây bị chép nguyên văn ở AuctionSection.tsx và CompletedAuctions.tsx.
 */
export function getShortLocation(address: ListingAddress | null | undefined): string {
  if (!address) return "";
  return address.province || address.district || "";
}
