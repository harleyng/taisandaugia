export interface ScoreCriterion {
  label: string
  points: string
}

export interface ScoreSection {
  title: string
  muc: string
  maxPoints: number
  criteria: ScoreCriterion[]
}

export interface ScoreBreakdownData {
  title: string
  muc: string
  maxTotal: number
  sections: ScoreSection[]
}

export const MUC_II_BREAKDOWN: ScoreBreakdownData = {
  title: 'Cơ sở vật chất',
  muc: 'Mục II',
  maxTotal: 19,
  sections: [
    {
      title: 'CSVC đảm bảo',
      muc: 'II.1',
      maxPoints: 3,
      criteria: [
        { label: 'II.1.1 — Trụ sở ổn định (địa chỉ, SĐT, email, ≥1 ảnh)', points: '1.5đ hoặc 0' },
        { label: 'II.1.2 — Điểm tiếp nhận hồ sơ (giờ làm việc, phương thức, ≥1 ảnh)', points: '1.5đ hoặc 0' },
      ],
    },
    {
      title: 'Trang bị',
      muc: 'II.2',
      maxPoints: 4,
      criteria: [
        { label: 'II.2.1 — Camera tại trụ sở (có hệ thống, có thể trích xuất)', points: '2đ hoặc 0' },
        { label: 'II.2.2 — Camera tại phiên đấu giá (có hệ thống, trích xuất, lưu theo HS)', points: '2đ hoặc 0' },
      ],
    },
    {
      title: 'Website & Đấu giá trực tuyến',
      muc: 'II.3–4',
      maxPoints: 8,
      criteria: [
        { label: 'II.3 — Website hoạt động ổn định, cập nhật thường xuyên, có ảnh chụp', points: '4đ hoặc 0' },
        { label: 'II.4 — Nền tảng đấu giá trực tuyến được phê duyệt hoặc đã thực hiện ≥1 cuộc/năm trước', points: '4đ hoặc 0' },
      ],
    },
    {
      title: 'Lưu trữ hồ sơ',
      muc: 'II.5',
      maxPoints: 4,
      criteria: [
        { label: 'II.5 — Có nơi lưu trữ hồ sơ (≥1 ảnh, có biện pháp bảo mật)', points: '4đ hoặc 0' },
      ],
    },
  ],
}

export const MUC_IV5_BREAKDOWN: ScoreBreakdownData = {
  title: 'Thông tin chung',
  muc: 'Mục IV.5',
  maxTotal: 4,
  sections: [
    {
      title: 'Thời gian hoạt động',
      muc: 'IV.5',
      maxPoints: 4,
      criteria: [
        { label: 'Dưới 1 năm', points: '0đ' },
        { label: 'Từ 1 năm đến dưới 5 năm', points: '1đ' },
        { label: 'Từ 5 năm đến dưới 10 năm', points: '2đ' },
        { label: 'Từ 10 năm đến dưới 15 năm', points: '3đ' },
        { label: 'Từ 15 năm trở lên', points: '4đ' },
      ],
    },
  ],
}

export const MUC_IV14_BREAKDOWN: ScoreBreakdownData = {
  title: 'Lịch sử đấu giá',
  muc: 'Mục IV.1–4',
  maxTotal: 21,
  sections: [
    {
      title: 'Tổng số cuộc đấu giá trong năm',
      muc: 'IV.1',
      maxPoints: 5,
      criteria: [
        { label: 'Dưới 1 cuộc (chưa có dữ liệu)', points: '1đ' },
        { label: 'Từ 1 đến dưới 20 cuộc', points: '2đ' },
        { label: 'Từ 20 đến dưới 40 cuộc', points: '3đ' },
        { label: 'Từ 40 đến dưới 70 cuộc', points: '4đ' },
        { label: 'Từ 70 cuộc trở lên', points: '5đ' },
      ],
    },
    {
      title: 'Cuộc đấu giá thành công',
      muc: 'IV.2',
      maxPoints: 5,
      criteria: [
        { label: 'Dưới 1 cuộc thành công', points: '1đ' },
        { label: 'Từ 1 đến dưới 10 cuộc', points: '2đ' },
        { label: 'Từ 10 đến dưới 30 cuộc', points: '3đ' },
        { label: 'Từ 30 đến dưới 50 cuộc', points: '4đ' },
        { label: 'Từ 50 cuộc trở lên', points: '5đ' },
      ],
    },
    {
      title: 'Cuộc thành công có chênh lệch giá',
      muc: 'IV.3',
      maxPoints: 5,
      criteria: [
        { label: 'Dưới 1 cuộc có chênh lệch', points: '1đ' },
        { label: 'Từ 1 đến dưới 10 cuộc', points: '2đ' },
        { label: 'Từ 10 đến dưới 30 cuộc', points: '3đ' },
        { label: 'Từ 30 đến dưới 50 cuộc', points: '4đ' },
        { label: 'Từ 50 cuộc trở lên', points: '5đ' },
      ],
    },
    {
      title: 'Cuộc thành công có chênh lệch ≥10%',
      muc: 'IV.4',
      maxPoints: 6,
      criteria: [
        { label: '0 cuộc', points: '0đ' },
        { label: 'Từ 1 đến dưới 10 cuộc', points: '2đ' },
        { label: 'Từ 10 đến dưới 20 cuộc', points: '4đ' },
        { label: 'Từ 20 cuộc trở lên', points: '6đ' },
      ],
    },
  ],
}

export const MUC_IV68_BREAKDOWN: ScoreBreakdownData = {
  title: 'Đấu giá viên',
  muc: 'Mục IV.6–8',
  maxTotal: 13,
  sections: [
    {
      title: 'Số lượng đấu giá viên đang hành nghề',
      muc: 'IV.6',
      maxPoints: 4,
      criteria: [
        { label: '1 đấu giá viên', points: '2đ' },
        { label: 'Từ 2 đến 4 đấu giá viên', points: '3đ' },
        { label: 'Từ 5 đấu giá viên trở lên', points: '4đ' },
      ],
    },
    {
      title: 'Kinh nghiệm Giám đốc (tính từ ngày cấp thẻ ĐGV)',
      muc: 'IV.7',
      maxPoints: 4,
      criteria: [
        { label: 'Dưới 5 năm', points: '2đ' },
        { label: 'Từ 5 năm đến dưới 10 năm', points: '3đ' },
        { label: 'Từ 10 năm trở lên', points: '4đ' },
      ],
    },
    {
      title: 'Đấu giá viên hành nghề có ≥5 năm kinh nghiệm',
      muc: 'IV.8',
      maxPoints: 5,
      criteria: [
        { label: 'Không có ai ≥5 năm (nhưng đang có ĐGV)', points: '3đ' },
        { label: 'Từ 1 đến 3 người ≥5 năm', points: '4đ' },
        { label: 'Từ 4 người ≥5 năm trở lên', points: '5đ' },
      ],
    },
  ],
}

export const MUC_IV9_BREAKDOWN: ScoreBreakdownData = {
  title: 'Tài chính & Thuế',
  muc: 'Mục IV.9',
  maxTotal: 3,
  sections: [
    {
      title: 'Số thuế / khoản tiền nộp ngân sách Nhà nước',
      muc: 'IV.9',
      maxPoints: 3,
      criteria: [
        { label: 'Dưới 50 triệu đồng', points: '1đ' },
        { label: 'Từ 50 triệu đến dưới 100 triệu đồng', points: '2đ' },
        { label: 'Từ 100 triệu đồng trở lên', points: '3đ' },
      ],
    },
  ],
}
