// Kho câu chữ của TRÌNH SOẠN MẪU (chưa có mô hình AI). Chỉ gồm từ vựng + khung
// câu — mọi dữ kiện đều lấy từ phiên / lô / hồ sơ vụ việc, không bịa.
// XOÁ NGUYÊN FILE khi nối mô hình thật (seam ở src/hooks/useOutreachGeneration.ts).

export const MODEL_LABEL = "Trình soạn mẫu v1 — mô phỏng, chưa gọi mô hình AI";

export const OPENERS = {
  listing: [
    "{org} thông báo tổ chức phiên đấu giá {what}.",
    "{org} trân trọng mời tham gia phiên đấu giá {what}.",
    "Phiên đấu giá công khai {what} do {org} tổ chức.",
  ],
  zalo: [
    "📣 Phiên đấu giá mới: {title}",
    "📣 {org} mở phiên đấu giá {what}",
    "📣 Cơ hội sở hữu {what} qua đấu giá công khai",
  ],
  facebook: [
    "🔔 PHIÊN ĐẤU GIÁ {code} — {title}",
    "🔔 {org} mở phiên đấu giá {what}",
    "🔔 Đấu giá công khai: {title}",
  ],
} as const;

export const CLOSERS = {
  zalo: [
    "Nhắn tin hoặc gọi {phone} để được hướng dẫn hồ sơ.",
    "Cần hỗ trợ hồ sơ, anh/chị gọi {phone}.",
    "Đăng ký sớm để kịp xem tài sản trước phiên.",
  ],
  facebook: [
    "Bình luận hoặc nhắn tin cho trang để được hướng dẫn thủ tục tham gia.",
    "Chia sẻ để người thân, bạn bè đang tìm tài sản cùng biết.",
    "Liên hệ sớm để được hướng dẫn hồ sơ và lịch xem tài sản.",
  ],
} as const;

export const PITCH_ONE = [
  "{title}{place} lên phiên đấu giá ngày {date}, giá khởi điểm {price} — đúng nhu cầu {kind} anh/chị đã chia sẻ.",
  "Anh/chị đang tìm {kind}? {title}{place} đấu giá ngày {date}, giá khởi điểm {price}.",
  "{org} có {title}{place} đấu giá ngày {date}, giá khởi điểm {price}, phù hợp nhu cầu của anh/chị.",
] as const;

export const PITCH_MULTI = [
  "Phiên {code} có nhiều tài sản khớp nhu cầu của anh/chị, giá khởi điểm từ {minPrice}, đấu giá ngày {date}.",
  "Anh/chị quan tâm nhiều loại tài sản? Phiên {code} ngày {date} có vài lô phù hợp, giá khởi điểm từ {minPrice}.",
  "{org} gửi anh/chị các lô phù hợp trong phiên {code} (đấu giá ngày {date}), giá khởi điểm từ {minPrice}.",
] as const;

/** Một câu gợi ý cách xem tài sản theo nhóm tài sản — không nêu dữ kiện. */
export const CATEGORY_ANGLE: Record<string, string> = {
  "bat-dong-san": "Vị trí, pháp lý và hiện trạng được công bố trong hồ sơ phiên; nên xem tài sản thực tế trước khi đăng ký.",
  "xe-co": "Nên xem xe trực tiếp trong thời gian xem tài sản trước khi đăng ký tham gia.",
  "may-moc": "Máy móc, thiết bị được xem thực tế theo lịch xem tài sản.",
  "hang-hoa": "Hàng hoá được xem theo lô tại nơi lưu giữ trong thời gian xem tài sản.",
  "do-dung": "Tài sản được xem thực tế theo lịch xem tài sản.",
  "thu-cong-my-nghe": "Hiện vật được xem trực tiếp theo lịch xem tài sản.",
  "co-vat-suu-tam": "Hiện vật được xem trực tiếp theo lịch xem tài sản.",
  default: "Hồ sơ tài sản được công bố công khai trên sàn.",
};
