// Văn bản pháp lý — registry phiên bản Điều khoản sử dụng / Chính sách bảo mật.

export type LegalDocType = "terms" | "privacy";

export interface LegalDocument {
  id: string;
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

export const LEGAL_DOC_LABELS: Record<LegalDocType, string> = {
  terms: "Điều khoản sử dụng",
  privacy: "Chính sách bảo mật",
};

export const LEGAL_DOC_HREFS: Record<LegalDocType, string> = {
  terms: "/dieu-khoan-su-dung",
  privacy: "/chinh-sach-bao-mat",
};
