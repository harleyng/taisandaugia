import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import { useListingById } from "@/hooks/useListingById";
import { caRecordArray, caString, caStringArray } from "@/types/listing";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Nội dung khối "Chi tiết tài sản" của phòng đấu giá.
 *
 * Lô là SNAPSHOT (ảnh, tên, giá, loại, địa bàn). Lô lấy từ tin đăng (`listing`)
 * thì đọc thêm mô tả + thông số + tệp đính kèm từ `listings` (RLS cho công khai
 * đọc tin ACTIVE/SOLD_RENTED). Lô từ hồ sơ số hoá (`posting`) KHÔNG đọc được
 * asset_postings từ phía người mua ⇒ chỉ còn phần snapshot.
 */

export interface LotDoc {
  name: string;
  url: string;
}

export interface LotDetail {
  images: string[];
  description: string | null;
  specs: [string, string][];
  docs: LotDoc[];
  loading: boolean;
}

const categoryName = (slug: string | null) => (slug ? (CHILD_NAME[slug] ?? PARENT_NAME[slug] ?? null) : null);

export function useLotDetail(lot: AuctionSessionItem): LotDetail {
  const listingId = lot.source === "listing" ? lot.listing_id : null;
  const { data: listing, isLoading } = useListingById(listingId ?? undefined);

  const ca = listing?.custom_attributes ?? {};
  const address = listing?.address;
  const location =
    [address?.street, address?.ward, address?.district, address?.province ?? address?.city].filter(Boolean).join(", ") ||
    [lot.district, lot.province].filter(Boolean).join(", ");

  const specs: [string, string | null][] = [
    ["Loại tài sản", categoryName(lot.category_slug) ?? listing?.property_types?.name ?? null],
    ["Diện tích", listing?.area != null ? `${listing.area.toLocaleString("en-US")} m²` : null],
    ["Số phòng ngủ", listing?.num_bedrooms != null ? String(listing.num_bedrooms) : null],
    ["Số tầng", listing?.num_floors != null ? String(listing.num_floors) : null],
    ["Mặt tiền", listing?.facade_width != null ? `${listing.facade_width} m` : null],
    ["Hướng nhà", listing?.house_direction ?? null],
    ["Pháp lý", listing?.legal_status ?? null],
    ["Nội thất", listing?.interior_status ?? null],
    ["Địa chỉ", location || null],
  ];

  const images = [lot.image_url ?? listing?.image_url ?? null, ...caStringArray(ca.images)].filter(
    (src, i, all): src is string => !!src && all.indexOf(src) === i,
  );

  return {
    images,
    description: listing?.description?.trim() || null,
    specs: specs.filter((s): s is [string, string] => !!s[1]),
    docs: caRecordArray(ca.attachments)
      .map((f) => ({ name: caString(f.name) ?? "Tệp đính kèm", url: caString(f.url) ?? "" }))
      .filter((d) => d.url),
    loading: !!listingId && isLoading,
  };
}
