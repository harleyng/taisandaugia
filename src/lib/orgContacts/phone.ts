// Bản sao client của cột generated org_contacts.phone_digits
// (supabase/migrations/20260912000010_org_contacts.sql). Chỉ dùng để báo trùng
// SĐT ở bước xem trước import — ranh giới thật là unique index uq_org_contacts_phone.
// Sửa một bên thì sửa cả bên kia.

/** Chỉ giữ chữ số; "+84 912 345 678" → "0912345678". Rỗng → null. */
export function phoneDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^84(\d{9,10})$/, "0$1");
  return digits === "" ? null : digits;
}

/** SĐT Việt Nam hợp lệ để nhắn/gọi: 10–11 chữ số bắt đầu bằng 0 (sau chuẩn hoá). */
export function isVietnamPhone(phone: string | null | undefined): boolean {
  const d = phoneDigits(phone);
  return !!d && /^0\d{9,10}$/.test(d);
}
