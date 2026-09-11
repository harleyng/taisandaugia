import type { EngineClause, UploadableDocType } from "@/types/case-qa";
import { extractCaseDocument, type ExtractionLot, type ExtractionSession } from "./caseExtraction";
import { DOC_TYPE_LABELS, UPLOADABLE_DOC_TYPES } from "./labels";
import { PLACEHOLDER_RE } from "./placeholders";

// Dữ liệu dùng chung cho test engine hỏi đáp / trích xuất. Không import từ app.

export const SESSION: ExtractionSession = {
  code: "PDG000123",
  title: "Phiên đấu giá căn hộ thử nghiệm",
  venue: "Hội trường Công ty, 12 Lê Lợi, Quận 1, TP.HCM",
  province: "Hồ Chí Minh",
  formatLabel: "Đấu giá trực tiếp bằng lời nói",
  registration_start_at: "2026-10-01T01:00:00Z",
  registration_end_at: "2026-10-15T10:00:00Z",
  viewing_start_at: "2026-10-05T01:00:00Z",
  viewing_end_at: "2026-10-07T10:00:00Z",
  starts_at: "2026-10-20T02:00:00Z",
  dossier_fee: 500000,
};

export const LOTS: ExtractionLot[] = [
  { lot_no: 1, title: "Căn hộ A12.05", starting_price: 2500000000, deposit_amount: 250000000, bid_step: 50000000 },
  { lot_no: 2, title: "Căn hộ B05.01", starting_price: 1800000000, deposit_amount: 180000000, bid_step: 30000000 },
];

export const fillPlaceholders = (body: string) => body.replace(PLACEHOLDER_RE, "nội dung đã bổ sung");

/** Bộ điều khoản đủ 4 tài liệu, chỗ trống đã điền, tất cả đã xác nhận. */
export function buildFilledCase(
  opts: { lots?: ExtractionLot[]; session?: Partial<ExtractionSession>; types?: readonly UploadableDocType[] } = {},
): EngineClause[] {
  const session = { ...SESSION, ...opts.session };
  return (opts.types ?? UPLOADABLE_DOC_TYPES).flatMap((docType) => {
    const documentId = `doc-${docType}`;
    const { clauses } = extractCaseDocument({ documentId, docType, session, orgName: "Công ty Đấu giá Thử", lots: opts.lots ?? LOTS });
    return clauses.map(
      (c): EngineClause => ({
        clause_id: `${documentId}-${c.sort_order}`,
        document_id: documentId,
        doc_type: docType,
        doc_title: DOC_TYPE_LABELS[docType],
        clause_ref: c.clause_ref,
        heading: c.heading,
        body: fillPlaceholders(c.body),
        topics: c.topics,
        sort_order: c.sort_order,
        citable: true,
      }),
    );
  });
}
