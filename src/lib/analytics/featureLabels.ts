// Catalog feature_key → nhãn tiếng Việt (nguồn nhãn DUY NHẤT cho báo cáo + tracker).
// Module thuần: KHÔNG import supabase/React → an toàn cho cả tracker lẫn module
// tổng hợp báo cáo (accessAnalytics.ts) và unit test.

export const FEATURE_EVENT_LABELS: Record<string, string> = {
  search: "Tìm kiếm tài sản",
  view_listing: "Xem chi tiết tài sản",
  view_auction: "Xem phiên đấu giá",
  save_asset: "Lưu / theo dõi tài sản",
  open_paywall: "Mở hộp thoại trả phí",
  unlock_asset: "Mở khóa tài sản",
  unlock_company: "Theo dõi công ty",
  unlock_owner: "Theo dõi chủ tài sản",
  unlock_report: "Mở khóa báo cáo chuyên sâu",
  open_buy_credits: "Vào trang mua credit",
  select_credit_package: "Chọn gói credit",
  view_report: "Xem báo cáo thị trường",
  start_kyc: "Bắt đầu KYC công ty",
  start_owner_kyc: "Bắt đầu KYC chủ tài sản",
  register_submit: "Gửi đăng ký tài khoản",
  login_submit: "Gửi đăng nhập",
};

export const featureEventLabel = (key: string) => FEATURE_EVENT_LABELS[key] ?? key;
