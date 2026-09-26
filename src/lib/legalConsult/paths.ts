// Đường dẫn dùng chung của luồng tư vấn pháp lý.

import { ownerPostingPath } from "@/lib/vrTour/paths";

/** Gốc trang chi tiết trong menu gộp "Yêu cầu dịch vụ" (`${gốc}/${id}`). */
export const ADMIN_LEGAL_CONSULT_PATH = "/admin/yeu-cau-dich-vu/tu-van-phap-ly";

/** Tệp nộp tư vấn nằm trong bucket private của hồ sơ số hoá (asset-docs). */
export const LEGAL_DOC_BUCKET = "asset-docs";

/** Tab "Tư vấn pháp lý" trên trang hồ sơ của người bán. */
export const ownerLegalConsultPath = (postingId: string) => `${ownerPostingPath(postingId)}?tab=phap-ly`;

/** Trang thanh toán VNPay cho một lần tư vấn; thanh toán xong quay về tab tư vấn. */
export function legalConsultCheckoutPath(consultationId: string, postingId: string): string {
  const sp = new URLSearchParams({ tvpl_order: consultationId, return: ownerLegalConsultPath(postingId) });
  return `/payment/vnpay?${sp.toString()}`;
}

/** Tên tệp dễ đọc từ storage path `{uid}/{folder}/{uuid}.ext`. */
export function docLabel(path: string): string {
  const parts = path.split("/");
  const folder = parts.length >= 3 ? parts[parts.length - 2] : "";
  const name = parts[parts.length - 1] ?? path;
  const folderLabel: Record<string, string> = {
    ownership: "Giấy tờ sở hữu",
    extra: "Tài liệu bổ sung",
    "legal-consult": "Nộp cho tư vấn",
  };
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "";
  return `${folderLabel[folder] ?? "Tệp"} · ${name.slice(0, 8)}${ext ? `.${ext.toLowerCase()}` : ""}`;
}
