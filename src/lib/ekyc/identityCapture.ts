// Chuyển trạng thái của IdentityCapture (thuần, có test): áp kết quả đọc ảnh vào
// form và theo dõi trường người dùng đã sửa sau khi máy đọc.

import { editedFields, KYC_EDITABLE_FIELDS, type KycField, type KycValues } from "./editedFields";
import type { IdentityCaptureValues } from "./kycProfileForm";
import type { IdentityRead } from "./readIdentityFromPhotos";

export type CaptureField = Exclude<keyof IdentityCaptureValues, "read_method" | "edited_fields">;

const isKycField = (f: string): f is KycField => (KYC_EDITABLE_FIELDS as readonly string[]).includes(f);

/**
 * Ảnh mặt trước mới ⇒ áp kết quả đọc. Đọc được: điền các trường máy đọc ra (trường
 * đọc hỏng giữ giá trị cũ), cách đọc = qr/ocr, xoá cờ "đã sửa". Không đọc được:
 * giữ nguyên các ô, cách đọc = typed (người dùng tự khai).
 */
export function applyRead(value: IdentityCaptureValues, read: IdentityRead | null): IdentityCaptureValues {
  if (!read) return { ...value, read_method: "typed", edited_fields: [] };
  const next: IdentityCaptureValues = { ...value, read_method: read.method, edited_fields: [] };
  for (const f of KYC_EDITABLE_FIELDS) {
    const v = read.values[f];
    if (!v) continue;
    if (f === "gender") next.gender = v === "male" || v === "female" ? v : next.gender;
    else next[f] = v;
  }
  return next;
}

/**
 * Sửa một ô. `decoded` = bản máy vừa đọc trong lượt này (null nếu không có — vd.
 * mở lại danh tính đã lưu): khi đó trường nào bị sửa trên bản đọc bằng máy cũng
 * bị gắn cờ, vì không còn giá trị gốc để so.
 */
export function editField(
  value: IdentityCaptureValues,
  field: CaptureField,
  input: string | null,
  decoded: KycValues | null,
): IdentityCaptureValues {
  const next = { ...value, [field]: input } as IdentityCaptureValues;
  if (!isKycField(field)) return next;
  if (decoded) return { ...next, edited_fields: editedFields(decoded, next) };
  if (value.read_method === "typed" || (value[field] ?? "") === (input ?? "")) return next;
  const flagged = new Set<string>([...value.edited_fields, field]);
  return { ...next, edited_fields: KYC_EDITABLE_FIELDS.filter((f) => flagged.has(f)) };
}
