// Engine "AI đọc ảnh/video tài sản rồi đề xuất điền form" (thuần, không React,
// unit-testable).
//
// BẢN DEMO: chưa có mô hình thị giác nào cả. Giá trị được DERIVE TẤT ĐỊNH từ
// (childSlug + danh sách URL ảnh) qua seededRand, đúng khuôn orgMatching.ts —
// nhờ vậy kết quả ổn định qua mọi lần render và qua reload, và viết test được.
//
// SEAM ĐỔI SANG AI THẬT nằm ở hook src/hooks/useAiMediaExtraction.ts, không phải
// ở đây: hook chỉ cần đổi từ gọi extractFromMedia() sang
// supabase.functions.invoke("extract-asset-media") miễn là trả đúng
// ExtractionResult. Toàn bộ UI giữ nguyên.

import { getDeltaFields, type DeltaFieldDescriptor } from "@/constants/asset-delta-fields";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import {
  DESCRIPTION_FALLBACK,
  DESCRIPTION_TEMPLATES,
  EVIDENCE_BY_TYPE,
  EVIDENCE_DESCRIPTION,
  EVIDENCE_LOCATION,
  EVIDENCE_TITLE,
  EVIDENCE_VIDEO,
  MODEL_LABEL,
  NUMBER_RANGES,
  TEXT_FALLBACK,
  TEXT_POOLS,
  UNIT_RANGES,
} from "./mockAiExtraction";
import { seededInt, seededPick, seededRand } from "./seededRand";

// ─── Hợp đồng dữ liệu (giữ nguyên khi thay bằng AI thật) ─────────────────────

/** Trường thuộc khối nào trong bước 2 — quyết định cách nhóm ở panel duyệt. */
export type ExtractionGroup = "identity" | "spec" | "extra";

export interface ExtractedField {
  /** "title" | "description" | "province" | "district" | "ward" | "address" | "delta.<key>" */
  path: string;
  label: string;
  group: ExtractionGroup;
  /** LUÔN là chuỗi: form giữ chuỗi, coerceDelta() mới ép số lúc lưu xuống DB. */
  value: string;
  /** Chuỗi để hiển thị cho người dùng — đã map option label và gắn đơn vị. */
  display: string;
  /** 0..1 */
  confidence: number;
  /** Câu giải thích "vì sao AI nghĩ vậy". */
  evidence: string;
}

export interface ExtractionResult {
  fields: ExtractedField[];
  /** Đổi khi loại tài sản hoặc danh sách media đổi → biết kết quả đã cũ. */
  signature: string;
  imageCount: number;
  videoCount: number;
  modelLabel: string;
}

export interface ExtractionInput {
  parentSlug: string;
  childSlug: string;
  province: string;
  imageUrls: string[];
  videoUrls: string[];
}

// ─── Nhãn độ tin cậy ─────────────────────────────────────────────────────────

/** Ba mức, dùng chung tone với <Pill> của wizard. */
export function confidenceLabel(c: number): { text: string; tone: "ok" | "muted" | "req" } {
  if (c >= 0.85) return { text: "Tin cậy cao", tone: "ok" };
  if (c >= 0.6) return { text: "Tin cậy vừa", tone: "muted" };
  return { text: "Cần kiểm tra", tone: "req" };
}

// ─── Signature ───────────────────────────────────────────────────────────────

/**
 * Chữ ký của "đầu vào đã dùng để phân tích".
 *
 * Gồm cả childSlug chứ không chỉ media: đổi loại tài sản thì bộ delta field đổi
 * hẳn, kết quả cũ không còn nghĩa gì — nhưng ảnh thì vẫn nguyên, nên nếu chỉ ký
 * theo media sẽ không phát hiện được.
 */
export function mediaSignature(input: Pick<ExtractionInput, "childSlug" | "imageUrls" | "videoUrls">): string {
  return [input.childSlug, ...input.imageUrls, "|", ...input.videoUrls].join("");
}

// ─── Tên loại tài sản ────────────────────────────────────────────────────────

const CHILD_NAME: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((c) => c.children.map((ch) => [ch.slug, ch.name])),
);

// ─── Sinh giá trị theo descriptor ────────────────────────────────────────────

const groupVn = (n: number): string => n.toLocaleString("vi-VN");

/** Giá trị + chuỗi hiển thị cho một delta field. `null` = loại này không đoán được. */
function deltaValue(
  d: DeltaFieldDescriptor,
  seed: string,
): { value: string; display: string } | null {
  const salt = `delta:${d.key}`;

  if (d.type === "number") {
    const [min, max] = NUMBER_RANGES[d.key] ?? (d.unit ? UNIT_RANGES[d.unit] : undefined) ?? [1, 100];
    // Làm tròn đẹp cho số lớn: 68.000 km dễ tin hơn 67.431 km.
    const raw = seededInt(seed, salt, min, max);
    const n = raw >= 10000 ? Math.round(raw / 1000) * 1000 : raw >= 1000 ? Math.round(raw / 10) * 10 : raw;
    return { value: String(n), display: d.unit ? `${groupVn(n)} ${d.unit}` : groupVn(n) };
  }

  if (d.type === "select") {
    const opt = seededPick(d.options ?? [], seed, salt);
    if (!opt) return null;
    return { value: opt.value, display: opt.label };
  }

  if (d.type === "text") {
    const pool = TEXT_POOLS[d.key] ?? TEXT_FALLBACK;
    const picked = seededPick(pool, seed, salt);
    if (!picked) return null;
    return { value: picked, display: picked };
  }

  // textarea / boolean: đoán bừa một đoạn văn hay một cờ đúng-sai thì hại nhiều
  // hơn lợi — để người dùng tự khai.
  return null;
}

// ─── Độ tin cậy ──────────────────────────────────────────────────────────────

/**
 * Trường bắt buộc (thứ nhìn phát ra ngay: diện tích, hãng xe) tự tin hơn trường
 * phụ. Nhân hệ số theo số ảnh và có video hay không, để bản demo "có phản ứng"
 * với đầu vào thay vì trả một con số chết.
 */
function confidenceFor(base: number, input: ExtractionInput, seed: string, salt: string): number {
  const imageFactor = Math.min(1, 0.62 + 0.13 * input.imageUrls.length);
  const videoBonus = input.videoUrls.length > 0 ? 0.05 : 0;
  const jitter = (seededRand(seed, `conf:${salt}`) - 0.5) * 0.08;
  return Math.max(0.3, Math.min(0.97, base * imageFactor + videoBonus + jitter));
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export function extractFromMedia(input: ExtractionInput): ExtractionResult {
  const signature = mediaSignature(input);
  const seed = signature;
  const descriptors = getDeltaFields(input.childSlug);

  // Không có bộ thông số cho loại này (nhóm "Khác") ⇒ trả rỗng và dừng hẳn.
  // Vẫn đoán bừa tỉnh/quận thì người dùng nhận một gợi ý địa điểm lơ lửng không
  // dính gì tới tài sản, còn hook thì mất nhánh báo "chưa hỗ trợ loại này".
  if (descriptors.length === 0) {
    return {
      fields: [],
      signature,
      imageCount: input.imageUrls.length,
      videoCount: input.videoUrls.length,
      modelLabel: MODEL_LABEL,
    };
  }

  const fields: ExtractedField[] = [];

  const evidenceFor = (type: DeltaFieldDescriptor["type"], salt: string): string => {
    if (input.videoUrls.length > 0 && seededRand(seed, `ev:${salt}`) > 0.78) return EVIDENCE_VIDEO;
    const pool = EVIDENCE_BY_TYPE[type];
    return seededPick(pool, seed, `ev:${salt}`) ?? pool[0];
  };

  // ── Thông số theo loại tài sản ──
  for (const d of descriptors) {
    const v = deltaValue(d, seed);
    if (!v) continue;
    fields.push({
      path: `delta.${d.key}`,
      label: d.label,
      group: d.required ? "spec" : "extra",
      value: v.value,
      display: v.display,
      confidence: confidenceFor(d.required ? 0.92 : 0.8, input, seed, d.key),
      evidence: evidenceFor(d.type, d.key),
    });
  }

  // ── Khu vực ──
  // Tôn trọng tỉnh người dùng đã chọn; chỉ đề xuất tỉnh khi còn bỏ trống. Quận và
  // phường LUÔN bốc trong đúng cây của tỉnh đang dùng, nếu không thì SelectField
  // của bước 2 sẽ không tìm thấy option và hiện rỗng.
  const suggestedProvince =
    input.province || seededPick(vietnamProvinces, seed, "province")?.name || "";
  const prov = vietnamProvinces.find((p) => p.name === suggestedProvince);
  const dist = prov ? seededPick(prov.districts, seed, "district") : undefined;
  const ward = dist ? seededPick(dist.wards, seed, "ward") : undefined;

  if (!input.province && suggestedProvince) {
    fields.push({
      path: "province",
      label: "Tỉnh / Thành phố",
      group: "identity",
      value: suggestedProvince,
      display: suggestedProvince,
      confidence: confidenceFor(0.66, input, seed, "province"),
      evidence: EVIDENCE_LOCATION,
    });
  }
  if (dist) {
    fields.push({
      path: "district",
      label: "Quận / Huyện",
      group: "extra",
      value: dist.name,
      display: dist.name,
      confidence: confidenceFor(0.6, input, seed, "district"),
      evidence: EVIDENCE_LOCATION,
    });
  }
  if (ward) {
    fields.push({
      path: "ward",
      label: "Phường / Xã",
      group: "extra",
      value: ward,
      display: ward,
      confidence: confidenceFor(0.52, input, seed, "ward"),
      evidence: EVIDENCE_LOCATION,
    });
  }

  // ── Tên tài sản & mô tả ──
  // Đặt sau cùng vì cần mượn giá trị của các trường phía trên.
  const childName = CHILD_NAME[input.childSlug] ?? "Tài sản";
  const where = [dist?.name, suggestedProvince].filter(Boolean).join(", ") || "Việt Nam";
  const headline = fields.find((f) => f.path === "delta.brand" || f.path === "delta.machine_type")?.display;
  const areaField = fields.find((f) => f.path === "delta.area" || f.path === "delta.land_area");
  const titleParts = [childName, headline, areaField ? areaField.display : null].filter(Boolean);
  const title = `${titleParts.join(" ")} tại ${where}`;

  fields.push({
    path: "title",
    label: "Tên tài sản",
    group: "identity",
    value: title,
    display: title,
    confidence: confidenceFor(0.78, input, seed, "title"),
    evidence: EVIDENCE_TITLE,
  });

  const templates = DESCRIPTION_TEMPLATES[input.parentSlug] ?? [DESCRIPTION_FALLBACK];
  const template = seededPick(templates, seed, "description") ?? DESCRIPTION_FALLBACK;
  const description = template
    .replace("{name}", [childName, headline].filter(Boolean).join(" "))
    .replace("{where}", where);
  fields.push({
    path: "description",
    label: "Mô tả",
    group: "extra",
    value: description,
    display: description,
    confidence: confidenceFor(0.7, input, seed, "description"),
    evidence: EVIDENCE_DESCRIPTION,
  });

  return {
    fields,
    signature,
    imageCount: input.imageUrls.length,
    videoCount: input.videoUrls.length,
    modelLabel: MODEL_LABEL,
  };
}

// ─── Thứ tự hiển thị nhóm ────────────────────────────────────────────────────

export const GROUP_ORDER: ExtractionGroup[] = ["identity", "spec", "extra"];

export const GROUP_LABEL: Record<ExtractionGroup, string> = {
  identity: "Nhận diện tài sản",
  spec: "Thông số theo loại tài sản",
  extra: "Thông số phụ",
};
