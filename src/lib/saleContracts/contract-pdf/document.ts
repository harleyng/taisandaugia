// Cây nội dung pdfmake của dự thảo hợp đồng mua bán tài sản đấu giá.
//
// Thuần (không pdfmake runtime, không Supabase) để kiểm thử được. Dùng lại
// palette FORMAL + khối bảng của bản xuất hồ sơ đấu giá viên cho cùng giọng
// hành chính, in đen trắng không mất chữ.
//
// ⚠️ TÀI LIỆU RIÊNG TƯ: khác biên bản đấu giá công khai, bản này IN CCCD và
// địa chỉ của CẢ HAI bên — đó là bản chất một hợp đồng giữa họ. Tệp nằm trong
// bucket private `auction-sale-contracts`, không bao giờ để lọt ra link công khai.
//
// Tiền in theo formatVnd, và ở những chỗ pháp lý đòi hỏi thì kèm chữ
// (`tienBangChu`) — dùng lại đúng bộ đọc số của biên bản đấu giá để hai văn
// bản của cùng một cuộc đấu giá không đọc số khác nhau.

import type { Column, Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { MARGIN, themeOf } from "@/lib/personnel/dossier-pdf/theme";
import { dataTable, fmtDate } from "@/lib/personnel/dossier-pdf/primitives";
import { tienBangChu } from "@/lib/bidding/minutes-pdf/soThanhChu";
import { formatVnd } from "@/lib/advertising/slug";
import type { SaleBuyerParty, SaleOrgParty, SaleSellerParty } from "@/types/auction-sale-contract";
import {
  BREACH_TERMS,
  BUYER_DUTIES,
  DEPOSIT_CLAUSE,
  DRAFT_NOTICE,
  EFFECT,
  HANDOVER_TERMS,
  HDMB_TEMPLATE_VERSION,
  LEGAL_BASES,
  NOTARIZATION_NOTE,
  SELLER_DUTIES,
  TITLE_TRANSFER_TERMS,
} from "./clauses";
import type { SalePdfInput } from "./input";

const t = themeOf("FORMAL");
const SIDE_MARGIN = MARGIN + 16;

/** Chỗ trống để các bên điền tay khi dữ liệu trên sàn chưa có. */
export const BLANK = "………………………………";

const val = (v?: string | number | null): string =>
  v === null || v === undefined || String(v).trim() === "" ? BLANK : String(v);

const joinAddr = (...parts: Array<string | null | undefined>) =>
  parts.filter((p) => p && p.trim()).join(", ");

/** Tiền trong câu văn pháp lý: số + chữ. */
const moneyWithWords = (n: number | null | undefined): string =>
  n === null || n === undefined ? BLANK : `${formatVnd(n)} (${tienBangChu(n)})`;

function labelRows(pairs: Array<[string, string]>): Content {
  return {
    table: {
      widths: [150, "*"],
      body: pairs.map(([label, value]): TableCell[] => [
        { text: label, color: t.muted },
        { text: value },
      ]),
    },
    layout: "noBorders",
    margin: [0, 0, 0, 2],
  };
}

function article(n: number, title: string, body: Content[], opts: { unbreakable?: boolean } = {}): Content {
  return {
    unbreakable: opts.unbreakable,
    stack: [
      { text: `Điều ${n}. ${title}`, bold: true, fontSize: 10.5, margin: [0, 12, 0, 5] },
      ...body,
    ],
  };
}

function buyerRows(b: SaleBuyerParty): Array<[string, string]> {
  return [
    ["Họ và tên", val(b.full_name)],
    [b.id_type === "passport" ? "Số hộ chiếu" : "Số CCCD", val(b.id_number)],
    ["Ngày sinh", b.date_of_birth ? fmtDate(b.date_of_birth) : BLANK],
    ["Địa chỉ", val(b.address)],
    ["Điện thoại", val(b.phone)],
    ["Email", val(b.email)],
    ["Số báo danh", val(b.bidder_no)],
  ];
}

/**
 * Bên bán có hai hình dạng. Lô tin đăng chỉ có tên + địa chỉ trong danh bạ —
 * in đúng chừng đó rồi để tổ chức điền nốt, KHÔNG bịa CCCD.
 */
function sellerRows(s: SaleSellerParty, isRegistry: boolean): Array<[string, string]> {
  if (isRegistry || s.kind === "registry") {
    return [
      ["Tên bên có tài sản", val(s.name ?? s.org_name ?? s.full_name)],
      ["Địa chỉ", val(s.address)],
      ["Người đại diện", val(s.rep_full_name)],
      ["Chức vụ", val(s.rep_title)],
    ];
  }
  if (s.kind === "organization") {
    return [
      ["Tên tổ chức", val(s.org_name ?? s.name)],
      ["Mã số thuế / mã cơ quan", val(s.tax_code)],
      ["Địa chỉ trụ sở", val(joinAddr(s.address, s.province))],
      ["Người đại diện", val(s.rep_full_name)],
      ["Chức vụ", val(s.rep_title)],
      ["Email", val(s.email)],
    ];
  }
  return [
    ["Họ và tên", val(s.full_name ?? s.name)],
    [s.id_type === "passport" ? "Số hộ chiếu" : "Số CCCD", val(s.id_number)],
    ["Địa chỉ", val(joinAddr(s.address, s.ward, s.province))],
    ["Điện thoại", val(s.phone)],
    ["Email", val(s.email)],
  ];
}

function orgRows(g: SaleOrgParty): Array<[string, string]> {
  return [
    ["Tên tổ chức", val(g.name)],
    ["Mã số thuế", val(g.tax_code)],
    ["Địa chỉ", val(joinAddr(g.address, g.ward, g.district, g.province))],
    ["Điện thoại", val(g.phone)],
    ["Người đại diện theo pháp luật", val(g.legal_rep_name)],
    ["Chức vụ", val(g.legal_rep_position)],
  ];
}

/** Một cột chữ ký. Tách hàm để nhánh 3 chữ ký không làm mất kiểu Margins. */
function signatureColumn(title: string, hint: string, signer: string): Column {
  return {
    width: "*",
    alignment: "center",
    stack: [
      { text: title, bold: true },
      { text: hint, italics: true, fontSize: 8, color: t.muted },
      { text: signer, bold: true, margin: [0, 64, 0, 0] },
    ],
  };
}

const sellerSignerOf = (s: SaleSellerParty, isRegistry: boolean): string =>
  isRegistry || s.kind === "registry" || s.kind === "organization"
    ? val(s.rep_full_name)
    : val(s.full_name ?? s.name);

export function buildSaleDocDefinition(input: SalePdfInput): TDocumentDefinitions {
  const { buyer, seller, org, asset, sellerIsRegistry } = input;
  const lotLine = asset.lot_no ? `Lô ${asset.lot_no}` : null;

  const scheduleTable: Content[] = input.installments.length
    ? [
        dataTable(
          t,
          [
            { text: "Kỳ", width: "auto" },
            { text: "Nội dung" },
            { text: "Hạn thanh toán", width: "auto" },
            { text: "Số tiền", align: "right", width: "auto" },
          ],
          input.installments.map((i): TableCell[] => [
            { text: String(i.seq) },
            { text: i.label ?? `Kỳ ${i.seq}` },
            { text: i.dueAt ? fmtDate(i.dueAt) : BLANK },
            { text: formatVnd(i.amount), alignment: "right" },
          ]),
        ),
        {
          text: `Tổng số tiền còn phải thanh toán: ${moneyWithWords(input.payable)}`,
          bold: true,
          alignment: "right",
          margin: [0, 4, 0, 0],
        },
      ]
    : [
        {
          text: `Số tiền còn phải thanh toán: ${moneyWithWords(input.payable)}. Thời hạn do hai bên thống nhất.`,
        },
      ];

  const payeeText =
    input.payeeSide === "org"
      ? `Bên mua thanh toán thông qua tổ chức đấu giá tài sản (${val(org.name)}).`
      : "Bên mua thanh toán trực tiếp cho Bên bán.";

  const content: Content[] = [
    {
      columns: [
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: val(org.name).toUpperCase(), bold: true, fontSize: 9 },
            {
              text: `Số: ${input.contractNo || "……/……/HĐMB"}`,
              fontSize: 9,
              margin: [0, 3, 0, 0],
            },
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
    {
      text: "HỢP ĐỒNG MUA BÁN TÀI SẢN ĐẤU GIÁ",
      bold: true,
      fontSize: 14,
      alignment: "center",
      margin: [0, 22, 0, 2],
    },
    {
      text: `(Mã hồ sơ trên sàn: ${input.code ?? "—"}${
        asset.session_code ? ` · Phiên ${asset.session_code}` : ""
      }${lotLine ? ` · ${lotLine}` : ""})`,
      fontSize: 8,
      color: t.muted,
      alignment: "center",
      margin: [0, 0, 0, 12],
    },
    { stack: LEGAL_BASES.map((b): Content => ({ text: b, italics: true, margin: [0, 0, 0, 2] })) },
    {
      text: "Hôm nay, ngày …… tháng …… năm ……, tại ………………………………………, chúng tôi gồm:",
      margin: [0, 10, 0, 6],
    },

    { text: "BÊN BÁN — BÊN CÓ TÀI SẢN", bold: true, margin: [0, 6, 0, 3] },
    labelRows(sellerRows(seller, sellerIsRegistry)),
    ...(sellerIsRegistry
      ? [
          {
            text: `Bên bán uỷ quyền cho ${val(org.name)} thực hiện việc ký kết và các thủ tục liên quan theo quy định của pháp luật về đấu giá tài sản.`,
            italics: true,
            fontSize: 9,
            color: t.muted,
            margin: [0, 3, 0, 0],
          } as Content,
        ]
      : []),
    { text: "BÊN MUA — NGƯỜI TRÚNG ĐẤU GIÁ", bold: true, margin: [0, 8, 0, 3] },
    labelRows(buyerRows(buyer)),
    ...(input.orgSigns
      ? [
          { text: "TỔ CHỨC ĐẤU GIÁ TÀI SẢN", bold: true, margin: [0, 8, 0, 3] } as Content,
          labelRows(orgRows(org)),
        ]
      : []),
    {
      text: "Các bên thống nhất ký kết hợp đồng mua bán tài sản đấu giá với các điều khoản sau:",
      margin: [0, 10, 0, 0],
    },

    article(1, "Tài sản mua bán", [
      labelRows([
        ["Tên tài sản", val(asset.title)],
        ["Loại tài sản", val(input.categoryLabel)],
        ["Nơi có tài sản", val(joinAddr(asset.district, asset.province))],
        ["Phiên đấu giá", val(asset.session_code)],
        ["Lô số", val(asset.lot_no)],
      ]),
      {
        text: "Tài sản được mua bán theo hiện trạng tại thời điểm đấu giá. Bên mua đã xem tài sản và chấp nhận hiện trạng đó.",
        margin: [0, 3, 0, 0],
      },
    ]),

    article(2, "Giá mua tài sản", [
      { text: `Giá mua tài sản (giá trúng đấu giá): ${moneyWithWords(input.price)}.` },
      {
        text: "Giá mua nêu trên là giá trúng đấu giá đã được công bố tại cuộc đấu giá và không thay đổi.",
        margin: [0, 3, 0, 0],
      },
    ]),

    article(3, "Tiền đặt trước chuyển thành tiền đặt cọc", [
      { text: DEPOSIT_CLAUSE },
      labelRows([
        ["Tiền đặt cọc đã nộp", input.depositCredit > 0 ? formatVnd(input.depositCredit) : BLANK],
        ["Số tiền còn phải thanh toán", formatVnd(input.payable)],
      ]),
    ]),

    article(4, "Phương thức và thời hạn thanh toán", [
      { text: payeeText },
      ...scheduleTable,
      ...(input.payeeBankInfo
        ? [{ text: `Thông tin nhận tiền: ${input.payeeBankInfo}`, margin: [0, 5, 0, 0] } as Content]
        : []),
    ]),

    article(5, "Bàn giao tài sản", [
      { text: HANDOVER_TERMS },
      ...(input.handoverDueAt
        ? [
            {
              text: `Thời hạn bàn giao dự kiến: ${fmtDate(input.handoverDueAt)}.`,
              margin: [0, 3, 0, 0],
            } as Content,
          ]
        : []),
    ]),

    article(6, "Đăng ký quyền sở hữu, quyền sử dụng tài sản", [
      { text: TITLE_TRANSFER_TERMS },
      ...(input.notarizationRequired
        ? [{ text: NOTARIZATION_NOTE, margin: [0, 3, 0, 0] } as Content]
        : []),
    ]),

    article(7, "Quyền và nghĩa vụ của Bên bán", [{ ul: SELLER_DUTIES }]),
    article(8, "Quyền và nghĩa vụ của Bên mua", [{ ul: BUYER_DUTIES }]),
    article(9, "Vi phạm hợp đồng, chấm dứt và giải quyết tranh chấp", [{ ul: BREACH_TERMS }]),
    article(10, "Hiệu lực hợp đồng", [{ ul: EFFECT }], { unbreakable: true }),

    {
      unbreakable: true,
      margin: [0, 28, 0, 0],
      columns: [
        signatureColumn("BÊN BÁN", "(Ký, ghi rõ họ tên, đóng dấu nếu có)", sellerSignerOf(seller, sellerIsRegistry)),
        signatureColumn("BÊN MUA", "(Ký, ghi rõ họ tên)", val(buyer.full_name)),
        ...(input.orgSigns ? [signatureColumn("TỔ CHỨC ĐẤU GIÁ", "(Ký, ghi rõ họ tên, đóng dấu)", val(org.legal_rep_name))] : []),
      ],
    },
  ];

  return {
    pageSize: "A4",
    pageMargins: [SIDE_MARGIN, MARGIN, SIDE_MARGIN, 52],
    watermark: { text: "DỰ THẢO", color: t.line, opacity: 0.3, bold: true },
    defaultStyle: { font: "Roboto", fontSize: 10, color: t.ink, lineHeight: 1.35 },
    info: {
      title: `Dự thảo hợp đồng mua bán tài sản đấu giá — ${asset.title ?? ""}`,
      author: org.name ?? undefined,
    },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [SIDE_MARGIN, 14, SIDE_MARGIN, 0],
      columns: [
        {
          text: `${DRAFT_NOTICE} · ${HDMB_TEMPLATE_VERSION} · ${input.code ?? ""} · Tạo ngày ${fmtDate(
            input.generatedAt.toISOString(),
          )}`,
          fontSize: 7,
          color: t.muted,
        },
        {
          text: `Trang ${currentPage}/${pageCount}`,
          width: "auto",
          fontSize: 7,
          color: t.muted,
          alignment: "right",
        },
      ],
    }),
  };
}
