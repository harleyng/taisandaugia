// Hàm thuần dùng chung cho trang chi tiết & dialog yêu cầu dịch vụ (tách khỏi file component
// để giữ fast refresh).

import { format } from "date-fns";
import { vi } from "date-fns/locale";

export const formatWhen = (iso: string | null) =>
  iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi }) : "—";

export interface QuoteTerms {
  price: number;
  validDays: number;
  note: string;
}

/** Khớp kiểm tra ở RPC admin_quote_*: giá > 0, hiệu lực 1–60 ngày. */
export const isValidQuoteTerms = (t: QuoteTerms) => t.price > 0 && t.validDays >= 1 && t.validDays <= 60;

/** Khớp kiểm tra ở RPC báo giá tư vấn: có đối tác + tên chuyên gia ≥ 2 ký tự. */
export const isValidAssignment = (a: { supplierId: string; expertName: string }) =>
  !!a.supplierId && a.expertName.trim().length >= 2;
