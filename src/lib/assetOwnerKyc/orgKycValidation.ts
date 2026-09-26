import type { IdType, OrgKycScope, OrgType } from "@/types/asset-owner";

/**
 * Luật hồ sơ KYC tổ chức chủ tài sản — gồm nhánh chi nhánh rút gọn (Phase 13,
 * quyết định D3 trong docs/owner-control-tower-plan.md).
 *
 * Chi nhánh: bắt buộc email công vụ + giấy giao việc / uỷ quyền của Giám đốc chi
 * nhánh + họ tên, chức vụ, số và 2 ảnh giấy tờ của cán bộ. KHÔNG bắt buộc quyết
 * định thành lập, selfie, MST chi nhánh.
 *
 * Server (trigger asset_owner_org_kyc_branch_guard) chỉ ép phần quyết định phạm vi
 * dữ liệu: công ty mẹ, thực thể, giấy uỷ quyền, email. Phần còn lại là luật FE.
 */

export interface OrgKycForm {
  kyc_scope: OrgKycScope;
  parent_asset_owner_id: string | null;
  org_type: OrgType | "";
  org_name: string;
  tax_code: string;
  official_email: string;
  email_domain: string;
  aliases: string[];
  linked_asset_owner_id: string | null;
  linked_auction_org_id: string | null;
  registry_match_score: number | null;
  rep_full_name: string;
  rep_title: string;
  head_office_address: string;
  head_office_province: string;
  rep_id_type: IdType;
  rep_id_number: string;
  rep_id_front_url: string | null;
  rep_id_back_url: string | null;
  rep_selfie_url: string | null;
  establishment_doc_url: string | null;
  authorization_doc_url: string | null;
}

export const EMPTY_ORG_KYC_FORM: OrgKycForm = {
  kyc_scope: "organization",
  parent_asset_owner_id: null,
  org_type: "",
  org_name: "", tax_code: "", official_email: "", email_domain: "",
  aliases: [],
  linked_asset_owner_id: null,
  linked_auction_org_id: null,
  registry_match_score: null,
  rep_full_name: "", rep_title: "",
  head_office_address: "", head_office_province: "",
  rep_id_type: "cccd", rep_id_number: "",
  rep_id_front_url: null,
  rep_id_back_url: null,
  rep_selfie_url: null,
  establishment_doc_url: null,
  authorization_doc_url: null,
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Trả về thông báo lỗi đầu tiên (tiếng Việt), hoặc null nếu hợp lệ. */
export function validateOrgKycForm(form: OrgKycForm): string | null {
  const branch = form.kyc_scope === "branch";

  if (!form.org_type) return "Vui lòng chọn loại tổ chức";
  if (branch && !form.parent_asset_owner_id) {
    return "Vui lòng chọn ngân hàng / tổ chức mẹ của chi nhánh";
  }
  if (form.org_name.trim().length < 3) {
    return branch ? "Vui lòng nhập tên chi nhánh đầy đủ" : "Vui lòng nhập tên tổ chức đầy đủ";
  }
  // MST chi nhánh không bắt buộc, nhưng đã nhập thì phải ra hình một mã.
  const tax = form.tax_code.trim();
  if ((!branch || tax.length > 0) && tax.length < 5) {
    return "Mã số thuế / mã cơ quan chưa hợp lệ";
  }
  if (branch ? !EMAIL_RE.test(form.official_email.trim()) : !form.official_email.includes("@")) {
    return "Email công vụ chưa hợp lệ";
  }
  if (form.head_office_address.trim().length < 5) {
    return branch
      ? "Vui lòng nhập địa chỉ chi nhánh (dùng trong hợp đồng dịch vụ đấu giá)"
      : "Vui lòng nhập địa chỉ trụ sở (dùng trong hợp đồng dịch vụ đấu giá)";
  }
  const who = branch ? "cán bộ được giao" : "người đại diện";
  if (form.rep_full_name.trim().length < 3) return `Vui lòng nhập họ tên ${who}`;
  if (!form.rep_title.trim()) return `Vui lòng nhập chức vụ ${who}`;
  if (form.rep_id_number.trim().length < 6) return `Số CCCD / hộ chiếu ${who} chưa hợp lệ`;
  if (!form.rep_id_front_url || !form.rep_id_back_url) {
    return `Vui lòng tải lên ảnh CCCD ${who} (2 mặt)`;
  }
  if (branch) {
    if (!form.authorization_doc_url) {
      return "Vui lòng tải lên giấy giao việc / uỷ quyền của Giám đốc chi nhánh";
    }
    return null;
  }
  if (!form.rep_selfie_url) return "Vui lòng tải lên ảnh selfie người đại diện";
  if (!form.establishment_doc_url) return "Vui lòng tải lên giấy phép / quyết định thành lập";
  return null;
}

/** Hộp thư miễn phí — không chặn, chỉ gắn cờ cho admin khi duyệt hồ sơ chi nhánh. */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.com.vn", "outlook.com",
  "hotmail.com", "live.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com",
]);

export function isFreeMailDomain(emailOrDomain: string | null | undefined): boolean {
  if (!emailOrDomain) return false;
  const domain = (emailOrDomain.includes("@") ? emailOrDomain.split("@")[1] : emailOrDomain)
    .trim()
    .toLowerCase();
  return FREE_MAIL_DOMAINS.has(domain);
}

/** Mã lỗi RAISE từ trigger DB (migration 20260926145010) → thông báo tiếng Việt. */
const ORG_KYC_ERRORS: Record<string, string> = {
  branch_parent_required: "Hồ sơ chi nhánh cần chọn ngân hàng / tổ chức mẹ.",
  branch_parent_mismatch:
    "Chi nhánh này thuộc một tổ chức mẹ khác trong danh bạ. Vui lòng chọn lại đúng tổ chức mẹ.",
  branch_name_invalid: "Tên chi nhánh chưa hợp lệ hoặc đang trùng tên tổ chức mẹ.",
  branch_authorization_required:
    "Vui lòng tải lên giấy giao việc / uỷ quyền của Giám đốc chi nhánh.",
  branch_email_required: "Email công vụ chưa hợp lệ.",
  branch_workspace_exists:
    "Chi nhánh này đã có Trạm Điều Hành. Hãy đề nghị Trưởng đơn vị của chi nhánh mời bạn tham gia.",
  claim_outside_branch:
    "Tài sản này đứng tên đơn vị khác. Trạm của chi nhánh chỉ nhận tài sản của chính chi nhánh hoặc của trụ sở.",
};

export function mapOrgKycError(err: unknown, fallback: string): string {
  const message = typeof err === "object" && err && "message" in err
    ? String((err as { message: unknown }).message ?? "")
    : String(err ?? "");
  const code = Object.keys(ORG_KYC_ERRORS).find((k) => message.includes(k));
  return code ? ORG_KYC_ERRORS[code] : fallback;
}
