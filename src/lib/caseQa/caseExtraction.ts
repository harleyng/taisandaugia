import { formatVnd } from "@/lib/advertising/slug";
import { seededInt, seededPick } from "@/lib/seededRand";
import type { CaseTopic, UploadableDocType } from "@/types/case-qa";
import { formatVnDateTime } from "./formatVn";
import { EXTRACTION_TEMPLATES, MOCK_ENGINE_LABEL, type TemplateCtx } from "./mockCaseExtraction";
import { countPlaceholders, placeholder } from "./placeholders";

/**
 * "Trích xuất điều khoản từ tệp tài liệu phiên" — bản GIẢ LẬP.
 *
 * KHÔNG đọc tệp PDF. Engine dựng điều khoản theo khuôn từng loại tài liệu, điền
 * bằng dữ liệu THẬT của phiên (lịch, địa điểm, tiền đặt trước, bước giá…). Giá trị
 * phiên không có thì để `[[CẦN NHẬP: …]]` — không bao giờ bịa. Mọi điều khoản ra
 * đây là NHÁP; chuyên viên đối chiếu với tệp gốc rồi mới xác nhận.
 *
 * Seam đổi sang OCR/LLM thật nằm ở hook useCaseDocumentExtraction, không ở đây.
 */

export const EXTRACTION_ENGINE = "mock-v1";
const BODY_MAX = 4000;

export interface ExtractionLot {
  lot_no: number;
  title: string;
  starting_price: number | null;
  deposit_amount: number | null;
  bid_step: number | null;
}

export interface ExtractionSession {
  code: string;
  title: string;
  venue: string | null;
  province: string | null;
  /** Nhãn hình thức đấu giá đã dịch sẵn (AUCTION_FORMAT_LABELS) — lib không import bảng nhãn UI. */
  formatLabel: string | null;
  registration_start_at: string | null;
  registration_end_at: string | null;
  viewing_start_at: string | null;
  viewing_end_at: string | null;
  starts_at: string | null;
  dossier_fee: number | null;
}

export interface CaseExtractionInput {
  documentId: string;
  docType: UploadableDocType;
  session: ExtractionSession;
  orgName: string | null;
  lots: readonly ExtractionLot[];
}

export interface ExtractedClause {
  clause_ref: string;
  heading: string;
  body: string;
  topics: CaseTopic[];
  sort_order: number;
}

export interface CaseExtractionResult {
  clauses: ExtractedClause[];
  /** Dữ liệu phiên còn thiếu — hiện cho chuyên viên trước khi duyệt. */
  warnings: string[];
  placeholderCount: number;
  engine: string;
  engineLabel: string;
}

export function extractCaseDocument(input: CaseExtractionInput): CaseExtractionResult {
  const warnings: string[] = [];
  const lots = [...input.lots].sort((a, b) => a.lot_no - b.lot_no);

  const ctx: TemplateCtx = {
    session: input.session,
    lots,
    orgName: input.orgName,
    missing: (label) => {
      const msg = `Phiên chưa khai ${label} — hãy điền trước khi xác nhận.`;
      if (!warnings.includes(msg)) warnings.push(msg);
      return placeholder(label);
    },
    fill: (label) => placeholder(label),
    money: (value, label) => (value != null && Number(value) > 0 ? formatVnd(value) : ctx.missing(label)),
    time: (iso, label) => (iso ? formatVnDateTime(iso) : ctx.missing(label)),
    lotLines: (line) => (lots.length ? lots.map(line).join("\n") : ctx.missing("danh sách tài sản trong phiên")),
  };

  const tpl = EXTRACTION_TEMPLATES[input.docType];
  const firstNo = tpl.refStart ? seededInt(input.documentId, "ref-start", tpl.refStart[0], tpl.refStart[1]) : 1;

  const clauses = tpl.clauses.map((c, i): ExtractedClause => {
    const variant = seededPick(c.variants, input.documentId, `variant:${i}`) ?? c.variants[0];
    return {
      clause_ref: `${tpl.refPrefix} ${firstNo + i}`,
      heading: c.heading,
      body: variant(ctx).slice(0, BODY_MAX),
      topics: [...c.topics],
      sort_order: (i + 1) * 10,
    };
  });

  return {
    clauses,
    warnings,
    placeholderCount: clauses.reduce((sum, c) => sum + countPlaceholders(c.body), 0),
    engine: EXTRACTION_ENGINE,
    engineLabel: MOCK_ENGINE_LABEL,
  };
}
