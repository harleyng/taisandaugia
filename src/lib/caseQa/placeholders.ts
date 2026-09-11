/**
 * Chỗ trống trích xuất giả lập để lại cho chuyên viên điền: `[[CẦN NHẬP: …]]`.
 *
 * Khớp với CHECK `status <> 'confirmed' OR body !~ '\[\['` trên
 * case_document_clauses — DB từ chối xác nhận điều khoản còn chỗ trống, nên giá
 * trị bịa không bao giờ trích dẫn được. Kiểm ở đây chỉ để tắt nút sớm.
 */

export const PLACEHOLDER_RE = /\[\[[^\]]*\]\]/g;

export const placeholder = (label: string) => `[[CẦN NHẬP: ${label}]]`;

export const hasPlaceholder = (body: string) => body.includes("[[");

export const countPlaceholders = (body: string) => (body.match(PLACEHOLDER_RE) ?? []).length;
