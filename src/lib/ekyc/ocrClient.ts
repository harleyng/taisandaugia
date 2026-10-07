// SEAM đọc chữ (OCR) trên ảnh giấy tờ — dùng khi KHÔNG đọc được mã QR (ảnh mờ,
// hộ chiếu, CCCD đời cũ không có QR).
//
// Hôm nay CHƯA có nhà cung cấp OCR ⇒ luôn trả null và người dùng tự gõ
// (read_method = 'typed'). Bản thật: gọi một Edge Function (FPT.AI / VNPT eKYC…)
// với đường dẫn ảnh trong bucket buyer-kyc — Edge Function tự tải ảnh bằng
// service_role, không gửi tệp từ trình duyệt. Miễn trả về KycValues thì
// readIdentityFromPhotos và IdentityCapture không phải sửa.

import type { KycValues } from "./editedFields";
import type { IdType } from "@/types/bidding-contract";

export interface OcrRequest {
  id_type: IdType;
  front: Blob;
  back?: Blob | null;
}

export async function readIdText(_req: OcrRequest): Promise<KycValues | null> {
  return null;
}
