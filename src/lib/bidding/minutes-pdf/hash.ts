// SHA-256 của tệp biên bản, dạng hex thường.
//
// auction_session_minutes.content_hash có CHECK '^[0-9a-f]{64}$' và
// org_issue_minutes từ chối `invalid_hash` với mọi thứ khác — nên chữ thường và
// đủ 64 ký tự là HỢP ĐỒNG, không phải sở thích.
//
// Repo chưa có helper băm nào dùng lại được: src/lib/outreach/hash.ts là FNV-1a
// 32 bit và tự ghi rõ "không dùng cho bảo mật". Khi có nơi thứ hai cần SHA-256,
// chuyển file này lên src/lib/pdf/sha256.ts.

export const SHA256_HEX = /^[0-9a-f]{64}$/;

export const isSha256Hex = (value: string): boolean => SHA256_HEX.test(value);

/**
 * crypto.subtle CHỈ tồn tại trong secure context (https hoặc localhost). Mở dev
 * server qua IP LAN là mất — cùng cái bẫy đã ghi cho crypto.randomUUID ở
 * src/components/asset-posting/useStorageUpload.ts. Ném câu tiếng Việt rõ nghĩa
 * thay vì để "Cannot read properties of undefined" nổi lên toast.
 */
export async function sha256Hex(data: Blob | ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Trình duyệt không hỗ trợ tính mã kiểm tra (SHA-256). Hãy mở sàn qua HTTPS.");
  }
  const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
  const digest = await subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
