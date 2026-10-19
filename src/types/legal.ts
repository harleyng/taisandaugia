// Văn bản pháp lý — registry phiên bản Điều khoản sử dụng / Chính sách bảo mật.
// Mỗi nền tảng (Tài Sản Đấu Giá / Sàn đấu giá trực tuyến) có bộ văn bản riêng.

export type LegalDocType = "terms" | "privacy";

/** info = Tài Sản Đấu Giá (taisandaugia) · auction = Sàn đấu giá trực tuyến (taisanviet). */
export type LegalPlatform = "info" | "auction";

export const LEGAL_PLATFORMS: LegalPlatform[] = ["info", "auction"];

export const LEGAL_PLATFORM_LABELS: Record<LegalPlatform, string> = {
  info: "Tài Sản Đấu Giá",
  auction: "Sàn đấu giá trực tuyến",
};

export interface LegalDocument {
  id: string;
  platform: LegalPlatform;
  doc_type: LegalDocType;
  version: string;
  effective_date: string; // ISO date "YYYY-MM-DD"
  changelog: string | null;
  content: string | null; // rich-text HTML
  created_at: string;
  updated_at: string;
}

/** Payload tạo phiên bản MỚI (phiên bản là bất biến — chỉ insert, không update). */
export interface LegalVersionCreate {
  platform: LegalPlatform;
  doc_type: LegalDocType;
  version: string;
  effective_date: string;
  changelog?: string | null;
  content: string | null;
}

/** Phiên bản đang áp dụng cho mỗi loại (đọc công khai). */
export interface LegalActiveVersions {
  terms: string | null;
  privacy: string | null;
  termsEffectiveDate: string | null;
  privacyEffectiveDate: string | null;
}

/** Phiên bản user đã đồng ý trên một nền tảng (null = chưa ghi nhận). */
export interface LegalConsent {
  termsVersion: string | null;
  privacyVersion: string | null;
}

export const LEGAL_DOC_LABELS: Record<LegalDocType, string> = {
  terms: "Điều khoản sử dụng",
  privacy: "Chính sách bảo mật",
};

/** Đường dẫn trang công khai — CÙNG đường dẫn trên cả hai nền tảng (mỗi bên render bộ văn bản của mình). */
export const LEGAL_DOC_HREFS: Record<LegalDocType, string> = {
  terms: "/dieu-khoan-su-dung",
  privacy: "/chinh-sach-bao-mat",
};
