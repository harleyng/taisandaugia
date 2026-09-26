// Mức xác minh của một hồ sơ — giá trị DẪN XUẤT, nhân bản SQL
// asset_posting_verification_level (20260915000020). Sửa một bên phải sửa bên kia.

import type { AuthenticationMethod, AuthenticationVerdict } from "@/types/authentication";

export interface VerificationInput {
  ownerKycApproved: boolean;
  reviewStatus: string | null | undefined;
  /** Kết luận hiện hành (đơn status='completed') — null nếu chưa giám định. */
  verdict: AuthenticationVerdict | string | null | undefined;
  method: AuthenticationMethod | string | null | undefined;
}

export const VERIFICATION_LEVEL_LABELS: Record<number, string> = {
  0: "Chưa xác minh",
  1: "Chủ tài sản đã KYC",
  2: "Hồ sơ đã được sàn duyệt",
  3: "Đã giám định từ ảnh",
  4: "Đã giám định hiện vật",
};

export function verificationLevel(i: VerificationInput): number {
  if (i.verdict === "authentic") return i.method === "from_photos" ? 3 : 4;
  if (i.reviewStatus === "approved") return 2;
  if (i.ownerKycApproved) return 1;
  return 0;
}
