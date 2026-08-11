// Gói dữ liệu đầu vào của một bản xuất hồ sơ đấu giá viên.
//
// NGUỒN DỮ LIỆU: hồ sơ nhân sự KHÔNG tự tạo dữ liệu. Thông tin người lấy từ
// module Đấu giá viên, cuộc đấu giá lấy từ module Lịch sử đấu giá — cả hai
// đều thuộc Hồ sơ năng lực.
//
// (File này trước tên là `dossier-content.ts` và còn dựng một mô hình nội dung
// I–VIII trung lập định dạng cho bản DOCX. DOCX đã bỏ, renderer PDF tự dựng
// lấy, nên mô hình đó nằm chết và mô tả một bộ mục KHÁC bản đang ship — đã xoá
// để không ai sửa nhầm vào chỗ không chạy. Danh mục mẫu/mục nay ở
// `dossier-templates.ts`.)

import type { Auctioneer } from '@/types/auctioneer'
import type { CpdExemption, DossierEvent, PersonnelDocument } from '@/types/personnel'
import type { CpdCatalog } from '@/types/cpd-catalog'
import type { ConductedAuction } from './auction-source'

export interface DossierBundle {
  person: Auctioneer
  documents: PersonnelDocument[]
  events: DossierEvent[]
  /**
   * Cuộc đấu giá đã điều hành — TRUYỀN VÀO, không tự lấy. Nguồn là Supabase
   * (org_auction_records) nên phải fetch bất đồng bộ trước khi dựng file.
   */
  auctions: ConductedAuction[]
  /** Diện miễn bồi dưỡng (Điều 26.3) — thiếu thì mục tuân thủ kết luận sai. */
  cpdExemptions?: CpdExemption[]
  /**
   * Danh mục bồi dưỡng — TRUYỀN VÀO, không tự fetch. Thiếu danh mục thì bảng
   * bồi dưỡng mất tên hình thức và phần tuân thủ chấm mọi người thành "chưa đủ
   * giờ" — sai ngay trên sản phẩm có tính phí.
   */
  cpdCatalog?: CpdCatalog
}

export function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9À-ỹ\s]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'HoSo'
}
