// Phần dịch vụ của hồ sơ số hoá — kiểu dữ liệu + nhãn hiển thị
// (asset_posting_dossier_items, mig 20261001220000 + 20261004100000).
//
// Mỗi hồ sơ có 4 dịch vụ: Pháp lý · Đấu giá · Thẩm định giá · Giám định (tách nhau từ
// mig 20261004160100). Pháp lý / Thẩm định giá / Giám định chọn "Đối tác riêng" hoặc "Dịch vụ
// của sàn"; Đấu giá chỉ qua sàn. "Dịch vụ của sàn" của thẩm định giá = asset_valuation_orders,
// của giám định = asset_authentication_orders.

/** Dịch vụ của hồ sơ — asset_posting_dossier_items.kind. */
export type DossierKind = "appraisal" | "legal" | "auction" | "authentication";

/**
 * Nguồn — asset_posting_dossier_items.source. "none" (Chưa cần) là lựa chọn cũ, UI không
 * còn đưa ra; dòng cũ mang "none" đọc thành chưa chọn.
 */
export type DossierSource = "marketplace" | "external_partner" | "none";

export type LegalConclusion = "clean" | "has_issues";

/** Kết luận giám định của đối tác riêng — cùng mã với asset_authentication_orders.verdict. */
export type AuthVerdict = "authentic" | "inconclusive" | "suspected_fake";

export const DOSSIER_KIND_LABEL: Record<DossierKind, string> = {
  appraisal: "Thẩm định giá",
  legal: "Pháp lý",
  auction: "Tổ chức đấu giá",
  authentication: "Giám định",
};

/** Nhãn 2 lựa chọn của mỗi dịch vụ. */
export const SOURCE_LABEL: Record<Exclude<DossierSource, "none">, string> = {
  external_partner: "Đối tác riêng",
  marketplace: "Dịch vụ của sàn",
};

export const AUTH_VERDICT_LABEL: Record<AuthVerdict, string> = {
  authentic: "Xác thực",
  inconclusive: "Chưa đủ căn cứ",
  suspected_fake: "Nghi ngờ không xác thực",
};

export const LEGAL_CONCLUSION_LABEL: Record<LegalConclusion, string> = {
  clean: "Pháp lý sạch",
  has_issues: "Có vướng mắc",
};

/** Hiệu lực chứng thư thẩm định mặc định (D4) — dùng để điền sẵn valid_until; SQL có cùng hằng. */
export const APPRAISAL_VALIDITY_MONTHS = 6;

/** Ngưỡng cảnh báo "Chứng thư sắp hết hạn" (§A6) — chỉ hiển thị. */
export const APPRAISAL_EXPIRY_WARNING_DAYS = 30;
