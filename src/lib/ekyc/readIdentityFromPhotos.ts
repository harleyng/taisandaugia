// Ảnh giấy tờ ⇒ giá trị điền sẵn cho form danh tính.
//
// Thứ tự: mã QR mặt trước CCCD (thật, miễn phí) ⇒ OCR (seam, hôm nay null) ⇒
// null = người dùng tự gõ. Kết quả chỉ để ĐIỀN SẴN — mọi trường vẫn sửa được và
// trường bị sửa được ghi lại (editedFields) cho tổ chức soi khi duyệt.

import type { IdType } from "@/types/bidding-contract";
import { parseCccdQr } from "./cccdQr";
import { decodeQrFromImage } from "./decodeQrFromImage";
import type { KycValues, ReadMethod } from "./editedFields";
import { readIdText } from "./ocrClient";

export interface IdentityRead {
  method: Exclude<ReadMethod, "typed">;
  values: KycValues;
}

export async function readIdentityFromPhotos(req: {
  id_type: IdType;
  front: Blob;
  back?: Blob | null;
}): Promise<IdentityRead | null> {
  if (req.id_type === "cccd") {
    const qr = parseCccdQr(await decodeQrFromImage(req.front));
    if (qr) {
      return {
        method: "qr",
        values: {
          full_name: qr.full_name,
          id_number: qr.id_number,
          date_of_birth: qr.date_of_birth,
          gender: qr.gender,
          address: qr.address,
          id_issued_on: qr.id_issued_on,
        },
      };
    }
  }

  const ocr = await readIdText(req);
  return ocr ? { method: "ocr", values: ocr } : null;
}
