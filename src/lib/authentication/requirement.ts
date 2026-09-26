// Bắt buộc giám định (BR-GD-03) phía client — CHỈ để báo trước trong wizard. Cổng thật
// là trigger asset_postings_authentication_gate; nhân bản _authentication_required_reasons.

import type { AuthenticationRequiredReason } from "@/types/authentication";

export interface RequirementInput {
  parentSlug: string;
  startingPrice: number | null;
  policy: { enabled: boolean; min_price: number; parent_slugs: string[] } | null;
  sellerRestricted: boolean;
  lotFlagged: boolean;
}

export const REQUIRED_REASON_LABELS: Record<AuthenticationRequiredReason, string> = {
  lot_flag: "Sàn yêu cầu giám định cho tài sản này",
  seller_restricted: "Tài khoản của bạn đang thuộc diện phải giám định trước khi đăng",
  policy: "Tài sản nhóm này có giá từ ngưỡng bắt buộc giám định",
};

export function requiredReasons(i: RequirementInput): AuthenticationRequiredReason[] {
  const r: AuthenticationRequiredReason[] = [];
  if (i.lotFlagged) r.push("lot_flag");
  if (i.sellerRestricted) r.push("seller_restricted");
  const p = i.policy;
  if (p?.enabled && p.parent_slugs.includes(i.parentSlug) && i.startingPrice != null && i.startingPrice >= p.min_price) {
    r.push("policy");
  }
  return r;
}
