// Danh sách 63 tỉnh/thành (tên trước sáp nhập 2025) cho bộ chọn "tỉnh quan tâm"
// trong danh bạ khách hàng của tổ chức.
//
// KHÔNG phải nguồn so khớp: server so tên qua public.normalize_province (bỏ dấu,
// bỏ tiền tố "TP."/"Tỉnh", gom "TP.HCM"), nên "Hồ Chí Minh" trong nhu cầu vẫn
// khớp lô ghi "TP. Hồ Chí Minh". vietnam-locations.ts (3 tỉnh, có quận/phường)
// vẫn là nguồn của các form địa chỉ khác.
//
// Khác danh sách trong announcement-scraper.ts: bên đó cố ý có cả "Hồ Chí Minh"
// lẫn "TP. Hồ Chí Minh" để dò chữ trong văn bản, còn đây mỗi tỉnh một dòng.

export const VIETNAM_PROVINCE_NAMES: readonly string[] = [
  "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh",
  "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau",
  "Cao Bằng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp",
  "Gia Lai", "Hà Giang", "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Hòa Bình",
  "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu", "Lâm Đồng",
  "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Ninh Thuận",
  "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh",
  "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên",
  "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
  "Vĩnh Long", "Vĩnh Phúc", "Yên Bái",
];
