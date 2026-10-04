import { AssetDocUpload } from "../../AssetDocUpload";
import type { DossierKind } from "@/lib/dossier/types";

export const DOSSIER_EVIDENCE_BUCKET = "posting-dossier-evidence";

interface DossierEvidenceUploadProps {
  kind: DossierKind;
  /** Đường dẫn trong bucket (`{posting_id}/{kind}/…`). */
  value: string[];
  onChange: (paths: string[]) => void;
  /** Id hồ sơ nếu đã có. */
  postingId: string | null;
  /** Wizard: tự lưu nháp để có id trước khi tải. Mặc định dùng `postingId`. */
  resolvePostingId?: () => Promise<string | null>;
  disabled?: boolean;
}

/**
 * Tệp chứng cứ của một phần dịch vụ — tải NGAY khi chọn (bucket riêng tư
 * posting-dossier-evidence, policy theo quyền sửa hồ sơ). Bỏ tệp chỉ gỡ khỏi danh
 * sách, không xoá đối tượng trong storage.
 */
export function DossierEvidenceUpload({
  kind,
  value,
  onChange,
  postingId,
  resolvePostingId,
  disabled,
}: DossierEvidenceUploadProps) {
  return (
    <AssetDocUpload
      value={value}
      onChange={onChange}
      prefix={kind}
      bucket={DOSSIER_EVIDENCE_BUCKET}
      accept="application/pdf,image/jpeg,image/png"
      hint="PDF, JPG, PNG — tối đa 10MB mỗi tệp. Chỉ bạn và sàn xem được."
      resolveRoot={resolvePostingId ?? (async () => postingId)}
      disabled={disabled}
    />
  );
}
