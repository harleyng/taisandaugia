import type {
  AccountType,
  AudienceCriteria,
  AudienceKind,
  AudienceModes,
  AudienceSpec,
  KycStatusValue,
} from "@/types/marketing";
import { vietnamProvinces } from "@/constants/vietnam-locations";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  buyer: "Khách mua",
  company_rep: "Đại diện tổ chức đấu giá",
  owner_individual: "Chủ tài sản (cá nhân)",
  owner_org: "Chủ tài sản (tổ chức)",
  admin: "Quản trị viên",
};

// "admin" cố tình không cho chọn làm đối tượng nhận (nhãn vẫn giữ ở LABELS cho dữ liệu cũ).
export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "buyer",
  "company_rep",
  "owner_individual",
  "owner_org",
];

export const KYC_STATUS_LABELS: Record<KycStatusValue, string> = {
  NOT_APPLIED: "Chưa KYC",
  PENDING_KYC: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

export const KYC_STATUS_ORDER: KycStatusValue[] = [
  "NOT_APPLIED",
  "PENDING_KYC",
  "APPROVED",
  "REJECTED",
];

/** Danh sách tỉnh/thành dùng cho bộ lọc đối tượng. */
export const PROVINCE_OPTIONS: string[] = vietnamProvinces.map((p) => p.name);

export const DEFAULT_CRITERIA: AudienceCriteria = {
  registration: null,
  accountTypes: [],
  kycStatuses: [],
  credit: null,
  provinces: [],
  // Mặc định KHÔNG kèm người chưa xác định tỉnh/thành; "Chưa xác định" là 1 option người dùng tự chọn.
  includeNullProvince: false,
};

/** `modes` (hợp đồng với RPC) được suy ra hoàn toàn từ `kind`. */
export function modesForKind(kind: AudienceKind): AudienceModes {
  switch (kind) {
    case "all":
    case "criteria":
      return { criteria: true, specific: false, import: false };
    case "list":
      return { criteria: false, specific: true, import: true };
    default:
      return { criteria: false, specific: false, import: false };
  }
}

/** Tiêu chí đã có ít nhất một bộ lọc thực sự (khác "tất cả"). */
export function criteriaHasFilter(c: AudienceCriteria): boolean {
  return (
    !!c.registration ||
    c.accountTypes.length > 0 ||
    c.kycStatuses.length > 0 ||
    (!!c.credit && (c.credit.min != null || c.credit.max != null)) ||
    c.provinces.length > 0 ||
    c.includeNullProvince
  );
}

/** Suy ra loại đối tượng cho các bản ghi cũ chưa có trường `kind`. */
function inferKind(
  modes: AudienceModes,
  criteria: AudienceCriteria,
): AudienceKind {
  if (modes.specific || modes.import) return "list";
  if (modes.criteria) return criteriaHasFilter(criteria) ? "criteria" : "all";
  return "none";
}

export const DEFAULT_AUDIENCE_SPEC: AudienceSpec = {
  kind: "none",
  modes: modesForKind("none"),
  criteria: DEFAULT_CRITERIA,
  userIds: [],
  emails: [],
};

const VALID_KINDS: AudienceKind[] = ["none", "all", "criteria", "list"];

/** Merge một giá trị JSON (có thể thiếu trường) về AudienceSpec đầy đủ, an toàn. */
export function normalizeSpec(raw: unknown): AudienceSpec {
  const spec = (raw ?? {}) as Partial<AudienceSpec>;
  const rawCriteria = (spec.criteria ?? {}) as Partial<AudienceCriteria>;
  const criteria: AudienceCriteria = {
    registration: rawCriteria.registration ?? null,
    accountTypes: rawCriteria.accountTypes ?? [],
    kycStatuses: rawCriteria.kycStatuses ?? [],
    credit: rawCriteria.credit ?? null,
    provinces: rawCriteria.provinces ?? [],
    includeNullProvince: rawCriteria.includeNullProvince ?? false,
  };
  const modes: AudienceModes = {
    criteria: !!spec.modes?.criteria,
    import: !!spec.modes?.import,
    specific: !!spec.modes?.specific,
  };
  const kind: AudienceKind =
    spec.kind && VALID_KINDS.includes(spec.kind)
      ? spec.kind
      : inferKind(modes, criteria);
  return {
    kind,
    // `modes` luôn được suy ra từ `kind` để không bao giờ lệch nhau.
    modes: modesForKind(kind),
    criteria,
    userIds: spec.userIds ?? [],
    emails: spec.emails ?? [],
  };
}

/** Đã chọn loại đối tượng VÀ điền đủ thông tin để tính là hoàn thành. */
export function hasAnyAudience(spec: AudienceSpec): boolean {
  switch (spec.kind) {
    case "all":
      return true;
    case "criteria":
      return criteriaHasFilter(spec.criteria);
    case "list":
      return spec.userIds.length > 0 || spec.emails.length > 0;
    default:
      return false;
  }
}

/** Số người nhận đã chọn thủ công + import (cho loại "Danh sách cụ thể"). */
export function selectedRecipientCount(spec: AudienceSpec): number {
  return spec.userIds.length + spec.emails.length;
}

export type AudiencePreviewState = "empty" | "loading" | "error" | "ready";

export interface AudiencePreviewQuery {
  /** Số THỰC NHẬN (đã khớp tiêu chí VÀ đã cho phép email) từ RPC — `respect_optin=true`. */
  count?: number;
  isFetching: boolean;
  isError: boolean;
}

export interface AudiencePreviewHeadline {
  state: AudiencePreviewState;
  /** Dòng chính — dùng chung cho sidebar và summary từng loại để không lệch nhau. */
  primary: string;
  /** Dòng phụ (vd "trong N đã chọn") — chỉ có ở loại danh sách. */
  caption?: string;
}

/**
 * Nguồn sự thật DUY NHẤT cho dòng tóm tắt "sẽ nhận email". Gate theo `hasAnyAudience`
 * (chưa cấu hình → không hiện "0" giả), phân biệt lỗi RPC với "0 người", và diễn giải
 * số theo từng loại đối tượng. Cả `CampaignReviewPanel` lẫn `AudienceSummary` dùng nó
 * để hiển thị nhất quán.
 */
export function audiencePreviewHeadline(
  spec: AudienceSpec,
  q: AudiencePreviewQuery,
): AudiencePreviewHeadline {
  if (!hasAnyAudience(spec)) {
    return { state: "empty", primary: "Chưa cấu hình đối tượng" };
  }
  if (q.isError) {
    return { state: "error", primary: "Không tính được số người nhận" };
  }
  if (q.isFetching || q.count == null) {
    return { state: "loading", primary: "Đang tính số người nhận…" };
  }
  const n = q.count.toLocaleString("vi-VN");
  if (spec.kind === "list") {
    return {
      state: "ready",
      primary: `${n} người sẽ nhận email`,
      caption: `trong ${selectedRecipientCount(spec).toLocaleString("vi-VN")} đã chọn`,
    };
  }
  return { state: "ready", primary: `${n} người sẽ nhận email` };
}

/** Chip mô tả ngắn gọn cấu hình đối tượng cho panel tóm tắt. */
export function describeSpec(spec: AudienceSpec): string[] {
  const chips: string[] = [];
  if (spec.kind === "all") {
    chips.push("Tất cả khách hàng");
    return chips;
  }
  if (spec.kind === "criteria") {
    const c = spec.criteria;
    if (c.registration) {
      chips.push(`Ngày tạo: ${c.registration.from || "…"} → ${c.registration.to || "…"}`);
    }
    if (c.accountTypes.length) {
      chips.push(`Loại: ${c.accountTypes.map((t) => ACCOUNT_TYPE_LABELS[t]).join(", ")}`);
    }
    if (c.kycStatuses.length) {
      chips.push(`KYC: ${c.kycStatuses.map((s) => KYC_STATUS_LABELS[s]).join(", ")}`);
    }
    if (c.credit && (c.credit.min != null || c.credit.max != null)) {
      chips.push(
        `Credit: ${c.credit.min ?? 0}–${c.credit.max != null ? c.credit.max : "∞"}`,
      );
    }
    if (c.provinces.length || c.includeNullProvince) {
      const parts = [...c.provinces];
      if (c.includeNullProvince) parts.push("Chưa xác định");
      chips.push(`Tỉnh/thành: ${parts.join(", ")}`);
    }
  }
  if (spec.kind === "list") {
    const total = spec.userIds.length + spec.emails.length;
    if (total) chips.push(`${total} người nhận đã chọn`);
  }
  return chips;
}
