// Nộp lại hồ sơ khi tổ chức yêu cầu bổ sung (resubmit_bidding_contract).
//
// Form nộp lại dùng CHUNG RegistrationFormValues / makeRegistrationSchema /
// toStartPayload với trang đăng ký, chỉ khác điểm xuất phát: điền từ bản chụp
// đang nằm trên hồ sơ thay vì từ hồ sơ người dùng. Cách đọc + "trường đã sửa" do
// IdentityCapture tự theo dõi (đổi ảnh ⇒ đọc lại QR; sửa ô đã đọc ⇒ gắn cờ).

import type { ZodIssue } from "zod";
import { contractToRegistrationPayload } from "./registrationPayload";
import { emptyIdentity, type IdentityBlockValues, type RegistrationFormValues } from "./registrationForm";

/** Các cột bản chụp người đăng ký trên hồ sơ (cùng tập contractToRegistrationPayload đọc). */
export type ContractParties = Parameters<typeof contractToRegistrationPayload>[0];

/** Hồ sơ → giá trị form. Đã đồng ý chia sẻ thông tin khi đăng ký nên consent = true. */
export function contractToFormValues(c: ContractParties): RegistrationFormValues {
  const p = contractToRegistrationPayload(c);
  const block = (v: NonNullable<typeof p.proxy> | typeof p.principal): IdentityBlockValues => ({
    full_name: v.full_name,
    id_type: v.id_type,
    id_number: v.id_number,
    date_of_birth: v.date_of_birth ?? "",
    gender: v.gender ?? "",
    address: v.address,
    id_front_path: v.id_front_path ?? null,
    id_back_path: v.id_back_path ?? null,
    read_method: v.read_method ?? "typed",
    edited_fields: v.edited_fields ?? [],
  });

  return {
    buyer_kind: p.buyer_kind,
    phone: p.phone,
    email: p.email,
    principal: block(p.principal),
    organization: {
      name: c.org_name ?? "",
      tax_code: c.org_tax_code ?? "",
      address: c.org_address ?? "",
      reg_doc_path: c.org_reg_doc_path ?? null,
    },
    attendee: c.has_proxy ? "proxy" : "self",
    proxy: p.proxy
      ? { ...block(p.proxy), phone: p.proxy.phone, poa_doc_path: p.proxy.poa_doc_path }
      : { ...emptyIdentity(), phone: "", poa_doc_path: null },
    consent: true,
  };
}

/** Lỗi zod theo nhóm: `root` (phone, email…), `principal`, `organization`, `proxy`. Lỗi đầu tiên mỗi ô thắng. */
export type GroupedIssues = Record<"root" | "principal" | "organization" | "proxy", Record<string, string>>;

export function groupIssues(issues: ZodIssue[]): GroupedIssues {
  const out: GroupedIssues = { root: {}, principal: {}, organization: {}, proxy: {} };
  for (const i of issues) {
    const [head, field] = i.path.map(String);
    const group = head === "principal" || head === "organization" || head === "proxy" ? head : "root";
    const key = group === "root" ? head : field;
    if (key) out[group][key] ??= i.message;
  }
  return out;
}

export const hasIssues = (g: GroupedIssues) => Object.values(g).some((m) => Object.keys(m).length > 0);
