// Cây nội dung pdfmake của HỢP ĐỒNG CUNG ỨNG DỊCH VỤ (HDCU).
//
// Thuần (không pdfmake runtime, không Supabase) để kiểm thử được. Dựng lại được
// bất cứ lúc nào từ hai thứ bất biến: dòng service_contracts (dữ kiện đơn + các
// bên đóng băng lúc đồng ý) và mẫu contract_templates theo template_id — nên sàn
// không lưu tệp PDF. Bản xem trước (chưa đồng ý) in dấu "XEM TRƯỚC".

import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { MARGIN, themeOf } from "@/lib/personnel/dossier-pdf/theme";
import { fmtDate } from "@/lib/personnel/dossier-pdf/primitives";
import { formatVnd } from "@/lib/advertising/slug";
import { gdMethodLabel } from "@/lib/authentication/status";
import { slotList, slotText } from "@/lib/contracts/templates/resolve";
import type {
  ServiceContractTerms,
  ServiceOwnerParty,
  ServiceProviderParty,
} from "@/types/service-contract";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";

const t = themeOf("FORMAL");
const SIDE_MARGIN = MARGIN + 16;
export const BLANK = "………………………………";

export interface ServiceContractPdfInput {
  kind: ServiceKindKey;
  /** null ⇒ bản xem trước trước khi đồng ý. */
  code: string | null;
  templateVersion: string;
  clauses: Record<string, unknown>;
  terms: ServiceContractTerms;
  /** null ở bản xem trước — server chụp Bên A lúc đồng ý. */
  owner: ServiceOwnerParty | null;
  provider: ServiceProviderParty;
  acceptedAt: string | null;
  acceptedByName: string | null;
  contentHash: string | null;
  generatedAt: Date;
}

const val = (v?: string | number | null): string =>
  v === null || v === undefined || String(v).trim() === "" ? BLANK : String(v);

const joinAddr = (...parts: Array<string | null | undefined>) => parts.filter((p) => p && p.trim()).join(", ");

const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return BLANK;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return BLANK;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(d.getHours())}:${p2(d.getMinutes())} ${fmtDate(iso)}`;
};

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

function article(n: number, title: string, body: Content[]): Content {
  return { stack: [{ text: `Điều ${n}. ${title}`, bold: true, fontSize: 10.5, margin: [0, 12, 0, 5] }, ...body] };
}

function ownerRows(o: ServiceOwnerParty | null): Array<[string, string]> {
  if (!o) return [["Thông tin", "Theo thông tin xác thực của Bên A trên sàn tại thời điểm đồng ý"]];
  const signer: Array<[string, string]> = o.signatory
    ? [["Người đồng ý trên sàn", val([o.signatory.name, o.signatory.email].filter(Boolean).join(" · "))]]
    : [];
  if (o.kind === "organization") {
    return [
      ["Tên tổ chức", val(o.org_name)],
      ["Mã số thuế / mã cơ quan", val(o.tax_code)],
      ["Địa chỉ trụ sở", val(joinAddr(o.address, o.province))],
      ["Người đại diện", val(o.rep_full_name)],
      ["Chức vụ", val(o.rep_title)],
      ...signer,
    ];
  }
  if (o.kind === "individual") {
    return [
      ["Họ và tên", val(o.full_name)],
      [o.id_type === "passport" ? "Số hộ chiếu" : "Số CCCD", val(o.id_number)],
      ["Địa chỉ", val(joinAddr(o.address, o.ward, o.province))],
      ["Điện thoại", val(o.phone)],
      ["Email", val(o.email)],
      ...signer,
    ];
  }
  // Chưa xác thực: chỉ có người đồng ý.
  return [["Họ và tên", val(o.full_name ?? o.signatory?.name)], ...signer];
}

function providerRows(p: ServiceProviderParty): Array<[string, string]> {
  return [
    ["Tên pháp nhân", val(p.name)],
    ["Mã số thuế", val(p.tax_code)],
    ["Địa chỉ trụ sở", val(p.address)],
    ["Người đại diện", val([p.representative, p.rep_title].filter(Boolean).join(" — "))],
    ["Email", val(p.email)],
    ["Đơn vị thực hiện", val(p.partner_name)],
    ...(p.expert_name ? ([["Chuyên gia phụ trách", p.expert_name]] as Array<[string, string]>) : []),
  ];
}

function serviceRows(kind: ServiceKindKey, terms: ServiceContractTerms): Array<[string, string]> {
  const extra = terms.extra ?? {};
  const rows: Array<[string, string]> = [
    ["Dịch vụ", val(terms.service_label)],
    ["Gói dịch vụ", val(terms.package_name)],
    ["Mã đơn trên sàn", val(terms.order_code)],
    ["Tài sản", val(terms.posting_title)],
  ];
  if (kind === "giam-dinh" && typeof extra.method === "string") rows.push(["Phương thức", gdMethodLabel(extra.method)]);
  if ((kind === "vr-tour" || kind === "giam-dinh") && typeof extra.site_address === "string" && extra.site_address.trim()) {
    rows.push(["Địa điểm", extra.site_address]);
  }
  return rows;
}

export function buildServiceContractDocDefinition(input: ServiceContractPdfInput): TDocumentDefinitions {
  const { clauses, terms, provider } = input;
  const preview = !input.code;
  const ul = (key: string): Content[] => {
    const items = slotList(clauses, key);
    return items.length ? [{ ul: items }] : [{ text: BLANK }];
  };

  const content: Content[] = [
    {
      columns: [
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: val(provider.name).toUpperCase(), bold: true, fontSize: 9 },
            { text: `Số: ${input.code ?? "(xem trước)"}`, fontSize: 9, margin: [0, 3, 0, 0] },
          ],
        },
        {
          width: "*",
          alignment: "center",
          stack: [
            { text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, fontSize: 9 },
            { text: "Độc lập – Tự do – Hạnh phúc", bold: true, fontSize: 9, decoration: "underline", margin: [0, 2, 0, 0] },
          ],
        },
      ],
    },
    { text: "HỢP ĐỒNG CUNG ỨNG DỊCH VỤ", bold: true, fontSize: 14, alignment: "center", margin: [0, 22, 0, 2] },
    { text: terms.service_label.toUpperCase(), bold: true, fontSize: 11, alignment: "center" },
    {
      text: `(Mẫu ${input.templateVersion} · giao kết điện tử trên sàn Tài Sản Đấu Giá)`,
      fontSize: 8,
      color: t.muted,
      alignment: "center",
      margin: [0, 2, 0, 12],
    },
    { stack: slotList(clauses, "legal_bases").map((b): Content => ({ text: b, italics: true, margin: [0, 0, 0, 2] })) },
    { text: "Các bên gồm:", margin: [0, 10, 0, 6] },

    { text: "BÊN A — BÊN SỬ DỤNG DỊCH VỤ", bold: true, margin: [0, 6, 0, 3] },
    labelRows(ownerRows(input.owner)),
    { text: "BÊN B — BÊN CUNG ỨNG DỊCH VỤ", bold: true, margin: [0, 8, 0, 3] },
    labelRows(providerRows(provider)),

    article(1, "Dịch vụ và tài sản", [labelRows(serviceRows(input.kind, terms))]),
    article(2, "Phạm vi dịch vụ và kết quả bàn giao", [
      ...ul("scope"),
      { text: [{ text: "Kết quả bàn giao: ", bold: true }, slotText(clauses, "deliverables", BLANK)], margin: [0, 4, 0, 0] },
    ]),
    article(3, "Phí dịch vụ và thanh toán", [
      labelRows([
        ["Phí dịch vụ", formatVnd(terms.price)],
        ["Báo giá lập lúc", fmtDateTime(terms.quoted_at)],
        ["Báo giá hiệu lực đến", fmtDateTime(terms.quote_expires_at)],
        ...(terms.quote_note ? ([["Ghi chú báo giá", terms.quote_note]] as Array<[string, string]>) : []),
      ]),
      { text: slotText(clauses, "payment_terms", BLANK), margin: [0, 4, 0, 0] },
    ]),
    article(4, "Quyền và nghĩa vụ của Bên A", ul("owner_duties")),
    article(5, "Quyền và nghĩa vụ của Bên B", ul("provider_duties")),
    article(6, "Giới hạn trách nhiệm", ul("disclaimer")),
    article(7, "Chấm dứt hợp đồng và giải quyết tranh chấp", ul("termination")),
    article(8, "Giao kết điện tử và hiệu lực", [
      { text: slotText(clauses, "electronic_acceptance", BLANK), margin: [0, 0, 0, 4] },
      ...ul("effect"),
    ]),

    {
      unbreakable: true,
      margin: [0, 22, 0, 0],
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: "XÁC NHẬN GIAO KẾT ĐIỆN TỬ", bold: true, margin: [0, 0, 0, 4] },
                preview
                  ? { text: "Bản xem trước — hợp đồng chỉ được giao kết khi Bên A bấm đồng ý trên sàn.", italics: true }
                  : labelRows([
                      ["Mã hợp đồng", val(input.code)],
                      ["Bên A đồng ý lúc", fmtDateTime(input.acceptedAt)],
                      ["Người đồng ý", val(input.acceptedByName)],
                      ["Mã kiểm tra (SHA-256)", val(input.contentHash)],
                    ]),
              ],
              margin: [6, 6, 6, 6],
            },
          ],
        ],
      },
      layout: { hLineColor: () => t.line, vLineColor: () => t.line },
    },
  ];

  return {
    pageSize: "A4",
    pageMargins: [SIDE_MARGIN, MARGIN, SIDE_MARGIN, 52],
    ...(preview ? { watermark: { text: "XEM TRƯỚC", color: t.line, opacity: 0.3, bold: true } } : {}),
    defaultStyle: { font: "Roboto", fontSize: 10, color: t.ink, lineHeight: 1.35 },
    info: { title: `Hợp đồng dịch vụ ${terms.service_label} — ${terms.order_code}`, author: provider.name ?? undefined },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [SIDE_MARGIN, 14, SIDE_MARGIN, 0],
      columns: [
        {
          text: `${input.code ?? "Xem trước"} · ${input.templateVersion} · Tạo ngày ${fmtDate(input.generatedAt.toISOString())}`,
          fontSize: 7,
          color: t.muted,
        },
        { text: `Trang ${currentPage}/${pageCount}`, width: "auto", fontSize: 7, color: t.muted, alignment: "right" },
      ],
    }),
  };
}
