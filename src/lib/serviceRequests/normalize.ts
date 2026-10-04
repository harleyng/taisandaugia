// Chuẩn hoá dòng của các bảng dịch vụ về một hình dạng cho danh sách gộp.
// Nhãn trạng thái & "việc tiếp theo" dùng lại logic sẵn có của từng loại — không nhân bản.

import { tvplNextAction, tvplStatusLabel } from "@/lib/legalConsult/status";
import { decisionLabel, tvdgNextAction, tvdgStatusLabel } from "@/lib/auctionConsult/status";
import { gdMethodLabel, gdNextAction, gdStatusLabel, gdVerdictLabel } from "@/lib/authentication/status";
import { vrNextAction, vrStatusLabel } from "@/lib/vrTour/status";
import { purposeLabel, tdgNextAction, tdgStatusLabel } from "@/lib/valuation/status";
import { formatVnd } from "@/lib/advertising/slug";
import { serviceGroupOf, type ServiceGroupKey } from "@/lib/serviceRequests/groups";
import type { ServiceRequestKindKey } from "@/lib/serviceRequests/kinds";
import type { AdminLegalConsultation } from "@/hooks/useAdminLegalConsultations";
import type { AdminAuctionConsultation } from "@/hooks/useAdminAuctionConsultations";
import type { AdminAuthenticationOrder } from "@/hooks/useAdminAuthenticationOrders";
import type { AdminValuationOrder } from "@/hooks/useAdminValuationOrders";
import type { AdminVrTourOrder } from "@/hooks/useAdminVrTourOrders";
import type { AdminMarketingOrder } from "@/hooks/useAdminMarketingOrders";
import { adminNextAction, statusLabel as mktStatusLabel } from "@/lib/ownerMarketing/orders";

export interface ServiceRequestRow {
  kind: ServiceRequestKindKey;
  id: string;
  code: string;
  postingTitle: string;
  /** Gói / phương thức. */
  variant: string | null;
  partnerName: string | null;
  expertName: string | null;
  quotedPrice: number | null;
  status: string;
  statusLabel: string;
  group: ServiceGroupKey | null;
  nextAction: string;
  /** Kết quả phụ đáng nhìn ở danh sách: phiên bản, kết luận giám định, quyết định người bán. */
  resultLabel: string | null;
  /** Cảnh báo cần vận hành để ý (báo giá hết hạn, quá lịch hẹn). */
  alert: string | null;
  createdAt: string;
}

const isPast = (iso: string | null | undefined, now: number) => !!iso && new Date(iso).getTime() < now;

function quoteAlert(status: string, quoteExpiresAt: string | null, now: number): string | null {
  return status === "quoted" && isPast(quoteExpiresAt, now) ? "Báo giá đã hết hạn" : null;
}

const price = (v: number | string | null) => (v == null ? null : Number(v));
const versionLabel = (v: number | null) => (v != null ? `Phiên bản ${v}` : null);

export function fromLegalConsult(r: AdminLegalConsultation, now = Date.now()): ServiceRequestRow {
  return {
    kind: "tu-van-phap-ly",
    id: r.id,
    code: r.code,
    postingTitle: r.posting_title,
    variant: r.package_name,
    partnerName: r.partner_name,
    expertName: r.expert_name,
    quotedPrice: price(r.quoted_price),
    status: r.status,
    statusLabel: tvplStatusLabel(r.status),
    group: serviceGroupOf(r.status),
    nextAction: tvplNextAction(r),
    resultLabel: versionLabel(r.version),
    alert: quoteAlert(r.status, r.quote_expires_at, now),
    createdAt: r.created_at,
  };
}

export function fromAuctionConsult(r: AdminAuctionConsultation, now = Date.now()): ServiceRequestRow {
  const done = r.status === "completed" || r.status === "superseded";
  return {
    kind: "tu-van-dau-gia",
    id: r.id,
    code: r.code,
    postingTitle: r.posting_title,
    variant: r.package_name,
    partnerName: r.partner_name,
    expertName: r.expert_name,
    quotedPrice: price(r.quoted_price),
    status: r.status,
    statusLabel: tvdgStatusLabel(r.status),
    group: serviceGroupOf(r.status),
    nextAction: tvdgNextAction(r),
    resultLabel: done ? [versionLabel(r.version), decisionLabel(r.seller_decision)].filter(Boolean).join(" · ") : null,
    alert: quoteAlert(r.status, r.quote_expires_at, now),
    createdAt: r.created_at,
  };
}

export function fromValuation(r: AdminValuationOrder, now = Date.now()): ServiceRequestRow {
  return {
    kind: "tham-dinh",
    id: r.id,
    code: r.code,
    postingTitle: r.posting_title,
    variant: purposeLabel(r.purpose),
    partnerName: r.partner_name,
    expertName: r.expert_name,
    quotedPrice: price(r.quoted_price),
    status: r.status,
    statusLabel: tdgStatusLabel(r.status),
    group: serviceGroupOf(r.status),
    nextAction: tdgNextAction(r),
    resultLabel: r.appraised_value != null ? formatVnd(r.appraised_value) : null,
    alert: quoteAlert(r.status, r.quote_expires_at, now),
    createdAt: r.created_at,
  };
}

export function fromAuthentication(r: AdminAuthenticationOrder, now = Date.now()): ServiceRequestRow {
  const overdueVisit = r.method === "on_site" && r.status === "item_pending" && isPast(r.appointment_at, now);
  return {
    kind: "giam-dinh",
    id: r.id,
    code: r.code,
    postingTitle: r.posting_title,
    variant: gdMethodLabel(r.method),
    partnerName: r.partner_name,
    expertName: null,
    quotedPrice: price(r.quoted_price),
    status: r.status,
    statusLabel: gdStatusLabel(r.status),
    group: serviceGroupOf(r.status),
    nextAction: gdNextAction(r),
    resultLabel: r.verdict ? gdVerdictLabel(r.verdict) : null,
    alert: quoteAlert(r.status, r.quote_expires_at, now) ?? (overdueVisit ? "Đã qua lịch hẹn" : null),
    createdAt: r.created_at,
  };
}

export function fromVrTour(r: AdminVrTourOrder, now = Date.now()): ServiceRequestRow {
  const overdueShoot = r.status === "scheduled" && isPast(r.appointment_at, now);
  return {
    kind: "vr-tour",
    id: r.id,
    code: r.code,
    postingTitle: r.posting_title,
    variant: r.package_name,
    partnerName: r.partner_name,
    expertName: null,
    quotedPrice: price(r.quoted_price),
    status: r.status,
    statusLabel: vrStatusLabel(r.status),
    group: serviceGroupOf(r.status),
    nextAction: vrNextAction(r.status, r.asset_postings?.review_status),
    resultLabel: null,
    alert: quoteAlert(r.status, r.quote_expires_at, now) ?? (overdueShoot ? "Đã qua lịch hẹn" : null),
    createdAt: r.created_at,
  };
}

export function fromMarketingOrder(r: AdminMarketingOrder, now = Date.now()): ServiceRequestRow {
  // Gói giá cố định đã trả bằng credit / lượt gói ⇒ không có giá báo VND.
  const paidNote =
    r.payment_method === "subscription"
      ? "Trả bằng gói dịch vụ"
      : r.payment_method === "credits" && r.credit_cost
        ? `Trả ${r.credit_cost.toLocaleString("en-US")} credit`
        : null;
  return {
    kind: "truyen-thong",
    id: r.id,
    code: r.code,
    postingTitle: r.listing_title,
    variant: r.package_name,
    // Chỗ "đối tác" hiện bên đặt — sàn tự làm, không có đối tác ngoài.
    partnerName: r.workspace_name,
    expertName: null,
    quotedPrice: price(r.quoted_price),
    status: r.status,
    statusLabel: mktStatusLabel(r.status),
    group: serviceGroupOf(r.status),
    nextAction: adminNextAction(r, now),
    resultLabel: paidNote,
    alert: quoteAlert(r.status, r.quote_expires_at, now),
    createdAt: r.created_at,
  };
}

export function matchesServiceSearch(row: ServiceRequestRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [row.code, row.postingTitle, row.partnerName, row.expertName, row.variant].some((v) =>
    (v ?? "").toLowerCase().includes(needle),
  );
}
