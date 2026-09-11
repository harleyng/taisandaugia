import { z } from "zod";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { getProofMode, MAX_RFQ_ORGS, MIN_IMAGES } from "@/constants/asset-posting-rules";
import { ASSET_DECLARATION_VERSION } from "@/constants/terms";
import type { NewAssetPosting } from "@/hooks/useAssetPosting";
import type { ExtractedField } from "@/lib/aiMediaExtraction";
import type { AssetBriefInput } from "@/lib/assetBrief";
import type { MatchCriteria } from "@/lib/orgMatching";
import type { AssetPosting } from "@/types/asset-posting";
import type { Json } from "@/integrations/supabase/types";

// Form dùng một useForm xuyên suốt 5 bước.
//
// GATING: requirements() bên dưới là cổng DUY NHẤT. zodResolver có gắn ở wizard
// nhưng next()/finish() không bao giờ gọi form.trigger() và formState.errors không
// được render ở đâu cả — schema zod dưới đây chỉ để z.infer ra WizardValues.
// Thêm luật mới ⇒ thêm một dòng vào requirements(), ĐỪNG thêm .min()/superRefine:
// làm vậy tạo bản sao thứ hai của cùng một luật, không có đường chạy, không test.

export const wizardSchema = z
  .object({
    // Bước 1 — loại tài sản
    parentSlug: z.string().min(1, "Vui lòng chọn nhóm tài sản"),
    childSlug: z.string().min(1, "Vui lòng chọn loại tài sản"),

    // Bước 2 — thông tin chung
    title: z.string().min(3, "Tên tài sản tối thiểu 3 ký tự"),
    description: z.string().optional(),
    province: z.string().min(1, "Vui lòng chọn khu vực"),
    district: z.string().optional(),
    ward: z.string().optional(),
    address: z.string().optional(),
    deltaFields: z.record(z.unknown()),

    // Bước 3 — pháp lý & hiện trạng
    // Bắt buộc hay không tuỳ nhóm cấp 1 — quyết định ở requirements().
    ownershipProofUrls: z.array(z.string()),
    declarationAccepted: z.boolean(),
    declarationName: z.string(),
    rightToSell: z.boolean(),
    hasDispute: z.string().min(1, "Vui lòng khai báo"),
    hasMortgage: z.string().min(1, "Vui lòng khai báo"),
    isSeized: z.string().min(1, "Vui lòng khai báo"),
    legalNotes: z.string().optional(),

    // Bước 4 — nhu cầu đấu giá
    // wantsAuction: "" chưa chọn · "yes" muốn đấu giá · "no" chỉ số hoá & lưu hồ sơ
    wantsAuction: z.enum(["", "yes", "no"]),
    // orgMode: "" chưa quyết · "self" tự chọn tổ chức · "platform" nhờ sàn chọn giúp
    orgMode: z.enum(["", "self", "platform"]),
    /**
     * Các tổ chức sẽ nhận yêu cầu báo giá — tối đa MAX_RFQ_ORGS, thứ tự = thứ tự
     * người dùng bấm (hàng chip trong OrgPicker đọc theo thứ tự này).
     * Mỗi tổ chức thành MỘT dòng asset_service_requests khi hoàn tất.
     */
    chosenOrgs: z.array(z.string()),
    /** Lời nhắn gửi kèm khi nhờ sàn chọn giúp. */
    brokerNote: z.string().optional(),
    /**
     * Nội dung gửi tổ chức mình tự chọn — khởi tạo từ buildAssetBrief() rồi chủ
     * tài sản sửa tự do. Đi vào asset_service_requests.message, KHÔNG lưu trên
     * asset_postings: đây là lời của một lần gửi, không phải thuộc tính tài sản.
     * MỘT bản dùng chung cho mọi tổ chức được chọn — đó là định nghĩa của RFQ.
     */
    orgMessage: z.string().optional(),
    pricingMode: z.enum(["self", "appraisal"]),
    startingPrice: z.string().optional(),
    auctionFormat: z.enum(["truc_tiep", "truc_tuyen", "ca_hai"]),
    commissionPct: z.string().optional(),
    expectedTimeline: z.string().optional(),
    imageUrls: z.array(z.string()),
    videoUrls: z.array(z.string()),
    docUrls: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.wantsAuction === "yes" && v.pricingMode === "self" && (!v.startingPrice || Number(v.startingPrice) <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startingPrice"],
        message: "Nhập giá khởi điểm hoặc chuyển sang 'Nhờ định giá'",
      });
    }
  });

export type WizardValues = z.infer<typeof wizardSchema>;

export const wizardDefaults: WizardValues = {
  parentSlug: "",
  childSlug: "",
  title: "",
  description: "",
  province: "",
  district: "",
  ward: "",
  address: "",
  deltaFields: {},
  ownershipProofUrls: [],
  declarationAccepted: false,
  declarationName: "",
  rightToSell: true,
  hasDispute: "",
  hasMortgage: "",
  isSeized: "",
  legalNotes: "",
  wantsAuction: "",
  orgMode: "",
  chosenOrgs: [],
  brokerNote: "",
  orgMessage: "",
  pricingMode: "self",
  startingPrice: "",
  auctionFormat: "truc_tiep",
  commissionPct: "",
  expectedTimeline: "",
  imageUrls: [],
  videoUrls: [],
  docUrls: [],
};

/**
 * Chữ ký điện tử đã nhập đủ chưa? Yêu cầu ≥ 2 từ chứ không phải ≥ 3 ký tự:
 * "abc" qua được min-length nhưng không phải họ tên, mà đây là thứ đang được
 * lưu lại làm bằng chứng thay cho giấy tờ sở hữu.
 */
export const signatureFilled = (name: string): boolean =>
  name.trim().split(/\s+/).filter(Boolean).length >= 2;

/** Đã nhập (khác rỗng)? */
export const filled = (v: unknown): boolean =>
  v !== undefined && v !== null && String(v).trim() !== "";

// ─── Bảng yêu cầu bắt buộc — nguồn DUY NHẤT cho rail, cảnh báo & nút Tiếp tục ──
export interface Requirement {
  step: number;
  key: string;
  label: string;
  ok: boolean;
}

/** Thông điệp lỗi ngắn theo key (hiện sau khi bấm Tiếp tục mà còn thiếu). */
export const REQUIREMENT_MSG: Record<string, string> = {
  parentSlug: "Chọn nhóm tài sản",
  childSlug: "Chọn loại tài sản",
  title: "Tối thiểu 3 ký tự",
  province: "Chọn tỉnh / thành phố",
  imageUrls: "Cần ít nhất 1 ảnh tài sản",
  ownershipProofUrls: "Cần ít nhất 1 giấy tờ sở hữu",
  ownershipDeclaration: "Tích xác nhận và nhập họ tên đầy đủ",
  legal: "Trả lời cả 3 câu",
  wantsAuction: "Chọn một phương án",
  auctionFormat: "Chọn hình thức đấu giá",
  startingPrice: "Nhập giá hoặc chọn nhờ định giá",
};

/** Toàn bộ điều kiện bắt buộc theo giá trị form hiện tại (mirror sohoa-app.jsx). */
export function requirements(v: WizardValues): Requirement[] {
  const r: Requirement[] = [
    { step: 1, key: "parentSlug", label: "Nhóm tài sản", ok: !!v.parentSlug },
    { step: 1, key: "childSlug", label: "Loại tài sản", ok: !!v.childSlug },
    { step: 2, key: "title", label: "Tên tài sản", ok: v.title.trim().length >= 3 },
    { step: 2, key: "province", label: "Khu vực", ok: !!v.province },
    { step: 2, key: "imageUrls", label: "Ảnh tài sản", ok: v.imageUrls.length >= MIN_IMAGES },
  ];
  getDeltaFields(v.childSlug)
    .filter((d) => d.required)
    .forEach((d) => r.push({ step: 2, key: `delta.${d.key}`, label: d.label, ok: filled(v.deltaFields[d.key]) }));
  // Chỉ bất động sản & xe cộ mới có giấy tờ đăng ký sở hữu; nhóm còn lại ký cam kết.
  if (getProofMode(v.parentSlug) === "documents") {
    r.push({ step: 3, key: "ownershipProofUrls", label: "Giấy tờ sở hữu", ok: v.ownershipProofUrls.length > 0 });
  } else {
    r.push({
      step: 3,
      key: "ownershipDeclaration",
      label: "Bản cam kết sở hữu",
      ok: v.declarationAccepted && signatureFilled(v.declarationName),
    });
  }
  r.push(
    { step: 3, key: "legal", label: "Tình trạng pháp lý", ok: !!v.hasDispute && !!v.hasMortgage && !!v.isSeized },
    { step: 4, key: "wantsAuction", label: "Nhu cầu đấu giá", ok: !!v.wantsAuction },
  );
  if (v.wantsAuction === "yes") {
    r.push({ step: 4, key: "auctionFormat", label: "Hình thức đấu giá", ok: !!v.auctionFormat });
    if (v.pricingMode === "self") {
      r.push({ step: 4, key: "startingPrice", label: "Giá khởi điểm", ok: Number(v.startingPrice) > 0 });
    }
  }
  return r;
}

/** Ép kiểu số cho các trường delta type 'number'. */
function coerceDelta(childSlug: string, deltaFields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const descriptors = getDeltaFields(childSlug);
  for (const [key, raw] of Object.entries(deltaFields)) {
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const d = descriptors.find((x) => x.key === key);
    out[key] = d?.type === "number" ? Number(raw) : raw;
  }
  return out;
}

/**
 * Kết quả trích xuất AI → patch cho form.
 *
 * Đặt ở đây chứ không ở src/lib/aiMediaExtraction.ts vì engine phải giữ thuần,
 * không được import ngược WizardValues từ thư mục components.
 *
 * Hai điểm phải cẩn thận:
 *  · `delta.<key>` gộp vào MỘT object deltaFields — patch từng key riêng sẽ ghi
 *    đè cả object và làm mất những gì người dùng đã nhập.
 *  · Đổi `province` mà không đặt lại district/ward thì form còn giữ quận của
 *    tỉnh cũ (SelectField sẽ không tìm thấy option → hiện rỗng). Nên khi patch có
 *    province thì district/ward luôn được ghi đè: lấy giá trị AI đề xuất nếu
 *    người dùng có tick, còn không thì xoá trắng.
 */
/** Giá trị người dùng đang có ở trường mà một ExtractedField trỏ tới ("" nếu trống). */
export function fieldCurrentValue(v: WizardValues, path: string): string {
  if (path.startsWith("delta.")) {
    const raw = v.deltaFields[path.slice("delta.".length)];
    return filled(raw) ? String(raw) : "";
  }
  switch (path) {
    case "title":
      return v.title;
    case "description":
      return v.description ?? "";
    case "province":
      return v.province;
    case "district":
      return v.district ?? "";
    case "ward":
      return v.ward ?? "";
    case "address":
      return v.address ?? "";
    default:
      return "";
  }
}

export function applyExtractedFields(
  v: WizardValues,
  fields: ExtractedField[],
  selected: ReadonlySet<string>,
): Partial<WizardValues> {
  const chosen = fields.filter((f) => selected.has(f.path));
  if (chosen.length === 0) return {};

  const patch: Partial<WizardValues> = {};
  const deltas: Record<string, unknown> = { ...v.deltaFields };
  let touchedDelta = false;

  for (const f of chosen) {
    if (f.path.startsWith("delta.")) {
      deltas[f.path.slice("delta.".length)] = f.value;
      touchedDelta = true;
      continue;
    }
    switch (f.path) {
      case "title":
      case "description":
      case "province":
      case "district":
      case "ward":
      case "address":
        patch[f.path] = f.value;
        break;
      // Path lạ (engine mới, client cũ) — bỏ qua thay vì nhét bừa vào form.
      default:
        break;
    }
  }

  if (touchedDelta) patch.deltaFields = deltas;

  if (patch.province !== undefined && patch.province !== v.province) {
    const pick = (path: string) => chosen.find((f) => f.path === path)?.value ?? "";
    patch.district = pick("district");
    patch.ward = pick("ward");
  }

  return patch;
}

/**
 * Thêm/bỏ một tổ chức khỏi danh sách nhận yêu cầu báo giá, GIỮ thứ tự bấm và
 * chặn ở trần MAX_RFQ_ORGS. Vượt trần thì trả về đúng mảng cũ — OrgPicker đã
 * khoá thẻ nên đây chỉ là lưới an toàn cho chỗ gọi khác.
 */
export function toggleOrg(ids: string[], id: string, max = MAX_RFQ_ORGS): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= max) return ids;
  return [...ids, id];
}

export function buildMatchCriteria(v: WizardValues): MatchCriteria {
  return {
    parentSlug: v.parentSlug,
    province: v.province || null,
    format: v.auctionFormat,
    startingPrice: v.pricingMode === "self" && v.startingPrice ? Number(v.startingPrice) : null,
    acceptableCommissionPct: v.commissionPct ? Number(v.commissionPct) : null,
  };
}

/** Tiêu chí gợi ý tổ chức từ một hồ sơ đã lưu (dùng ở luồng gửi yêu cầu sau khi số hoá). */
export function postingToMatchCriteria(p: AssetPosting): MatchCriteria {
  return {
    parentSlug: p.parent_slug,
    province: p.province,
    format: p.auction_format,
    startingPrice: p.pricing_mode === "self" ? p.starting_price : null,
    acceptableCommissionPct: p.commission_pct,
  };
}

// ─── Đầu vào bản mô tả gửi tổ chức ───────────────────────────────────────────
// Cặp hàm song sinh như buildMatchCriteria / postingToMatchCriteria ở trên: một
// lối từ form đang nhập, một lối từ hồ sơ đã lưu, cùng đổ về một shape thuần.

export function buildBriefInput(v: WizardValues): AssetBriefInput {
  return {
    parentSlug: v.parentSlug,
    childSlug: v.childSlug,
    title: v.title,
    description: v.description || null,
    province: v.province || null,
    district: v.district || null,
    deltaFields: coerceDelta(v.childSlug, v.deltaFields),
    pricingMode: v.pricingMode,
    startingPrice: v.pricingMode === "self" && v.startingPrice ? Number(v.startingPrice) : null,
    format: v.auctionFormat,
    expectedTimeline: v.expectedTimeline || null,
    // Form dùng ""|"yes"|"no"; "" (chưa khai) phải thành null, không phải false.
    hasDispute: v.hasDispute ? v.hasDispute === "yes" : null,
    hasMortgage: v.hasMortgage ? v.hasMortgage === "yes" : null,
    isSeized: v.isSeized ? v.isSeized === "yes" : null,
    imageCount: v.imageUrls.length,
    videoCount: v.videoUrls.length,
    proofCount: v.ownershipProofUrls.length,
    docCount: v.docUrls.length,
  };
}

export function postingToBriefInput(p: AssetPosting): AssetBriefInput {
  return {
    parentSlug: p.parent_slug,
    childSlug: p.child_slug,
    title: p.title,
    description: p.description,
    province: p.province,
    district: p.district,
    deltaFields: p.delta_fields ?? {},
    pricingMode: p.pricing_mode,
    startingPrice: p.pricing_mode === "self" ? p.starting_price : null,
    format: p.auction_format,
    expectedTimeline: p.expected_timeline,
    hasDispute: p.has_dispute,
    hasMortgage: p.has_mortgage,
    isSeized: p.is_seized,
    imageCount: p.image_urls?.length ?? 0,
    videoCount: p.video_urls?.length ?? 0,
    proofCount: p.ownership_proof_urls?.length ?? 0,
    docCount: p.doc_urls?.length ?? 0,
  };
}

/**
 * Bản cam kết để lưu, hoặc null nếu nhóm này chứng minh bằng giấy tờ.
 *
 * `accepted_at` sinh TẠI ĐÂY (lúc lưu) chứ không nằm trong form state: nếu đóng
 * dấu lúc tích checkbox thì phải nhớ xoá khi bỏ tích, khi đổi nhóm và khi reset
 * form — ba chỗ để quên.
 */
function buildDeclaration(v: WizardValues): Json | null {
  if (getProofMode(v.parentSlug) !== "declaration") return null;
  if (!v.declarationAccepted || !signatureFilled(v.declarationName)) return null;
  return {
    name: v.declarationName.trim(),
    accepted_at: new Date().toISOString(),
    version: ASSET_DECLARATION_VERSION,
  } as unknown as Json;
}

/**
 * Hồ sơ đã lưu → giá trị form, để mở lại bản nháp.
 *
 * Chiều ngược của buildPostingPayload. Ba chỗ mất mát dữ liệu là CỐ Ý:
 *  · wantsAuction suy từ chosen_org_id/starting_price — DB không lưu ý định này.
 *  · declarationAccepted/Name đọc lại từ bản cam kết đã ký (nếu có).
 *  · has_dispute… là boolean|null ở DB nhưng ""|"yes"|"no" ở form.
 */
export function postingToWizardValues(p: AssetPosting): WizardValues {
  const yn = (b: boolean | null): "" | "yes" | "no" => (b === null ? "" : b ? "yes" : "no");
  return {
    parentSlug: p.parent_slug,
    childSlug: p.child_slug,
    title: p.title,
    description: p.description ?? "",
    province: p.province ?? "",
    district: p.district ?? "",
    ward: p.ward ?? "",
    address: p.address ?? "",
    deltaFields: p.delta_fields ?? {},
    ownershipProofUrls: p.ownership_proof_urls ?? [],
    declarationAccepted: !!p.ownership_declaration,
    declarationName: p.ownership_declaration?.name ?? "",
    rightToSell: p.right_to_sell,
    hasDispute: yn(p.has_dispute),
    hasMortgage: yn(p.has_mortgage),
    isSeized: yn(p.is_seized),
    legalNotes: p.legal_notes ?? "",
    wantsAuction: p.chosen_org_id || p.starting_price !== null ? "yes" : "",
    // Hồ sơ cũ chỉ lưu MỘT tổ chức trên asset_postings.chosen_org_id; quan hệ
    // nhiều-tổ-chức nằm ở asset_service_requests (không đọc lại vào nháp).
    orgMode: p.chosen_org_id ? "self" : "",
    chosenOrgs: p.chosen_org_id ? [p.chosen_org_id] : [],
    pricingMode: p.pricing_mode,
    startingPrice: p.starting_price !== null ? String(p.starting_price) : "",
    auctionFormat: p.auction_format,
    commissionPct: p.commission_pct !== null ? String(p.commission_pct) : "",
    expectedTimeline: p.expected_timeline ?? "",
    imageUrls: p.image_urls ?? [],
    videoUrls: p.video_urls ?? [],
    docUrls: p.doc_urls ?? [],
  };
}

export function buildPostingPayload(v: WizardValues): NewAssetPosting {
  return {
    parent_slug: v.parentSlug,
    child_slug: v.childSlug,
    title: v.title,
    description: v.description || null,
    province: v.province || null,
    district: v.district || null,
    ward: v.ward || null,
    address: v.address || null,
    pricing_mode: v.pricingMode,
    starting_price: v.pricingMode === "self" && v.startingPrice ? Number(v.startingPrice) : null,
    auction_format: v.auctionFormat,
    commission_pct: v.commissionPct ? Number(v.commissionPct) : null,
    expected_timeline: v.expectedTimeline || null,
    ownership_proof_urls: v.ownershipProofUrls,
    ownership_declaration: buildDeclaration(v),
    has_dispute: v.hasDispute === "yes",
    has_mortgage: v.hasMortgage === "yes",
    is_seized: v.isSeized === "yes",
    right_to_sell: v.rightToSell,
    legal_notes: v.legalNotes || null,
    // cột JSONB listings.delta_fields
    delta_fields: coerceDelta(v.childSlug, v.deltaFields) as unknown as Json,
    image_urls: v.imageUrls,
    video_urls: v.videoUrls,
    doc_urls: v.docUrls,
  };
}
