// Tải một tệp giấy tờ lên bucket PRIVATE `buyer-kyc` tại {user_id}/{uuid}.{ext}.
//
// KHÔNG BAO GIỜ ghi đè: mỗi lần tải là một tên mới, vì hồ sơ tham gia là bản
// chụp — ảnh một hồ sơ đã nộp phải giữ nguyên dù người mua đổi ảnh ở chỗ khác.
// Policy buyer_kyc_insert_own chỉ cho ghi vào thư mục của chính mình.

import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import { kycAcceptAttr, kycExtOf, kycFileError, type KycFileKind } from "./kycFile";

export const BUYER_KYC_BUCKET = "buyer-kyc";

/** `accept` cho ô ảnh giấy tờ tuỳ thân (JPG/PNG). */
export const KYC_IMAGE_ACCEPT = kycAcceptAttr("image");
/** `accept` cho ĐKKD / giấy uỷ quyền (JPG/PNG/PDF). */
export const KYC_DOCUMENT_ACCEPT = kycAcceptAttr("document");

/** Ảnh lớn hơn ngưỡng này mới nén. Giữ cạnh dài đủ lớn để mã QR trên CCCD còn đọc được. */
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024;

async function compressIfLarge(file: File): Promise<File> {
  if (file.type === "application/pdf" || file.size <= COMPRESS_ABOVE_BYTES) return file;
  try {
    return await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true });
  } catch {
    // Nén hỏng thì gửi bản gốc — giới hạn 10 MB đã kiểm trước.
    return file;
  }
}

/** Trả về đường dẫn trong bucket. Ném Error với câu tiếng Việt khi tệp không hợp lệ. */
export async function uploadKycImage(userId: string, file: File, kind: KycFileKind = "image"): Promise<string> {
  const invalid = kycFileError(file, kind);
  if (invalid) throw new Error(invalid);

  const body = await compressIfLarge(file);
  const path = `${userId}/${crypto.randomUUID()}.${kycExtOf(file.type)}`;
  const { error } = await supabase.storage
    .from(BUYER_KYC_BUCKET)
    .upload(path, body, { contentType: file.type, upsert: false });
  if (error) throw new Error("Tải tệp lên không thành công. Vui lòng thử lại.");
  return path;
}

/**
 * Xoá tệp không còn dùng (cố gắng). Policy buyer_kyc_delete_own bỏ qua — không
 * xoá — tệp còn được danh tính hoặc hồ sơ tham gia nào tham chiếu.
 */
export async function discardKycFiles(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  try {
    await supabase.storage.from(BUYER_KYC_BUCKET).remove(list);
  } catch {
    // Tệp mồ côi không ảnh hưởng dữ liệu.
  }
}

/** Một tệp — tiện cho ô tải vừa thay ảnh chưa nộp. */
export const discardKycUpload = (path: string) => discardKycFiles([path]);
