// "Dữ liệu đi đâu" — /chu-tai-san/truyen-thong/du-lieu (docs/owner-marketing-plan.md §A5, Phase M6).
//
// Trang tĩnh trả lời câu hỏi đầu tiên của ngân hàng: dữ liệu nào vào sàn, dữ liệu nào không
// bao giờ vào, lưu ở đâu — theo 3 mức triển khai L0 / L1 / L2. Nội dung ở đây (không trong JSX)
// để rà soát pháp lý sửa một chỗ. Tên sàn đọc từ src/lib/brand.ts (§B6).

import { BRAND } from "@/lib/brand";

export type DataFlowLevelKey = "l0" | "l1" | "l2";

/** Ai giữ nút trên sơ đồ: phía ngân hàng / người mua / sàn. */
export type DataFlowSide = "bank" | "buyer" | "platform";

export interface DataFlowNode {
  side: DataFlowSide;
  title: string;
  detail: string;
}

export interface DataFlowLevel {
  key: DataFlowLevelKey;
  code: "L0" | "L1" | "L2";
  name: string;
  /** Nhãn tab. */
  short: string;
  /** Trạng thái ngắn cạnh tên mức. */
  status: string;
  available: boolean;
  fit: string;
  /** Sơ đồ đọc từ trái sang phải; `boundary` = vị trí vạch "ranh giới dữ liệu" (sau nút thứ n). */
  flow: DataFlowNode[];
  boundaryAfter: number;
  boundaryNote: string;
  enters: string[];
  never: string[];
  storage: string[];
  conditions?: string[];
}

const P = BRAND.platformName;

export const DATA_FLOW_LEVELS: DataFlowLevel[] = [
  {
    key: "l0",
    code: "L0",
    short: "Chế độ xuất",
    name: `${P} + chế độ xuất`,
    status: "Mặc định",
    available: true,
    fit: "Hầu hết ngân hàng, và mọi đợt thí điểm. Không cần thẩm định nhà cung cấp xử lý dữ liệu khách hàng.",
    flow: [
      {
        side: "bank",
        title: "Cán bộ ngân hàng",
        detail: "Soạn nội dung trên sàn. Dữ kiện giá, hạn, tổ chức đấu giá lấy từ thông báo đấu giá.",
      },
      {
        side: "bank",
        title: "Kênh của ngân hàng",
        detail: "Zalo OA, SMS brandname, app ngân hàng, cán bộ quan hệ khách hàng — ngân hàng tự gửi.",
      },
      {
        side: "buyer",
        title: "Khách hàng của ngân hàng",
        detail: "Nhận tin, bấm link theo dõi riêng của từng kênh (/l/…).",
      },
      {
        side: "platform",
        title: P,
        detail: "Chỉ đếm lượt bấm ẩn danh, rồi mở trang tài sản công khai.",
      },
    ],
    boundaryAfter: 3,
    boundaryNote: "Danh sách khách hàng không đi qua vạch này.",
    enters: [
      "Thông tin tài sản đã công khai theo thông báo đấu giá (giá khởi điểm, tiền đặt trước, các mốc thời gian, tổ chức đấu giá).",
      "Nội dung truyền thông cán bộ soạn, kèm lịch sử soạn – gửi duyệt – duyệt.",
      "Lượt bấm link theo dõi: mã phiên trình duyệt ẩn danh và loại thiết bị. Không lưu địa chỉ IP.",
      `Lượt lưu tài sản và hồ sơ đăng ký của người mua có tài khoản trên ${P} — ngân hàng chỉ thấy SỐ ĐẾM, không thấy họ là ai.`,
    ],
    never: [
      "Danh sách khách hàng của ngân hàng: tên, số điện thoại, email, tài khoản Zalo.",
      "Thông tin người vay, khoản vay, hồ sơ tín dụng — mẫu nội dung không có chỗ cho các thông tin này.",
      "Nội dung tin nhắn ngân hàng gửi qua kênh riêng, và danh sách người đã nhận.",
    ],
    storage: [
      `Cơ sở dữ liệu PostgreSQL của ${P} trên Supabase, vùng Singapore (ap-southeast-1).`,
      "Phân quyền theo từng Trạm ở tầng cơ sở dữ liệu: đơn vị khác không đọc được dữ liệu của ngân hàng.",
      "Mọi thao tác tạo, sửa, duyệt, xuất nội dung đều ghi nhật ký, không sửa được.",
    ],
  },
  {
    key: "l1",
    code: "L1",
    short: "Danh sách của ngân hàng",
    name: `${P} + danh sách do ngân hàng tải lên`,
    status: "Chưa mở — chờ rà soát pháp lý",
    available: false,
    fit: "Ngân hàng muốn sàn gửi giúp tới khách hàng của mình và chấp nhận thẩm định nhà cung cấp.",
    flow: [
      {
        side: "bank",
        title: "Ngân hàng",
        detail: "Tải danh sách khách hàng đã đồng ý nhận tin cho TỪNG chiến dịch.",
      },
      {
        side: "platform",
        title: P,
        detail: "Gửi qua cổng email / SMS, đếm lượt mở và bấm.",
      },
      {
        side: "buyer",
        title: "Khách hàng của ngân hàng",
        detail: "Nhận tin, có link huỷ nhận tin trong mọi tin.",
      },
      {
        side: "platform",
        title: "Tự xoá",
        detail: "Danh sách bị xoá khi chiến dịch kết thúc.",
      },
    ],
    boundaryAfter: 1,
    boundaryNote: "Danh sách khách hàng ĐI QUA vạch này — cần hợp đồng xử lý dữ liệu.",
    enters: [
      "Mọi thứ của mức L0.",
      "Danh sách liên hệ khách hàng do ngân hàng tải lên, chỉ dùng cho chiến dịch đã duyệt.",
    ],
    never: [
      "Thông tin người vay, khoản vay, hồ sơ tín dụng.",
      "Danh sách không dùng lại cho chiến dịch khác hay cho mục đích của sàn.",
    ],
    storage: [
      "Cùng cơ sở dữ liệu với L0; danh sách tách riêng theo chiến dịch, tự xoá khi chiến dịch kết thúc.",
    ],
    conditions: [
      "Hợp đồng bên kiểm soát – bên xử lý dữ liệu theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026).",
      "Ngân hàng đánh giá rủi ro nhà cung cấp và báo cáo theo Thông tư 09/2020/TT-NHNN.",
      "Chỉ gửi cho khách hàng đã đồng ý nhận tin; huỷ nhận tin dễ như đăng ký.",
    ],
  },
  {
    key: "l2",
    code: "L2",
    short: "Nhãn trắng",
    name: "Nhãn trắng trong hạ tầng ngân hàng",
    status: "Theo dự án",
    available: true,
    fit: "Ngân hàng lớn có yêu cầu an toàn thông tin chặt: mọi dữ liệu ở lại trong ngân hàng.",
    flow: [
      {
        side: "bank",
        title: "Hệ thống của ngân hàng",
        detail: "Cùng phần mềm, chạy trên máy chủ ngân hàng hoặc đám mây trong nước.",
      },
      {
        side: "bank",
        title: "Đăng nhập SSO của ngân hàng",
        detail: "Cán bộ dùng tài khoản nội bộ (OIDC / SAML).",
      },
      {
        side: "bank",
        title: "Cổng gửi của ngân hàng",
        detail: "Email, SMS brandname, Zalo OA của chính ngân hàng.",
      },
      {
        side: "buyer",
        title: "Khách hàng của ngân hàng",
        detail: "Thấy thương hiệu ngân hàng, không thấy tên sàn.",
      },
    ],
    boundaryAfter: 4,
    boundaryNote: `${P} không vận hành và không truy cập hệ thống này.`,
    enters: [`Không có dữ liệu nào đi vào ${P}.`],
    never: ["Mọi dữ liệu khách hàng, nội dung và số liệu ở lại trong hạ tầng ngân hàng."],
    storage: [
      "Supabase tự vận hành (mã nguồn mở) trên hạ tầng ngân hàng.",
      "Giao diện, tên người gửi và tên miền link theo dõi mang thương hiệu ngân hàng.",
    ],
  },
];

export const DATA_FLOW_SIDE_LABEL: Record<DataFlowSide, string> = {
  bank: "Phía ngân hàng",
  buyer: "Khách hàng",
  platform: P,
};

export const dataFlowLevel = (key: string): DataFlowLevel =>
  DATA_FLOW_LEVELS.find((l) => l.key === key) ?? DATA_FLOW_LEVELS[0];
