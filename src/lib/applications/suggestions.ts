export interface SuggestionSection {
  title: string
  items: string[]
  example: string
}

export const AUCTION_PLAN_SUGGESTIONS: Record<string, SuggestionSection> = {
  format: {
    title: 'Gợi ý: Hình thức, bước giá, số vòng (8đ)',
    items: [
      'Đề xuất hình thức đấu giá: trực tiếp bằng lời nói / bỏ phiếu kín / trực tuyến / kết hợp',
      'Bước giá cụ thể (số tiền tuyệt đối hoặc % giá khởi điểm)',
      'Số vòng đấu giá tối thiểu và tối đa',
      'Tiền đặt trước (thường 5–20% giá khởi điểm)',
      'Thời gian dự kiến tổ chức phiên đấu giá (ngày, giờ)',
      'Địa điểm tổ chức phiên đấu giá',
      'Quy định về việc rút phiếu/rút giá trong vòng đấu',
      'Cách xử lý khi chỉ có 1 người đăng ký tham gia',
    ],
    example:
      'Ví dụ: Đề xuất hình thức đấu giá trực tiếp bằng lời nói, công khai. Bước giá tối thiểu 50.000.000 đồng/lần trả giá. Tổ chức tối thiểu 3 vòng đấu, không giới hạn số lần trả giá. Tiền đặt trước 10% giá khởi điểm. Phiên đấu giá dự kiến tổ chức trong tháng X/20XX tại địa chỉ của tổ chức đấu giá.',
  },
  receptionPlan: {
    title: 'Gợi ý: Bán, tiếp nhận hồ sơ tham gia đấu giá (2đ)',
    items: [
      'Địa điểm phát hành và tiếp nhận hồ sơ đăng ký tham gia đấu giá',
      'Thời gian phát hành hồ sơ (giờ làm việc, số ngày làm việc)',
      'Giá bán hồ sơ tham gia đấu giá (nếu có)',
      'Phương thức nộp hồ sơ: trực tiếp / bưu điện / điện tử',
      'Thời hạn cuối nhận hồ sơ đăng ký',
      'Thủ tục xem xét tư cách tham gia đấu giá',
    ],
    example:
      'Ví dụ: Hồ sơ đăng ký tham gia đấu giá được bán và tiếp nhận tại văn phòng [Tên tổ chức] trong giờ hành chính. Người tham gia nộp hồ sơ trực tiếp hoặc qua đường bưu điện đảm bảo đúng thời hạn. Hồ sơ gồm: Đơn đăng ký theo mẫu, CMND/CCCD, chứng từ nộp tiền đặt trước.',
  },
  participantConditions: {
    title: 'Gợi ý: Đối tượng, điều kiện tham gia đấu giá (3đ)',
    items: [
      'Đối tượng được phép tham gia (cá nhân/tổ chức, điều kiện về năng lực tài chính)',
      'Điều kiện về tài sản bảo đảm hoặc năng lực pháp lý',
      'Các trường hợp không được tham gia (theo luật đấu giá)',
      'Điều kiện đặc thù của loại tài sản (ví dụ QSDĐ: phải là công dân VN)',
      'Số lượng hồ sơ tối đa mỗi người/tổ chức',
      'Điều kiện về tiền đặt trước và cách nộp',
    ],
    example:
      'Ví dụ: Mọi cá nhân, hộ gia đình, tổ chức đáp ứng điều kiện theo Luật Đất đai 2024 và không thuộc trường hợp bị cấm theo Điều 38 Luật Đấu giá tài sản đều được tham gia. Người tham gia phải nộp tiền đặt trước theo quy định trước thời hạn X ngày.',
  },
  antiCollusionMeasures: {
    title: 'Gợi ý: Giải pháp giám sát, chống thông đồng (3đ)',
    items: [
      'Lắp đặt camera giám sát toàn bộ phiên đấu giá và lưu trữ băng hình',
      'Niêm phong hồ sơ và phiếu trả giá trước khi mở',
      'Cách ly người tham gia tại khu vực riêng trước khi tiến hành đấu giá',
      'Phân công đấu giá viên giám sát chéo, không có lợi ích liên quan',
      'Xác minh danh tính người tham gia trước khi vào phòng đấu giá',
      'Ký cam kết không thông đồng, dìm giá',
      'Phối hợp với cơ quan công an địa phương giám sát phiên đấu giá',
      'Ghi âm, ghi hình toàn bộ quá trình đấu giá',
      'Phát hiện và xử lý ngay hành vi vi phạm theo quy định pháp luật',
    ],
    example:
      'Ví dụ: Trước phiên đấu giá, yêu cầu tất cả người tham gia ký cam kết không thông đồng, dìm giá. Bố trí camera giám sát từ lúc nhận hồ sơ đến khi kết thúc phiên. Đấu giá viên không có quan hệ lợi ích với bất kỳ người tham gia nào. Mời đại diện người có tài sản và cơ quan có thẩm quyền tham dự giám sát.',
  },
}
