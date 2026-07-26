import { z } from "zod";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import type { NewAssetPosting } from "@/hooks/useAssetPosting";
import type { MatchCriteria } from "@/lib/orgMatching";
import type { AssetPosting } from "@/types/asset-posting";

// Form dùng một useForm xuyên suốt 5 bước. Field bắt buộc được gate theo từng bước
// qua form.trigger(STEP_FIELDS[step]); delta fields (riêng theo loại) validate thủ công.

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
    ownershipProofUrls: z.array(z.string()).min(1, "Bắt buộc tải lên giấy tờ chứng minh quyền sở hữu"),
    rightToSell: z.boolean(),
    hasDispute: z.string().min(1, "Vui lòng khai báo"),
    hasMortgage: z.string().min(1, "Vui lòng khai báo"),
    isSeized: z.string().min(1, "Vui lòng khai báo"),
    legalNotes: z.string().optional(),

    // Bước 4 — nhu cầu đấu giá
    // wantsAuction: "" chưa chọn · "yes" muốn đấu giá · "no" chỉ số hoá & lưu hồ sơ
    wantsAuction: z.enum(["", "yes", "no"]),
    chosenOrg: z.string().nullable(),
    pricingMode: z.enum(["self", "appraisal"]),
    startingPrice: z.string().optional(),
    auctionFormat: z.enum(["truc_tiep", "truc_tuyen", "ca_hai"]),
    commissionPct: z.string().optional(),
    expectedTimeline: z.string().optional(),
    imageUrls: z.array(z.string()),
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
  rightToSell: true,
  hasDispute: "",
  hasMortgage: "",
  isSeized: "",
  legalNotes: "",
  wantsAuction: "",
  chosenOrg: null,
  pricingMode: "self",
  startingPrice: "",
  auctionFormat: "truc_tiep",
  commissionPct: "",
  expectedTimeline: "",
  imageUrls: [],
  docUrls: [],
};

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
  ownershipProofUrls: "Cần ít nhất 1 giấy tờ sở hữu",
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
  ];
  getDeltaFields(v.childSlug)
    .filter((d) => d.required)
    .forEach((d) => r.push({ step: 2, key: `delta.${d.key}`, label: d.label, ok: filled(v.deltaFields[d.key]) }));
  r.push(
    { step: 3, key: "ownershipProofUrls", label: "Giấy tờ sở hữu", ok: v.ownershipProofUrls.length > 0 },
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

/** Field RHF cần validate khi rời mỗi bước (giữ cho tương thích; gating chính qua requirements). */
export const STEP_FIELDS: Record<number, (keyof WizardValues)[]> = {
  1: ["parentSlug", "childSlug"],
  2: ["title", "province"],
  3: ["ownershipProofUrls", "hasDispute", "hasMortgage", "isSeized"],
  4: ["auctionFormat", "startingPrice"],
  5: [],
};

/** Trả về nhãn các trường delta BẮT BUỘC còn thiếu (rỗng = hợp lệ). */
export function missingRequiredDelta(childSlug: string, deltaFields: Record<string, unknown>): string[] {
  return getDeltaFields(childSlug)
    .filter((d) => d.required)
    .filter((d) => {
      const val = deltaFields[d.key];
      return val === undefined || val === null || String(val).trim() === "";
    })
    .map((d) => d.label);
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
    has_dispute: v.hasDispute === "yes",
    has_mortgage: v.hasMortgage === "yes",
    is_seized: v.isSeized === "yes",
    right_to_sell: v.rightToSell,
    legal_notes: v.legalNotes || null,
    delta_fields: coerceDelta(v.childSlug, v.deltaFields),
    image_urls: v.imageUrls,
    doc_urls: v.docUrls,
  };
}
