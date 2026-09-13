// Cây nội dung pdfmake của BIÊN BẢN ĐẤU GIÁ TÀI SẢN.
//
// Thuần (không pdfmake runtime, không Supabase) để kiểm thử được. Dùng lại
// palette FORMAL + khối bảng của bản xuất hồ sơ đấu giá viên, như dự thảo hợp
// đồng, cho cùng giọng hành chính và in đen trắng không mất chữ.
//
// ⚠️ BIÊN BẢN KHÔNG IN SỐ THỨ TỰ PHÁT HÀNH, CŨNG KHÔNG IN HASH CỦA CHÍNH NÓ.
//   • sequence_no do org_issue_minutes cấp (max+1) SAU khi tệp đã nằm trong
//     storage — RPC từ chối `file_missing` nếu gọi trước. Tệp lại bất biến
//     (bucket không có policy UPDATE/DELETE) và pdf_path là UNIQUE, nên không
//     dựng lại được để in số vào. In số đoán trước = ký một tờ giấy có thể mâu
//     thuẫn với sổ.
//   • Hash là hash CỦA TỆP NÀY, không thể nằm trong chính nó.
// Thay vào đó: thời điểm lập (khác nhau giữa các lần phát hành) in ở đoạn kết và
// ở footer; số thứ tự + SHA-256 hiện cạnh link tải trên giao diện, đọc từ
// auction_session_minutes.
//
// Hệ quả kèm theo: hash chứng thực TỆP ĐÃ LƯU, không chứng thực một bản dựng lại
// — pdfmake nhúng CreationDate nên tạo lại cùng dữ liệu vẫn ra hash khác.
//
// Quyền riêng tư: biên bản công khai sau khi chốt phiên ⇒ chỉ họ tên + số báo
// danh. Xem ràng buộc ở đầu ./input.ts.

import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { MARGIN, themeOf } from "@/lib/personnel/dossier-pdf/theme";
import { dataTable, fmtDate } from "@/lib/personnel/dossier-pdf/primitives";
import { formatVnd } from "@/lib/advertising/slug";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import { LOT_RESULT_LABELS } from "@/types/auction-bidding";
import {
  COMPLAINT_HEADING,
  DEPOSIT_CLAUSE,
  LEGAL_BASES,
  ONLINE_RECORD_NOTICE,
  PAYMENT_DUTY,
} from "./clauses";
import { tienBangChu } from "./soThanhChu";
import type { MinutesLotRow, MinutesPdfInput } from "./input";

const t = themeOf("FORMAL");
const SIDE_MARGIN = MARGIN + 16;

/** Chỗ trống điền tay khi dữ liệu trên sàn chưa có. */
export const BLANK = "………………………………";

const val = (v?: string | number | null): string =>
  v === null || v === undefined || String(v).trim() === "" ? BLANK : String(v);

/** "15:04 ngày 12/09/2026" — lệ văn bản, giờ trước ngày. */
function fmtMoment(iso?: string | Date | null): string {
  if (!iso) return BLANK;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return BLANK;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(d.getHours())}:${p2(d.getMinutes())} ngày ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Tiền kèm chữ theo lệ văn bản pháp lý. */
const moneyWithWords = (n: number | null | undefined): string =>
  n == null ? BLANK : `${formatVnd(n)} (${tienBangChu(n)})`;

function labelRows(pairs: Array<[string, string]>): Content {
  return {
    table: {
      widths: [150, "*"],
      body: pairs.map(([label, value]): TableCell[] => [{ text: label, color: t.muted }, { text: value }]),
    },
    layout: "noBorders",
    margin: [0, 0, 0, 2],
  };
}

/**
 * `unbreakable` chỉ cho điều NGẮN (tổng hợp, khiếu nại): giữ tiêu đề đi cùng
 * phần thân, nếu không trang gãy ngay dưới tiêu đề và để lại một dòng mồ côi.
 * ĐỪNG đặt cho Điều 1: bảng lô có thể dài hơn một trang và sẽ không in ra được.
 */
function article(n: number, title: string, body: Content[], opts: { unbreakable?: boolean } = {}): Content {
  return {
    unbreakable: opts.unbreakable,
    stack: [{ text: `Điều ${n}. ${title}`, bold: true, fontSize: 10.5, margin: [0, 12, 0, 5] }, ...body],
  };
}

function resultLabel(lot: MinutesLotRow): string {
  if (lot.withdrawn) return "Đã rút khỏi phiên";
  return lot.result ? LOT_RESULT_LABELS[lot.result] : "Chưa có kết quả";
}

/**
 * Sáu cột, KHÔNG bảy: biên bản in dọc theo lệ văn bản hành chính, mà khổ A4 dọc
 * chỉ còn ~480pt. Thêm một cột "Người trúng" nữa thì cột tài sản còn chưa tới
 * 80pt và mọi tiêu đề đều vỡ dòng. Người trúng và lý do rút xuống dòng phụ dưới
 * tên tài sản; Điều 3 vẫn nêu đầy đủ từng người bằng câu văn.
 */
function lotRow(lot: MinutesLotRow): TableCell[] {
  const sub: Content[] = [];
  if (lot.winnerName && lot.winnerBidderNo != null) {
    sub.push({
      text: `Người trúng: ${lot.winnerName} (SBD ${formatBidderNo(lot.winnerBidderNo)})`,
      fontSize: 8,
      color: t.muted,
    });
  }
  if (lot.withdrawn && lot.withdrawReason) {
    sub.push({ text: `Lý do rút: ${lot.withdrawReason}`, fontSize: 8, color: t.muted });
  }
  return [
    { text: String(lot.lotNo), alignment: "center", fontSize: 9 },
    { stack: [{ text: lot.title, fontSize: 9 }, ...sub] },
    {
      text: lot.startingPrice != null ? formatVnd(lot.startingPrice) : BLANK,
      alignment: "right",
      fontSize: 9,
    },
    { text: String(lot.bidCount), alignment: "center", fontSize: 9 },
    { text: resultLabel(lot), fontSize: 9 },
    {
      text: lot.winningAmount != null ? formatVnd(lot.winningAmount) : "—",
      alignment: "right",
      fontSize: 9,
    },
  ];
}

export function buildMinutesDocDefinition(input: MinutesPdfInput): TDocumentDefinitions {
  const { session, org, auctioneer, lots } = input;
  const sold = lots.filter((l) => l.result === "sold" && !l.withdrawn);
  const unsold = lots.filter((l) => l.result === "unsold" && !l.withdrawn);
  const withdrawn = lots.filter((l) => l.withdrawn);

  const totalStart = lots.reduce((sum, l) => sum + (l.startingPrice ?? 0), 0);
  const totalWin = sold.reduce((sum, l) => sum + (l.winningAmount ?? 0), 0);

  const content: Content[] = [
    {
      columns: [
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: val(org.name).toUpperCase(), bold: true, fontSize: 9 },
            { text: val(org.address), fontSize: 8, color: t.muted, margin: [0, 2, 0, 0] },
            ...(org.phone ? [{ text: `ĐT: ${org.phone}`, fontSize: 8, color: t.muted }] : []),
          ],
        },
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, fontSize: 9 },
            {
              text: "Độc lập – Tự do – Hạnh phúc",
              bold: true,
              fontSize: 9,
              decoration: "underline",
              margin: [0, 2, 0, 0],
            },
          ],
        },
      ],
    },

    { text: "BIÊN BẢN ĐẤU GIÁ TÀI SẢN", bold: true, fontSize: 14, alignment: "center", margin: [0, 22, 0, 2] },
    {
      text: `(Cuộc đấu giá trực tuyến — mã phiên ${session.code ?? "—"})`,
      fontSize: 8,
      color: t.muted,
      alignment: "center",
      margin: [0, 0, 0, 12],
    },

    { stack: LEGAL_BASES.map((b): Content => ({ text: b, italics: true, margin: [0, 0, 0, 2] })) },

    {
      text: `Hôm nay, ${fmtMoment(session.finalizedAt)}, tổ chức đấu giá tài sản lập biên bản ghi nhận kết quả cuộc đấu giá như sau:`,
      margin: [0, 10, 0, 8],
    },

    labelRows([
      ["Mã phiên đấu giá", val(session.code)],
      ["Tên phiên", val(session.title)],
      ["Tổ chức đấu giá tài sản", val(org.name)],
      [
        "Đấu giá viên điều hành",
        auctioneer
          ? `${auctioneer.fullName}${auctioneer.licenseNumber ? ` — Thẻ ĐGV số ${auctioneer.licenseNumber}` : ""}`
          : BLANK,
      ],
      ["Hình thức đấu giá", AUCTION_FORMAT_LABELS[session.auctionFormat] ?? val(session.auctionFormat)],
      ["Phương thức đấu giá", "Trả giá lên"],
      ["Thời gian bắt đầu", fmtMoment(session.startsAt)],
      ["Thời gian kết thúc", fmtMoment(session.endsAt)],
      ["Thời gian gia hạn mỗi lượt", `${session.extensionSeconds} giây`],
      ["Số bước giá tối đa mỗi lượt", String(session.maxBidSteps)],
      ["Địa điểm", val(session.venue) === BLANK ? "Sàn đấu giá trực tuyến taisandaugia.vn" : val(session.venue)],
      ["Số hồ sơ tham gia đã bán", String(input.dossierCount)],
      ["Số người được cấp số báo danh", String(input.bidderNoCount)],
      ["Thời điểm chốt kết quả", fmtMoment(session.finalizedAt)],
    ]),

    article(1, "Kết quả đấu giá từng tài sản", [
      dataTable(
        t,
        [
          { text: "Lô", width: 22 },
          { text: "Tài sản" },
          { text: "Giá khởi điểm", align: "right", width: "auto" },
          { text: "Lượt", width: 28 },
          { text: "Kết quả", width: "auto" },
          { text: "Giá trúng", align: "right", width: "auto" },
        ],
        lots.map(lotRow),
      ),
      { text: ONLINE_RECORD_NOTICE, fontSize: 8, italics: true, color: t.muted, margin: [0, 5, 0, 0] },
    ]),

    article(2, "Tổng hợp kết quả", [
      labelRows(
        [
          ["Tổng số tài sản đưa ra đấu giá", String(lots.length)],
          ["Số tài sản đấu giá thành", String(sold.length)],
          ["Số tài sản đấu giá không thành", String(unsold.length)],
          ["Số tài sản đã rút khỏi phiên", String(withdrawn.length)],
          ["Tổng giá khởi điểm", moneyWithWords(totalStart)],
          ["Tổng giá trúng đấu giá", sold.length ? moneyWithWords(totalWin) : "—"],
        ],
      ),
    ], { unbreakable: true }),

    article(3, "Người trúng đấu giá và nghĩa vụ thanh toán", [
      ...(sold.length
        ? sold.map(
            (l): Content => ({
              text:
                `Ông/Bà ${val(l.winnerName)}, số báo danh ${formatBidderNo(l.winnerBidderNo) ?? BLANK}, ` +
                `trúng đấu giá lô ${l.lotNo} — ${l.title} với giá ${moneyWithWords(l.winningAmount)}; ` +
                `hạn thanh toán đến ${fmtMoment(l.paymentDueAt)}.`,
              margin: [0, 0, 0, 4],
            }),
          )
        : [{ text: "Cuộc đấu giá không có tài sản nào đấu giá thành.", margin: [0, 0, 0, 4] } as Content]),
      { text: PAYMENT_DUTY, margin: [0, 4, 0, 4] },
      { text: DEPOSIT_CLAUSE },
    ]),

    article(4, COMPLAINT_HEADING, [
      { stack: [BLANK, BLANK, BLANK].map((b): Content => ({ text: b, margin: [0, 0, 0, 6] })) },
    ], { unbreakable: true }),

    {
      text:
        `Biên bản được lập lúc ${fmtMoment(input.generatedAt)}, đọc lại cho những người có tên dưới đây ` +
        "cùng nghe và ký xác nhận.",
      margin: [0, 12, 0, 0],
    },

    {
      unbreakable: true,
      margin: [0, 28, 0, 0],
      columns: [
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: "ĐẤU GIÁ VIÊN", bold: true },
            { text: "(Ký, ghi rõ họ tên)", italics: true, fontSize: 8, color: t.muted },
            { text: auctioneer ? auctioneer.fullName : BLANK, bold: true, margin: [0, 64, 0, 0] },
          ],
        },
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: "NGƯỜI TRÚNG ĐẤU GIÁ", bold: true },
            { text: "(Ký, ghi rõ họ tên)", italics: true, fontSize: 8, color: t.muted },
            // Chỉ điền sẵn khi có đúng MỘT người trúng; nhiều người thì để trống
            // cho từng người ký, in một cái tên là gợi ý sai ai phải ký.
            {
              text: sold.length === 1 ? val(sold[0].winnerName) : BLANK,
              bold: true,
              margin: [0, 64, 0, 0],
            },
          ],
        },
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: "NGƯỜI CHỨNG KIẾN", bold: true },
            { text: "(Ký, ghi rõ họ tên)", italics: true, fontSize: 8, color: t.muted },
            { text: BLANK, bold: true, margin: [0, 64, 0, 0] },
          ],
        },
      ],
    },
  ];

  return {
    pageSize: "A4",
    pageMargins: [SIDE_MARGIN, MARGIN, SIDE_MARGIN, 52],
    defaultStyle: { font: "Roboto", fontSize: 10, color: t.ink, lineHeight: 1.35 },
    info: { title: `Biên bản đấu giá — ${session.code ?? session.id}`, author: org.name },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [SIDE_MARGIN, 14, SIDE_MARGIN, 0],
      columns: [
        {
          // KHÔNG nhét URL đầy đủ vào đây: id phiên dài 36 ký tự làm footer vắt
          // sang dòng hai ở mọi trang. Mã phiên đứng ngay đầu dòng là đủ để tra.
          text:
            `${session.code ?? session.id} · Biên bản do taisandaugia.vn phát hành · ` +
            `Lập lúc ${fmtMoment(input.generatedAt)} · Mã kiểm tra SHA-256 tra cứu tại trang phiên`,
          fontSize: 7,
          color: t.muted,
        },
        { text: `Trang ${currentPage}/${pageCount}`, width: "auto", fontSize: 7, color: t.muted, alignment: "right" },
      ],
    }),
  };
}
