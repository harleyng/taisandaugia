// Đường dẫn + tin nhắn gửi khách của link Hồ sơ online. Thuần — test ở message.test.ts.

import { formatMoneyShort } from "@/utils/money";

export const sharedPostingPath = (code: string) => `/hs/${code}`;
export const sharedPostingPrintPath = (code: string) => `/hs/${code}/in`;

export function sharedPostingUrl(
  code: string,
  origin = typeof window === "undefined" ? "" : window.location.origin,
): string {
  return `${origin}${sharedPostingPath(code)}`;
}

export interface ZaloMessageInput {
  title: string;
  /** "120 m²" — null nếu chưa khai. */
  area: string | null;
  /** Chỉ truyền khi link cho hiện giá; null ⇒ không nhắc tới giá. */
  startingPrice: number | null;
  province: string | null;
  url: string;
}

/**
 * Tin nhắn ngắn cán bộ dán vào Zalo / SMS:
 *   Kính gửi Anh/Chị, ngân hàng xin giới thiệu tài sản:
 *   Nhà phố Quận 7 · 120 m² · TP. Hồ Chí Minh
 *   Giá khởi điểm: 12.4 tỷ
 *   Xem hồ sơ số hoá (ảnh, pháp lý, lịch phiên): https://…/hs/abc
 */
export function buildZaloMessage(input: ZaloMessageInput): string {
  const facts = [input.title.trim(), input.area, input.province].filter((x): x is string => !!x && x.trim() !== "");
  const lines = ["Kính gửi Anh/Chị, xin giới thiệu tài sản:", facts.join(" · ")];
  if (input.startingPrice != null && input.startingPrice > 0) {
    lines.push(`Giá khởi điểm: ${formatMoneyShort(input.startingPrice)}`);
  }
  lines.push(`Xem hồ sơ số hoá (ảnh, pháp lý, lịch phiên): ${input.url}`);
  return lines.join("\n");
}
