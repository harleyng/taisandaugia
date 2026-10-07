// Đọc chuỗi mã QR in ở mặt trước CCCD gắn chip / thẻ Căn cước (2024).
//
// Định dạng (phân tách bằng "|"):
//   số CCCD | số CMND cũ | Họ tên | ngày sinh ddmmyyyy | Giới tính | Nơi thường trú | ngày cấp ddmmyyyy
//
// Biến thể gặp ngoài thực tế:
//   - Người chưa từng có CMND: trường CMND RỖNG ("…||Họ tên…") hoặc BỊ BỎ HẲN (6 trường).
//   - Thẻ mới có thể có trường thừa phía sau ⇒ bỏ qua.
//   - Một số trình đọc trả kèm khoảng trắng / xuống dòng / dấu "|" thừa ở cuối.
//
// Trả null khi chuỗi không phải QR CCCD (QR khác, ảnh mờ đọc sai…) — nơi gọi lùi
// về OCR / gõ tay. Giá trị đọc được chỉ để ĐIỀN SẴN; người dùng vẫn sửa được.

import type { Gender } from "@/types/bidding-contract";

export interface CccdQrData {
  id_number: string;
  /** Số CMND 9 số cũ — null nếu thẻ không có. */
  old_id_number: string | null;
  full_name: string;
  /** ISO yyyy-mm-dd. */
  date_of_birth: string | null;
  gender: Gender | null;
  address: string;
  /** ISO yyyy-mm-dd. */
  id_issued_on: string | null;
}

const collapse = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();

/** ddmmyyyy → yyyy-mm-dd; null nếu không phải ngày có thật. */
export function parseQrDate(raw: string): string | null {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (d.getUTCFullYear() !== Number(yyyy) || d.getUTCMonth() !== Number(mm) - 1 || d.getUTCDate() !== Number(dd)) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function parseGender(raw: string): Gender | null {
  const g = collapse(raw).toLowerCase();
  if (g === "nam" || g === "male") return "male";
  if (g === "nữ" || g === "nu" || g === "female") return "female";
  return null;
}

export function parseCccdQr(raw: string | null | undefined): CccdQrData | null {
  if (!raw) return null;
  const parts = raw.replace(/[\r\n]+/g, "").split("|").map((p) => p.trim());
  while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();

  const idNumber = parts[0] ?? "";
  if (!/^[0-9]{12}$/.test(idNumber)) return null;

  // CMND bị bỏ hẳn ⇒ trường thứ 2 đã là họ tên (không phải số) — chèn chỗ trống.
  const fields = parts.length >= 2 && !/^[0-9]*$/.test(parts[1]) ? [idNumber, "", ...parts.slice(1)] : parts;
  if (fields.length < 6) return null;

  const [, oldId, name, dob, gender, address, issued] = fields;
  const fullName = collapse(name);
  if (fullName.length < 3 || /\d/.test(fullName)) return null;

  return {
    id_number: idNumber,
    old_id_number: /^[0-9]{9}$/.test(oldId) ? oldId : null,
    full_name: fullName,
    date_of_birth: parseQrDate(dob),
    gender: parseGender(gender),
    address: collapse(address),
    id_issued_on: issued ? parseQrDate(issued) : null,
  };
}
