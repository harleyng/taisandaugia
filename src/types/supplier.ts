// Đối tác (bảng `suppliers`) — SỔ ĐĂNG KÝ CÔNG TY duy nhất của back-office.
// Nơi duy nhất nhập tên/liên hệ/MST/ngân hàng/% hoa hồng của một pháp nhân.
//
// Vai trò tách bạch với `partners`:
//   suppliers = công ty (dữ liệu thương mại) — nhãn UI "Đối tác", admin-only
//   partners  = thẻ trình bày trang chủ — nhãn UI "Đối tác trên sàn",
//               tạo bằng cách CHỌN RA một suppliers (partners.supplier_id)
//
// Cột nhạy cảm (bank_account, tax_code, default_commission_*) CHỈ ở đây, và
// bảng này không có public_read — nên không rò ra trang chủ. RLS của Postgres
// lọc theo DÒNG chứ không theo CỘT, nên ranh giới phải là ranh giới BẢNG.

import type { CommissionType } from "@/types/orders";

export type SupplierType = "individual" | "company";
export type SupplierStatus = "active" | "inactive";

export interface Supplier {
  id: string;
  code: string | null;
  name: string;
  supplier_type: SupplierType;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_code: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account: string | null;
  /** Chỉ để form đơn điền sẵn — KHÔNG phải fallback lúc chạy. */
  default_commission_type: CommissionType | null;
  default_commission_rate: number | null;
  note: string | null;
  status: SupplierStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierUpsert {
  id?: string;
  name: string;
  supplier_type: SupplierType;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_code?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  default_commission_type?: CommissionType | null;
  default_commission_rate?: number | null;
  note?: string | null;
  status: SupplierStatus;
}
