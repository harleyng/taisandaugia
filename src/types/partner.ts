export type PartnerStatus = "active" | "inactive";

export interface PartnerStat {
  label: string;
  value: string;
}

/** Thẻ trình bày trên trang chủ ("Đối tác trên sàn").
 *  Công ty được nhập MỘT LẦN ở module Đối tác (bảng suppliers); thẻ này chỉ
 *  chọn ra một đối tác rồi bổ sung phần trình bày (badge, màu, số liệu, CTA).
 *  Cố ý KHÔNG mang cột nhạy cảm (MST, ngân hàng, % hoa hồng) vì bảng này có
 *  policy đọc công khai cho anon. */
export interface Partner {
  id: string;
  /** Đối tác được chọn ra để hiển thị; NULL với thẻ cũ chưa gắn. */
  supplier_id: string | null;
  name: string;
  badge: string;
  accent_color: string;
  logo_url: string | null;
  logo_filter: string | null;
  tagline: string | null;
  description: string | null;
  stats: PartnerStat[];
  date_label: string | null;
  date_value: string | null;
  cta_text: string | null;
  cta_href: string | null;
  sort_order: number;
  status: PartnerStatus;
  created_at: string;
  updated_at: string;
}

export interface PartnerUpsert extends Partial<Partner> {
  id?: string;
  name: string;
}
