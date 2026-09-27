// Luật dựng bản in "Hồ sơ số hoá tài sản" (thiết kế "Ho So So Hoa - PDF", project 979d4c55).
// Thuần — trang in /chu-tai-san/dang-tai-san/:id/in chỉ việc hiển thị.
//
// Cố ý KHÔNG in: giá bảo lưu của phương án tư vấn (riêng tư) và ghi chú nội bộ của admin.

import { format } from "date-fns";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { renderDeltaValue } from "@/components/asset-posting/format";
import type { DigitizeStage } from "@/lib/asset-posting/digitizeStatus";
import type { AssetPosting } from "@/types/asset-posting";

export type PrintTone = "ok" | "me" | "err" | "mu";

/** Ảnh tối thiểu một hồ sơ nên có — thiếu thì in ô "Thiếu N ảnh". */
export const MIN_PHOTOS = 5;

/** Lưới ảnh mục 04: ≥9 ảnh in 9, ≥5 in 5, ít hơn in hết + ô thiếu; ảnh đầu to khi in từ 5 ảnh. */
export function galleryLayout(photoCount: number): { shown: number; miss: number; big: boolean } {
  const shown = photoCount >= 9 ? 9 : photoCount >= MIN_PHOTOS ? MIN_PHOTOS : photoCount;
  return { shown, miss: Math.max(0, MIN_PHOTOS - photoCount), big: shown >= MIN_PHOTOS };
}

/** Mã xác thực tài liệu: mã hồ sơ · 4 ký tự đầu id · ngày tạo (ddMMyyyy). */
export function verificationCode(p: Pick<AssetPosting, "id" | "code" | "created_at">): string {
  const tag = p.id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `${p.code}-${tag}-${format(new Date(p.created_at), "ddMMyyyy")}`;
}

/** Hồ sơ trước khi sàn duyệt: in dải cảnh báo + câu "chưa được sàn xác minh". */
export const isPreApproval = (stage: DigitizeStage) => stage === "draft" || stage === "review" || stage === "rejected";

export type PrintBand = { tone: "draft" | "err"; title: string; text: string } | null;

export function statusBand(stage: DigitizeStage, completionPct: number, rejectionReason: string | null): PrintBand {
  if (stage === "rejected") {
    return { tone: "err", title: "Sàn yêu cầu chỉnh sửa", text: rejectionReason?.trim() || "Vui lòng xem lý do trên hệ thống." };
  }
  if (stage === "draft" || stage === "review") {
    return {
      tone: "draft",
      title: stage === "draft" ? `Bản nháp · hoàn thiện ${completionPct}%` : "Đang chờ sàn duyệt",
      text: "Thông tin chưa được sàn xác minh — chỉ dùng tham khảo nội bộ.",
    };
  }
  return null;
}

/** Nháp chưa qua bước "Nhu cầu đấu giá" ⇒ ô trống thay cho dải 4 con số. */
export const auctionNeedsDeclared = (p: AssetPosting) =>
  p.status !== "draft" || p.starting_price != null || p.commission_pct != null || p.expected_timeline != null;

/** Đã khai gì ở phần pháp lý chưa (nháp mới tạo thì chưa). */
export const legalDeclared = (p: AssetPosting) =>
  p.status !== "draft" ||
  p.right_to_sell ||
  p.has_dispute != null ||
  p.has_mortgage != null ||
  p.is_seized != null ||
  !!p.ownership_declaration ||
  (p.ownership_proof_urls?.length ?? 0) > 0 ||
  (p.doc_urls?.length ?? 0) > 0;

/** 4 ô tự khai. "Có" ở câu vướng (tranh chấp / thế chấp / kê biên) là tone err. */
export function declarationRows(p: AssetPosting): { k: string; v: string; tone: PrintTone }[] {
  const flag = (b: boolean | null) =>
    b === null ? { v: "Chưa trả lời", tone: "mu" as const } : b ? { v: "Có", tone: "err" as const } : { v: "Không", tone: "ok" as const };
  return [
    { k: "Quyền được bán", ...(p.right_to_sell ? { v: "Có", tone: "ok" as const } : { v: "Chưa xác nhận", tone: "mu" as const }) },
    { k: "Đang tranh chấp", ...flag(p.has_dispute) },
    { k: "Đang thế chấp", ...flag(p.has_mortgage) },
    { k: "Bị kê biên", ...flag(p.is_seized) },
  ];
}

export interface PrintDoc {
  path: string;
  name: string;
  ext: string;
  kind: string;
}

const extOf = (path: string) => (path.includes(".") ? path.split(".").pop()!.toUpperCase().slice(0, 4) : "TỆP");

/** Giấy tờ đính kèm. Tên gốc không được lưu (đường dẫn là uuid) ⇒ đặt tên theo loại + thứ tự. */
export function postingDocs(p: AssetPosting): PrintDoc[] {
  return [
    ...(p.ownership_proof_urls ?? []).map((path, i) => ({
      path,
      name: `Giấy tờ sở hữu ${i + 1}`,
      ext: extOf(path),
      kind: "Giấy tờ sở hữu",
    })),
    ...(p.doc_urls ?? []).map((path, i) => ({
      path,
      name: `Tài liệu bổ sung ${i + 1}`,
      ext: extOf(path),
      kind: "Giấy tờ khác",
    })),
  ];
}

/** "2,4 MB" / "860 KB" — dấu phẩy thập phân như thiết kế. */
export function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

/** Thông số đã khai (bỏ ô trống) — không còn ô nào thì in thẻ trống. */
export function specRows(p: AssetPosting): { k: string; v: string }[] {
  return getDeltaFields(p.child_slug)
    .map((d) => ({ k: d.label, v: renderDeltaValue(d, p.delta_fields?.[d.key]) }))
    .filter((r) => r.v !== "—");
}

export const commissionLabel = (pct: number | null) =>
  pct == null ? "—" : `≤ ${pct.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;

export const printDay = (iso: string | null | undefined) => (iso ? format(new Date(iso), "dd/MM/yyyy") : "—");
export const printDayTime = (iso: string | null | undefined) => (iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy") : "—");
