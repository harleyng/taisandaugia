// Điều khoản mẫu của dự thảo hợp đồng dịch vụ đấu giá tài sản.
//
// ⚠️ CHƯA ĐƯỢC RÀ SOÁT PHÁP LÝ. Đây là khung tham khảo để tổ chức đấu giá khỏi
// soạn từ trang trắng; bản in luôn mang dấu "DỰ THẢO" và lời nhắc hai bên rà
// soát trước khi ký. Sửa câu chữ ở đây phải qua người có chuyên môn pháp lý —
// và tăng CONTRACT_TEMPLATE_VERSION để biết bản đã chia sẻ dùng mẫu nào.

export const CONTRACT_TEMPLATE_VERSION = 'HDDV-MAU-2026-09'

export const LEGAL_BASES = [
  'Căn cứ Bộ luật Dân sự số 91/2015/QH13;',
  'Căn cứ Luật Đấu giá tài sản số 01/2016/QH14, được sửa đổi, bổ sung năm 2024, và các văn bản hướng dẫn thi hành;',
  'Căn cứ nhu cầu và khả năng của hai bên.',
]

export const OWNER_DUTIES = [
  'Cung cấp đầy đủ, chính xác thông tin và giấy tờ chứng minh quyền sở hữu, quyền được bán tài sản; chịu trách nhiệm về tính hợp pháp của tài sản.',
  'Tạo điều kiện để Bên B và người tham gia đấu giá xem tài sản theo lịch hai bên thống nhất.',
  'Thanh toán thù lao dịch vụ và chi phí đấu giá theo Điều 4.',
  'Ký hợp đồng mua bán tài sản đấu giá và giao tài sản cho người trúng đấu giá theo quy định.',
  'Được yêu cầu Bên B cung cấp thông tin về tiến độ và kết quả đấu giá.',
]

export const ORG_DUTIES = [
  'Tổ chức cuộc đấu giá theo đúng trình tự, thủ tục của pháp luật về đấu giá tài sản và theo phương án tại Điều 3.',
  'Niêm yết, thông báo công khai việc đấu giá; bán hồ sơ, tiếp nhận hồ sơ đăng ký và tiền đặt trước của người tham gia đấu giá.',
  'Bảo quản hồ sơ, giấy tờ do Bên A giao; không sử dụng thông tin của Bên A ngoài mục đích thực hiện hợp đồng.',
  'Chuyển kết quả đấu giá, biên bản đấu giá và danh sách người trúng đấu giá cho Bên A theo quy định.',
  'Được nhận thù lao dịch vụ và được thanh toán chi phí đấu giá theo Điều 4.',
]

export const PAYMENT_TERMS =
  'Thù lao dịch vụ và chi phí đấu giá được thanh toán sau khi cuộc đấu giá thành, trong thời hạn hai bên thống nhất. Trường hợp đấu giá không thành, Bên A thanh toán cho Bên B các chi phí thực tế, hợp lý theo quy định.'

export const TERMINATION = [
  'Hợp đồng chấm dứt khi các bên hoàn thành nghĩa vụ, khi hai bên thoả thuận chấm dứt, hoặc trong các trường hợp pháp luật quy định.',
  'Bên đơn phương chấm dứt hợp đồng trái quy định phải bồi thường thiệt hại phát sinh cho bên còn lại.',
  'Tranh chấp phát sinh được giải quyết trước hết bằng thương lượng; không thương lượng được thì mỗi bên có quyền yêu cầu Toà án có thẩm quyền giải quyết.',
]

export const EFFECT = [
  'Hợp đồng có hiệu lực kể từ ngày hai bên ký.',
  'Hợp đồng được lập thành 04 bản có giá trị pháp lý như nhau, mỗi bên giữ 02 bản.',
]

export const DRAFT_NOTICE =
  'Dự thảo tạo tự động từ báo giá đã chốt trên sàn. Điều khoản là mẫu tham khảo — hai bên rà soát, chỉnh sửa trước khi ký.'
