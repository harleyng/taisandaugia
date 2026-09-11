// Tệp hợp đồng ký gửi (bucket PRIVATE `consignment-contracts`).
//
// Path BẮT BUỘC là {organization_id}/{contract_id}/{draft|signed}-{epoch}-{tên}:
// policy storage đọc hai đoạn đầu để tìm hợp đồng và kiểm quyền. Lưu PATH vào
// DB, mở bằng createSignedUrl — getPublicUrl luôn 400 với bucket private.

export const CONTRACT_BUCKET = "consignment-contracts";
export const MAX_CONTRACT_FILE_BYTES = 10 * 1024 * 1024;
export const CONTRACT_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const CONTRACT_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png";

export type ContractFileKind = "draft" | "signed";

/** Câu lỗi tiếng Việt, hoặc null khi tệp hợp lệ. */
export function validateContractFile(file: Pick<File, "type" | "size">): string | null {
  if (!CONTRACT_FILE_TYPES.includes(file.type)) return "Chỉ nhận tệp PDF, JPG hoặc PNG.";
  if (file.size > MAX_CONTRACT_FILE_BYTES) return "Tệp vượt quá 10MB.";
  return null;
}

export function contractFilePath(
  organizationId: string,
  contractId: string,
  kind: ContractFileKind,
  fileName: string,
  now: number = Date.now(),
): string {
  const safeName = fileName.replace(/[^\w.-]+/g, "_").slice(-80) || "tep";
  return `${organizationId}/${contractId}/${kind}-${now}-${safeName}`;
}

export function contractFileName(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/^(draft|signed)-\d+-/, "");
}
