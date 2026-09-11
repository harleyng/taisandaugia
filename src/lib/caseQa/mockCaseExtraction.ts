import type { CaseTopic, UploadableDocType } from "@/types/case-qa";
import type { ExtractionLot, ExtractionSession } from "./caseExtraction";

/**
 * KHO KHUÔN của trích xuất giả lập — chỉ có câu chữ, không có logic.
 * XOÁ NGUYÊN FILE khi có Edge Function `extract-case-document` đọc tệp thật.
 *
 * Luật viết khuôn: câu nào cần dữ liệu phiên thì lấy qua ctx.money / ctx.time
 * (thiếu → chỗ trống + cảnh báo); điều khoản phiên không có dữ liệu (số tài khoản,
 * hoàn cọc, đối tượng…) thì LUÔN là ctx.fill — tuyệt đối không viết sẵn giá trị.
 */

export const MOCK_ENGINE_LABEL = "Trích xuất giả lập (mock-v1)";

export interface TemplateCtx {
  session: ExtractionSession;
  lots: readonly ExtractionLot[];
  orgName: string | null;
  /** Dữ liệu phiên lẽ ra phải có nhưng đang trống → chỗ trống + cảnh báo. */
  missing: (label: string) => string;
  /** Nội dung chỉ tài liệu gốc mới có → luôn là chỗ trống. */
  fill: (label: string) => string;
  money: (value: number | null, label: string) => string;
  time: (iso: string | null, label: string) => string;
  lotLines: (line: (lot: ExtractionLot) => string) => string;
}

export interface ClauseTemplate {
  heading: string;
  topics: readonly CaseTopic[];
  variants: readonly ((ctx: TemplateCtx) => string)[];
}

export interface DocTemplate {
  refPrefix: string;
  /** Quy chế thường mở đầu bằng vài điều chung — số điều bắt đầu lệch tất định theo tài liệu. */
  refStart?: readonly [number, number];
  clauses: readonly ClauseTemplate[];
}

export const EXTRACTION_TEMPLATES: Record<UploadableDocType, DocTemplate> = {
  notice: {
    refPrefix: "Mục",
    clauses: [
      {
        heading: "Tài sản đấu giá và giá khởi điểm",
        topics: ["starting_price"],
        variants: [
          (ctx) =>
            ctx.lotLines(
              (l) => `Lô ${l.lot_no} – ${l.title}: giá khởi điểm ${ctx.money(l.starting_price, `giá khởi điểm lô ${l.lot_no}`)}.`,
            ),
          (ctx) =>
            ctx.lotLines(
              (l) => `Lô ${l.lot_no}: ${l.title}, giá khởi điểm là ${ctx.money(l.starting_price, `giá khởi điểm lô ${l.lot_no}`)}.`,
            ),
        ],
      },
      {
        heading: "Thời gian, địa điểm bán hồ sơ tham gia đấu giá",
        topics: ["document_sale"],
        variants: [
          (ctx) =>
            `Thời gian bán hồ sơ tham gia đấu giá: từ ${ctx.time(ctx.session.registration_start_at, "thời điểm mở bán hồ sơ")} đến ${ctx.time(ctx.session.registration_end_at, "hạn đăng ký tham gia")}.\nĐịa điểm bán hồ sơ: ${ctx.fill("địa điểm bán hồ sơ")}.`,
        ],
      },
      {
        heading: "Hạn đăng ký tham gia đấu giá",
        topics: ["registration_deadline"],
        variants: [
          (ctx) =>
            `Hạn chót nộp hồ sơ đăng ký tham gia đấu giá là ${ctx.time(ctx.session.registration_end_at, "hạn đăng ký tham gia")}.`,
          (ctx) =>
            `Người đăng ký nộp hồ sơ tham gia đấu giá chậm nhất vào ${ctx.time(ctx.session.registration_end_at, "hạn đăng ký tham gia")}.`,
        ],
      },
      {
        heading: "Tiền mua hồ sơ tham gia đấu giá",
        topics: ["document_fee"],
        variants: [
          (ctx) => `Tiền mua hồ sơ tham gia đấu giá là ${ctx.money(ctx.session.dossier_fee, "tiền mua hồ sơ")}/hồ sơ.`,
        ],
      },
      {
        heading: "Thời gian tổ chức cuộc đấu giá",
        topics: ["schedule"],
        variants: [
          (ctx) => `Thời gian tổ chức cuộc đấu giá: ${ctx.time(ctx.session.starts_at, "thời gian tổ chức cuộc đấu giá")}.`,
        ],
      },
      {
        heading: "Địa điểm tổ chức cuộc đấu giá",
        topics: ["venue"],
        variants: [
          (ctx) =>
            `Địa điểm tổ chức cuộc đấu giá: ${ctx.session.venue?.trim() || ctx.missing("địa điểm tổ chức cuộc đấu giá")}.`,
        ],
      },
      {
        heading: "Hình thức, phương thức đấu giá",
        topics: ["format"],
        variants: [
          (ctx) =>
            `Hình thức đấu giá: ${ctx.session.formatLabel || ctx.missing("hình thức đấu giá")}.\nPhương thức đấu giá: ${ctx.fill("trả giá lên hoặc đặt giá xuống")}.`,
        ],
      },
    ],
  },

  rules: {
    refPrefix: "Điều",
    refStart: [3, 5],
    clauses: [
      {
        heading: "Đối tượng được tham gia đấu giá",
        topics: ["eligibility"],
        variants: [
          (ctx) =>
            `Đối tượng được tham gia đấu giá: ${ctx.fill("đối tượng được tham gia")}.\nNhững người không được tham gia đấu giá: ${ctx.fill("các trường hợp không được tham gia")}.`,
        ],
      },
      {
        heading: "Hồ sơ đăng ký tham gia đấu giá",
        topics: ["documents_required"],
        variants: [
          (ctx) => `Thành phần hồ sơ đăng ký tham gia đấu giá gồm các giấy tờ: ${ctx.fill("danh mục giấy tờ")}.`,
        ],
      },
      {
        heading: "Uỷ quyền tham gia đấu giá",
        topics: ["proxy"],
        variants: [
          (ctx) =>
            `Người đăng ký có thể uỷ quyền cho người khác tham gia đấu giá: ${ctx.fill("điều kiện và giấy tờ uỷ quyền")}.`,
        ],
      },
      {
        heading: "Bước giá",
        topics: ["bid_step"],
        variants: [
          (ctx) => ctx.lotLines((l) => `Lô ${l.lot_no}: bước giá ${ctx.money(l.bid_step, `bước giá lô ${l.lot_no}`)}.`),
          (ctx) =>
            ctx.lotLines((l) => `Lô ${l.lot_no}: bước giá là ${ctx.money(l.bid_step, `bước giá lô ${l.lot_no}`)}/lần trả giá.`),
        ],
      },
      {
        heading: "Các trường hợp đấu giá không thành",
        topics: ["auction_failed"],
        variants: [(ctx) => `Cuộc đấu giá không thành trong các trường hợp: ${ctx.fill("các trường hợp theo quy chế")}.`],
      },
      {
        heading: "Rút lại giá đã trả, từ chối kết quả trúng đấu giá",
        topics: ["withdrawal"],
        variants: [
          (ctx) =>
            `Người đã trả giá mà rút lại giá đã trả hoặc từ chối kết quả trúng đấu giá thì ${ctx.fill("hậu quả theo quy chế")}.`,
        ],
      },
      {
        heading: "Thanh toán tiền trúng đấu giá",
        topics: ["payment"],
        variants: [
          (ctx) =>
            `Người trúng đấu giá thanh toán tiền trúng đấu giá trong thời hạn ${ctx.fill("thời hạn và phương thức thanh toán")}.`,
        ],
      },
    ],
  },

  deposit_terms: {
    refPrefix: "Khoản",
    clauses: [
      {
        heading: "Khoản tiền đặt trước",
        topics: ["deposit"],
        variants: [
          (ctx) =>
            ctx.lotLines((l) => `Lô ${l.lot_no}: tiền đặt trước ${ctx.money(l.deposit_amount, `tiền đặt trước lô ${l.lot_no}`)}.`),
          (ctx) =>
            ctx.lotLines(
              (l) => `Lô ${l.lot_no} – ${l.title}: tiền đặt trước là ${ctx.money(l.deposit_amount, `tiền đặt trước lô ${l.lot_no}`)}.`,
            ),
        ],
      },
      {
        heading: "Thời hạn nộp tiền đặt trước",
        topics: ["deposit_deadline"],
        variants: [
          (ctx) =>
            `Người đăng ký nộp tiền đặt trước chậm nhất đến ${ctx.time(ctx.session.registration_end_at, "hạn nộp tiền đặt trước")}.`,
        ],
      },
      {
        heading: "Phương thức nộp tiền đặt trước",
        topics: ["deposit_method"],
        variants: [
          (ctx) =>
            `Tiền đặt trước nộp bằng chuyển khoản vào tài khoản ${ctx.fill("số tài khoản, ngân hàng")}, nội dung chuyển khoản: ${ctx.fill("cú pháp nội dung chuyển khoản")}.`,
        ],
      },
      {
        heading: "Hoàn trả tiền đặt trước",
        topics: ["deposit_refund"],
        variants: [
          (ctx) =>
            `Tiền đặt trước của người không trúng đấu giá được hoàn trả trong thời hạn ${ctx.fill("số ngày làm việc")} ngày làm việc kể từ ngày kết thúc cuộc đấu giá.`,
        ],
      },
      {
        heading: "Các trường hợp không được nhận lại tiền đặt trước",
        topics: ["deposit_forfeit"],
        variants: [
          (ctx) =>
            `Người tham gia đấu giá không được nhận lại tiền đặt trước trong các trường hợp: ${ctx.fill("các trường hợp theo quy chế")}.`,
        ],
      },
    ],
  },

  viewing_schedule: {
    refPrefix: "Mục",
    clauses: [
      {
        heading: "Thời gian xem tài sản",
        topics: ["viewing"],
        variants: [
          (ctx) =>
            ctx.session.viewing_start_at || ctx.session.viewing_end_at
              ? `Người đăng ký tham gia đấu giá được xem tài sản từ ${ctx.time(ctx.session.viewing_start_at, "thời điểm bắt đầu xem tài sản")} đến ${ctx.time(ctx.session.viewing_end_at, "thời điểm kết thúc xem tài sản")}.`
              : `Thời gian xem tài sản: ${ctx.missing("thời gian xem tài sản")}.`,
        ],
      },
      {
        heading: "Địa điểm xem tài sản",
        topics: ["viewing"],
        variants: [(ctx) => `Địa điểm xem tài sản: ${ctx.fill("địa chỉ nơi có tài sản")}.`],
      },
      {
        heading: "Đăng ký lịch xem tài sản",
        topics: ["viewing"],
        variants: [
          (ctx) => `Để đăng ký lịch xem tài sản, người đăng ký liên hệ: ${ctx.fill("đầu mối liên hệ, số điện thoại")}.`,
        ],
      },
    ],
  },
};
