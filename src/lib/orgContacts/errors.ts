// Dịch lỗi Postgres/PostgREST của danh bạ khách hàng sang câu tiếng Việt.
// Tên ràng buộc lấy từ supabase/migrations/20260912000010_org_contacts.sql.

const RULES: [string, string][] = [
  ["uq_org_contacts_phone", "Số điện thoại này đã có trong danh bạ."],
  ["uq_org_contacts_email", "Email này đã có trong danh bạ."],
  ["uq_org_contact_groups_name", "Đã có nhóm cùng tên."],
  ["org_contacts_reachable", "Cần ít nhất số điện thoại, email hoặc Zalo."],
  ["org_contacts_full_name_check", "Họ tên cần ít nhất 2 ký tự."],
  ["org_contact_groups_name_check", "Tên nhóm cần ít nhất 2 ký tự."],
  ["org_contact_interests_has_dimension", "Nhu cầu cần ít nhất một tiêu chí."],
  ["org_contact_interests_price_order", "Giá từ phải nhỏ hơn hoặc bằng giá đến."],
];

export function orgContactErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const msg = e?.message ?? "";
  const hit = RULES.find(([needle]) => msg.includes(needle));
  if (hit) return hit[1];
  // PGRST116 = update/select .single() không trả dòng nào — RLS lọc mất.
  if (e?.code === "42501" || e?.code === "PGRST116" || msg.includes("row-level security")) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }
  if (e?.code === "23503") return "Dữ liệu liên quan không còn tồn tại hoặc thuộc tổ chức khác.";
  // RAISE EXCEPTION trong RPC đã viết sẵn tiếng Việt → trả nguyên văn.
  if (/[À-ỹ]/.test(msg)) return msg;
  return "Thao tác thất bại, vui lòng thử lại.";
}
