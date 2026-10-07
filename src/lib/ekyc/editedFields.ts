// Trường nào người dùng đã SỬA so với giá trị đọc từ QR / OCR — tổ chức soi kỹ
// các trường này khi duyệt hồ sơ.
//
// Danh sách trường TRÙNG với _kyc_edited_fields
// (supabase/migrations/20261008100000_buyer_kyc_profile.sql) — server lọc im lặng
// mọi tên khác. Sửa một bên phải sửa cả bên kia.

export const KYC_EDITABLE_FIELDS = [
  "full_name",
  "id_number",
  "date_of_birth",
  "gender",
  "address",
  "id_issued_on",
] as const;

export type KycField = (typeof KYC_EDITABLE_FIELDS)[number];

/** qr = đọc mã QR mặt trước; ocr = đọc chữ; typed = người dùng tự gõ. */
export type ReadMethod = "qr" | "ocr" | "typed";

export type KycValues = Partial<Record<KycField, string | null | undefined>>;

/**
 * So sánh "cùng nghĩa": bỏ khoảng trắng thừa, chuẩn Unicode NFC, không phân biệt
 * hoa thường (server khớp họ tên bằng lower()). Số giấy tờ bỏ mọi khoảng trắng.
 */
function canon(field: KycField, v: string | null | undefined): string {
  const s = (v ?? "").normalize("NFC").trim();
  if (field === "id_number") return s.replace(/\s/g, "").toUpperCase();
  return s.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Trường đã đọc được (khác rỗng) mà giá trị cuối khác đi. Trường máy KHÔNG đọc
 * được thì người dùng tự điền ⇒ không tính là "đã sửa". Thứ tự theo
 * KYC_EDITABLE_FIELDS để kết quả ổn định.
 */
export function editedFields(decoded: KycValues | null | undefined, final: KycValues): KycField[] {
  if (!decoded) return [];
  return KYC_EDITABLE_FIELDS.filter((f) => {
    const read = canon(f, decoded[f]);
    return read !== "" && read !== canon(f, final[f]);
  });
}
