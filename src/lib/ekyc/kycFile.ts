// Luật tệp cho bucket PRIVATE `buyer-kyc` (ảnh giấy tờ, ĐKKD, giấy uỷ quyền).
//
// Khớp cấu hình bucket ở supabase/migrations/20261008100000_buyer_kyc_profile.sql
// (10 MB, jpg/png/pdf). Báo sớm ở client cho câu lỗi tiếng Việt; Storage vẫn là
// chốt chặn cuối.

export const KYC_MAX_BYTES = 10 * 1024 * 1024;

/** image = ảnh giấy tờ tuỳ thân; document = ảnh HOẶC PDF (ĐKKD, giấy uỷ quyền). */
export type KycFileKind = "image" | "document";

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

const typesOf = (kind: KycFileKind) => (kind === "image" ? IMAGE_TYPES : DOCUMENT_TYPES);

/** Giá trị cho thuộc tính `accept` của <input type="file">. */
export function kycAcceptAttr(kind: KycFileKind): string {
  return kind === "image" ? ".jpg,.jpeg,.png" : ".jpg,.jpeg,.png,.pdf";
}

/** Câu lỗi tiếng Việt, hoặc null nếu tệp dùng được. */
export function kycFileError(file: { type: string; size: number }, kind: KycFileKind): string | null {
  if (!typesOf(kind).includes(file.type)) {
    return kind === "image" ? "Chỉ nhận ảnh JPG hoặc PNG." : "Chỉ nhận tệp JPG, PNG hoặc PDF.";
  }
  if (file.size > KYC_MAX_BYTES) return "Tệp vượt quá 10 MB.";
  if (file.size === 0) return "Tệp rỗng.";
  return null;
}

/** Phần mở rộng lưu trên Storage theo MIME (không tin tên tệp người dùng đặt). */
export function kycExtOf(type: string): "jpg" | "png" | "pdf" {
  if (type === "image/png") return "png";
  if (type === "application/pdf") return "pdf";
  return "jpg";
}

export const isPdfPath = (path: string) => /\.pdf$/i.test(path);
