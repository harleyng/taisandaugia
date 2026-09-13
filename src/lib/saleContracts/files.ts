// Tệp hợp đồng mua bán (bucket PRIVATE `auction-sale-contracts`).
//
// Path BẮT BUỘC {organization_id}/{contract_id}/{kind}-{epoch}-{tên}: policy
// storage và `sale_contract_file_check` đều tách hai đoạn đầu để tìm hợp đồng
// rồi kiểm quyền. Lưu PATH vào DB, mở bằng createSignedUrl — getPublicUrl luôn
// 400 với bucket private.
//
// ⚠️ Dự thảo PDF in CCCD/địa chỉ của CẢ HAI bên (khác biên bản đấu giá công
// khai). Không bao giờ đưa tệp bucket này ra đường dẫn công khai.

export const SALE_BUCKET = "auction-sale-contracts";
export const MAX_SALE_FILE_BYTES = 10 * 1024 * 1024;
export const SALE_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const SALE_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png";

/** `receipt` = chứng từ thu tiền, `title` = giấy tờ sang tên. */
export type SaleFileKind = "draft" | "signed" | "receipt" | "handover" | "title";

export const SALE_FILE_KINDS: SaleFileKind[] = ["draft", "signed", "receipt", "handover", "title"];

/** Câu lỗi tiếng Việt, hoặc null khi tệp hợp lệ. */
export function validateSaleFile(file: Pick<File, "type" | "size">): string | null {
  if (!SALE_FILE_TYPES.includes(file.type)) return "Chỉ nhận tệp PDF, JPG hoặc PNG.";
  if (file.size > MAX_SALE_FILE_BYTES) return "Tệp vượt quá 10MB.";
  return null;
}

/**
 * Tên tệp an toàn cho regex phía server: `^[A-Za-z0-9._-]+$` sau tiền tố.
 * Bỏ dấu tiếng Việt thay vì thay bằng `_` để tên còn đọc được.
 */
export function saleSafeName(fileName: string): string {
  const noDiacritics = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  const cleaned = noDiacritics
    .replace(/[^\w.-]+/g, "_")
    .slice(-80)
    // Tên chỉ toàn ký tự lạ sẽ rút về "_" — vô nghĩa với người đọc, dùng tên thay thế.
    .replace(/^_+|_+$/g, "");
  return cleaned || "tep";
}

export function saleObjectPath(
  organizationId: string,
  contractId: string,
  kind: SaleFileKind,
  fileName: string,
  now: number = Date.now(),
): string {
  return `${organizationId}/${contractId}/${kind}-${now}-${saleSafeName(fileName)}`;
}

/** Tên hiển thị: bỏ tiền tố `{kind}-{epoch}-` mà server dùng để phân loại. */
export function saleFileName(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/^(draft|signed|receipt|handover|title)-\d+-/, "");
}

export function saleFileKindOf(path: string): SaleFileKind | null {
  const last = path.split("/").pop() ?? "";
  const m = /^(draft|signed|receipt|handover|title)-\d+-/.exec(last);
  return m ? (m[1] as SaleFileKind) : null;
}

// ─── Đường dẫn trang ────────────────────────────────────────────────────────

/** Trang hợp đồng của BÊN MUA (và của bên bán khi mở từ cổng chủ tài sản). */
export const saleContractPath = (id: string): string => `/hop-dong-mua-ban/${id}`;
/** Trang hợp đồng phía TỔ CHỨC. */
export const portalSaleContractPath = (id: string): string => `/portal/hop-dong-mua-ban/${id}`;
export const PORTAL_SALE_CONTRACTS_PATH = "/portal/hop-dong-mua-ban";
/** Danh sách hợp đồng trong cổng CHỦ TÀI SẢN. */
export const OWNER_SALE_CONTRACTS_PATH = "/chu-tai-san/hop-dong-mua-ban";
export const ownerSaleContractPath = (id: string): string =>
  `${OWNER_SALE_CONTRACTS_PATH}/${id}`;
