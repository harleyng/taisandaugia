// Bản mô tả ngắn gửi vào hộp thư tổ chức đấu giá — văn xuôi, không phải bảng.
//
// Tổ chức nhận yêu cầu ký gửi sẽ đọc `asset_service_requests.message` trước khi
// mở hồ sơ đầy đủ. Trước file này, message là ô trống: chủ tài sản không biết
// viết gì, tổ chức nhận được một dòng "mong hợp tác" rồi phải tự dò 20 trường.
//
// Bản nháp sinh ra ở đây là nội dung MẶC ĐỊNH của ô đó — chủ tài sản sửa được
// tự do, và bản họ gửi đi mới là bản được lưu.
//
// Thuần, không React, không import ngược từ components (xem quy ước src/lib).
//
// TÌNH TRẠNG PHÁP LÝ LÀ BẮT BUỘC CÓ: tranh chấp / thế chấp / kê biên quyết định
// tổ chức có nhận hồ sơ hay không. Brief im lặng về những điều này là brief nói
// dối — dù chủ tài sản không cố ý.

import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import {
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  type AuctionFormat,
  type ExpectedTimeline,
  type PricingMode,
} from "@/types/asset-posting";

export interface AssetBriefInput {
  parentSlug: string;
  childSlug: string;
  title: string;
  description?: string | null;
  province?: string | null;
  district?: string | null;
  deltaFields: Record<string, unknown>;
  pricingMode: PricingMode;
  startingPrice?: number | null;
  format: AuctionFormat;
  expectedTimeline?: string | null;
  /** null = chưa khai báo; brief chỉ nhắc khi true. */
  hasDispute: boolean | null;
  hasMortgage: boolean | null;
  isSeized: boolean | null;
  imageCount: number;
  videoCount: number;
  proofCount: number;
  docCount: number;
}

/** Tối đa bao nhiêu thông số phụ được đưa vào brief — quá số này thì thành bảng. */
const MAX_SPECS = 4;

/** Số tiền thành lời: "8,5 tỷ đồng" / "750 triệu đồng". */
export function priceInWords(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ đồng`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu đồng`;
  return `${n.toLocaleString("vi-VN")} đồng`;
}

/**
 * Một thông số phụ dưới dạng "nhãn 90 m²" để nhúng giữa câu.
 *
 * KHÔNG dùng renderDeltaValue() của components/asset-posting/format.ts: hàm đó
 * trả "—" cho ô trống và định dạng cho ô bảng, còn ở đây ô trống phải biến mất
 * hẳn khỏi câu văn.
 */
function specPhrase(childSlug: string, key: string, raw: unknown): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const d = getDeltaFields(childSlug).find((x) => x.key === key);
  if (!d) return null;

  if (d.type === "boolean") return raw ? d.label.toLowerCase() : null;
  const value =
    d.type === "select"
      ? (d.options?.find((o) => o.value === raw)?.label ?? String(raw))
      : d.type === "number"
        ? Number(raw).toLocaleString("vi-VN")
        : String(raw).trim();
  return `${d.label.toLowerCase()} ${value}${d.unit ? ` ${d.unit}` : ""}`;
}

function join(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} và ${parts[parts.length - 1]}`;
}

const isTimeline = (v: string): v is ExpectedTimeline => v in EXPECTED_TIMELINE_LABELS;

/**
 * Bản nháp brief: 3–4 câu ngắn, mỗi câu một việc.
 *   1. Tài sản là gì, ở đâu, thông số chính.
 *   2. Kỳ vọng giá · hình thức đấu giá · mốc thời gian.
 *   3. Tình trạng pháp lý (chỉ khi có vướng, và luôn nói rõ khi có).
 *   4. Hồ sơ kèm theo đã có gì.
 */
export function buildAssetBrief(i: AssetBriefInput): string {
  const lines: string[] = [];

  // ── 1. Tài sản & vị trí ──
  const kind = CHILD_NAME[i.childSlug] ?? PARENT_NAME[i.parentSlug] ?? "Tài sản";
  const place = [i.district, i.province].filter(Boolean).join(", ");
  const specs = Object.entries(i.deltaFields)
    .map(([k, v]) => specPhrase(i.childSlug, k, v))
    .filter((x): x is string => !!x)
    .slice(0, MAX_SPECS);

  // Chủ tài sản thường tự đặt tên bắt đầu bằng chính loại tài sản ("Nhà phố mặt
  // tiền..."), khi đó thêm tiền tố loại thành "Nhà phố: Nhà phố mặt tiền...".
  const title = i.title.trim();
  const dup = title.toLowerCase().startsWith(kind.toLowerCase());
  let intro = dup ? title : `${kind}: ${title}`;
  if (place) intro += `, tại ${place}`;
  if (specs.length) intro += `. Thông số chính: ${join(specs)}`;
  lines.push(`${intro}.`);

  // Mô tả của chủ tài sản đặt nguyên văn — đây là tiếng nói của họ về tài sản.
  const desc = i.description?.trim();
  if (desc) lines.push(desc.endsWith(".") ? desc : `${desc}.`);

  // ── 2. Kỳ vọng đấu giá ──
  const wants: string[] = [];
  wants.push(
    i.pricingMode === "appraisal"
      ? "Chủ tài sản mong tổ chức định giá khởi điểm"
      : i.startingPrice
        ? `Chủ tài sản đề xuất giá khởi điểm ${priceInWords(i.startingPrice)}`
        : "Chủ tài sản chưa chốt giá khởi điểm",
  );
  wants.push(`hình thức ${AUCTION_FORMAT_LABELS[i.format].toLowerCase()}`);
  if (i.expectedTimeline && isTimeline(i.expectedTimeline)) {
    wants.push(`thời gian kỳ vọng: ${EXPECTED_TIMELINE_LABELS[i.expectedTimeline].toLowerCase()}`);
  }
  lines.push(`${wants.join(", ")}.`);

  // ── 3. Pháp lý — chỉ nêu điều đang vướng, nhưng nêu là phải rõ ──
  const issues = [
    i.hasDispute ? "đang có tranh chấp" : null,
    i.hasMortgage ? "đang thế chấp" : null,
    i.isSeized ? "đang bị kê biên" : null,
  ].filter((x): x is string => !!x);
  if (issues.length) lines.push(`Lưu ý pháp lý: tài sản ${join(issues)}.`);

  // ── 4. Hồ sơ kèm theo ──
  const attached = [
    i.imageCount ? `${i.imageCount} ảnh` : null,
    i.videoCount ? `${i.videoCount} video` : null,
    i.proofCount ? `${i.proofCount} giấy tờ sở hữu` : null,
    i.docCount ? `${i.docCount} tài liệu bổ sung` : null,
  ].filter((x): x is string => !!x);
  if (attached.length) lines.push(`Hồ sơ đã số hoá kèm ${join(attached)}.`);

  return lines.join("\n\n");
}
