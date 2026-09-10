// Hợp đồng hợp tác giữa sàn và đối tác (migration 20260907000001).
//
// Vì sao hợp đồng là bảng riêng chứ không phải thêm cột vào `suppliers` hay
// `service_variants`: một đối tác hợp tác qua NHIỀU dịch vụ cùng lúc (mỗi dịch
// vụ một mức hoa hồng), và mức đó THAY ĐỔI THEO THỜI GIAN khi tái ký. Cột đơn
// lẻ không chứa được chiều thứ nhất; `service_variants` không có thời hạn nên
// mất chiều thứ hai.
//
// ⚠️ Hợp đồng KHÔNG thay thế quy tắc "đơn tự mang điều khoản của nó":
// `orders.commission_type/value` vẫn là ẢNH CHỤP lúc chốt. Hợp đồng là nguồn
// điền sẵn CÓ THẨM QUYỀN + dấu vết truy nguyên (`orders.contract_id`).

import type { CommissionType } from "@/types/orders";

/** Trạng thái LƯU trong DB. */
export type ContractStatus = "draft" | "active" | "terminated";

/**
 * Trạng thái HIỂN THỊ — suy ra từ status + effective_to, KHÔNG lưu.
 * Lưu "hết hạn" thành cờ thì phải nuôi một cron để lật, và cờ sẽ lệch ngay lần
 * quên đầu tiên.
 */
export type ContractDisplayStatus = ContractStatus | "expiring" | "expired";

export interface SupplierContract {
  id: string;
  code: string | null;
  supplier_id: string;
  contract_no: string;
  title: string | null;
  signed_date: string;
  effective_from: string;
  effective_to: string | null;
  signer_name: string | null;
  signer_title: string | null;
  our_signer_name: string | null;
  doc_path: string | null;
  status: ContractStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Nạp kèm khi đọc chi tiết. */
  lines?: SupplierContractLine[];
}

export interface SupplierContractLine {
  id: string;
  contract_id: string;
  service_id: string;
  /** NULL = áp cho MỌI biến thể của dịch vụ. */
  service_variant_id: string | null;
  commission_type: CommissionType;
  commission_value: number;
  note: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  service?: { id: string; name: string; kind: string } | null;
  variant?: { id: string; name: string } | null;
}

export interface SupplierContractUpsert {
  id?: string;
  supplier_id: string;
  contract_no: string;
  title?: string | null;
  signed_date: string;
  effective_from: string;
  effective_to?: string | null;
  signer_name?: string | null;
  signer_title?: string | null;
  our_signer_name?: string | null;
  doc_path?: string | null;
  status: ContractStatus;
  note?: string | null;
}

export interface SupplierContractLineUpsert {
  id?: string;
  contract_id: string;
  service_id: string;
  service_variant_id?: string | null;
  commission_type: CommissionType;
  commission_value: number;
  note?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

/** Kết quả `admin_resolve_contract_terms` — điều khoản đang hiệu lực. */
export interface ResolvedContractTerms {
  contract_id: string;
  line_id: string;
  code: string | null;
  contract_no: string;
  commission_type: CommissionType;
  commission_value: number;
  effective_to: string | null;
}
