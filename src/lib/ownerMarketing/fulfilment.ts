// Admin thực hiện đơn "Giao việc cho sàn" bằng công cụ sẵn có — dựng dữ liệu điền sẵn cho
// trình soạn chiến dịch email (AdminCampaignEditor) và banner (AdminAdEditor) từ đơn + tin.
//
// Thuần để test được. Chỉ dùng DỮ KIỆN của tin (giá, hạn đăng ký, ngày đấu giá, địa danh) —
// không bao giờ đưa thông tin bên vay / chủ nợ vào nội dung (plan §M2.2).

import { DEFAULT_AUDIENCE_SPEC, modesForKind } from "@/lib/marketing/audienceCriteria";
import { viDateTime, vnd } from "@/lib/outreach/format";
import { listingTargetPath } from "@/lib/ownerMarketing/links";
import type { AudienceSpec } from "@/types/marketing";
import { caString, type ListingAddress, type ListingCustomAttributes } from "@/types/listing";

export interface FulfilmentOrder {
  id: string;
  code: string;
  listing_id: string | null;
  listing_title: string;
}

export interface FulfilmentListing {
  id: string;
  title: string;
  price: number | null;
  address: ListingAddress | null;
  custom_attributes: ListingCustomAttributes | null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function place(a: ListingAddress | null): string {
  if (!a) return "";
  return [a.district, a.province].filter(Boolean).join(", ");
}

/** Link tới tin công khai, gắn utm để báo cáo truy cập tách nguồn theo đơn. */
export function orderListingUrl(origin: string, o: FulfilmentOrder, channel: "email" | "banner"): string {
  if (!o.listing_id) return origin;
  return `${origin}${listingTargetPath(o.listing_id, channel, o.code.toLowerCase())}`;
}

export interface EmailPrefill {
  name: string;
  notes: string;
  subject: string;
  preview_text: string;
  content_html: string;
  audience: AudienceSpec;
}

/** Chiến dịch email điền sẵn: dữ kiện tin + nút xem tài sản; đối tượng = người mua cùng tỉnh. */
export function buildEmailPrefill(o: FulfilmentOrder, l: FulfilmentListing | null, origin: string): EmailPrefill {
  const title = l?.title || o.listing_title;
  const ca = l?.custom_attributes ?? {};
  const auctionAt = caString(ca.auction_time ?? ca.auction_date);
  const deadline = caString(ca.registration_deadline);
  const where = place(l?.address ?? null);
  const url = orderListingUrl(origin, o, "email");

  const facts = [
    l?.price ? `Giá khởi điểm: <strong>${esc(vnd(l.price))}</strong>` : null,
    deadline ? `Hạn đăng ký: <strong>${esc(viDateTime(deadline))}</strong>` : null,
    auctionAt ? `Thời gian đấu giá: <strong>${esc(viDateTime(auctionAt))}</strong>` : null,
    where ? `Địa điểm tài sản: ${esc(where)}` : null,
  ].filter(Boolean);

  const html = [
    `<h2>${esc(title)}</h2>`,
    facts.length ? `<ul>${facts.map((f) => `<li>${f}</li>`).join("")}</ul>` : "",
    `<p>Xem hồ sơ đầy đủ, hình ảnh và điều kiện tham gia trên sàn.</p>`,
    `<p><a href="${esc(url)}">Xem tài sản và đăng ký tham gia</a></p>`,
  ].join("\n");

  const province = l?.address?.province ?? null;
  const audience: AudienceSpec = {
    ...DEFAULT_AUDIENCE_SPEC,
    kind: "criteria",
    modes: modesForKind("criteria"),
    criteria: {
      ...DEFAULT_AUDIENCE_SPEC.criteria,
      accountTypes: ["buyer"],
      provinces: province ? [province] : [],
    },
  };

  return {
    name: `${o.code} · ${title}`.slice(0, 120),
    notes: `Thực hiện đơn giao việc truyền thông ${o.code}.`,
    subject: `Tài sản đấu giá: ${title}`.slice(0, 150),
    preview_text: [l?.price ? `Giá khởi điểm ${vnd(l.price)}` : null, deadline ? `hạn đăng ký ${viDateTime(deadline)}` : null]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 140),
    content_html: html,
    audience,
  };
}

export interface AdPrefill {
  name: string;
  nav_url: string;
}

/** Banner điền sẵn: tên + đích bấm tới tin (ảnh, vị trí, lịch admin tự chọn). */
export function buildAdPrefill(o: FulfilmentOrder, origin: string): AdPrefill {
  return {
    name: `${o.code} · ${o.listing_title}`.slice(0, 120),
    nav_url: orderListingUrl(origin, o, "banner"),
  };
}
