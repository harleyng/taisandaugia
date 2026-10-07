// Chia form đăng ký tham gia đấu giá (trang /sessions/:id/dang-ky) thành 4 bước
// và quyết định lỗi nào chặn bước nào. Cả form dùng MỘT schema
// (makeRegistrationSchema); bước chỉ là cách lọc lỗi để báo đúng chỗ.
//
// Kèm luật "Lưu danh tính vào hồ sơ của tôi" sau lần KYC đầu tiên: chỉ người
// đăng ký CÁ NHÂN (người đại diện của tổ chức chưa chắc là chủ tài khoản), chỉ
// khi tài khoản chưa có danh tính lưu, và phải qua schema của save_id_photo_identity
// (ngày sinh bắt buộc) — lỗi đó báo ngay ở bước Danh tính.

import { makeKycProfileSchema, toSaveIdPhotoInput, type SaveIdPhotoInput } from "@/lib/ekyc/kycProfileForm";
import type { IdentityBlockValues, RegistrationFormValues } from "./registrationForm";
import type { GroupedIssues } from "./resubmitForm";

export const REGISTRATION_STEPS = [
  { key: "registrant", title: "Người đăng ký" },
  { key: "identity", title: "Danh tính" },
  { key: "attendee", title: "Người dự phiên" },
  { key: "confirm", title: "Xác nhận" },
] as const;

export type RegistrationStepIndex = 0 | 1 | 2 | 3;
export const LAST_STEP: RegistrationStepIndex = 3;

/** Ô gốc (không thuộc khối) ⇒ bước của nó. */
const ROOT_FIELD_STEP: Record<string, RegistrationStepIndex> = {
  buyer_kind: 0,
  phone: 0,
  email: 0,
  attendee: 2,
  consent: 3,
};

const GROUP_STEP: Record<Exclude<keyof GroupedIssues, "root">, RegistrationStepIndex> = {
  organization: 0,
  principal: 1,
  proxy: 2,
};

export const emptyIssues = (): GroupedIssues => ({ root: {}, principal: {}, organization: {}, proxy: {} });

/** Chỉ giữ lỗi thuộc một bước. */
export function issuesForStep(g: GroupedIssues, step: RegistrationStepIndex): GroupedIssues {
  const out = emptyIssues();
  for (const [field, msg] of Object.entries(g.root)) {
    if ((ROOT_FIELD_STEP[field] ?? LAST_STEP) === step) out.root[field] = msg;
  }
  for (const group of Object.keys(GROUP_STEP) as (keyof typeof GROUP_STEP)[]) {
    if (GROUP_STEP[group] === step) out[group] = { ...g[group] };
  }
  return out;
}

/** Bước đầu tiên còn lỗi (để nhảy về khi bấm xác nhận) — null nếu sạch. */
export function firstStepWithIssues(g: GroupedIssues): RegistrationStepIndex | null {
  for (const s of [0, 1, 2, 3] as RegistrationStepIndex[]) {
    const sub = issuesForStep(g, s);
    if (Object.values(sub).some((m) => Object.keys(m).length > 0)) return s;
  }
  return null;
}

// ─── Lưu danh tính vào hồ sơ người dùng ─────────────────────────────────────────

/** Có hỏi "Lưu danh tính vào hồ sơ của tôi" không. */
export function canOfferProfileSave(v: RegistrationFormValues, hasSavedIdentity: boolean): boolean {
  return v.buyer_kind === "individual" && !hasSavedIdentity;
}

type PrincipalWithIssued = IdentityBlockValues & { id_issued_on?: string };

/** Lỗi của khối danh tính theo luật lưu hồ sơ (ngày sinh, ngày cấp…). Lỗi đầu tiên mỗi ô thắng. */
export function profileSaveIssues(p: PrincipalWithIssued, now = new Date()): Record<string, string> {
  const r = makeKycProfileSchema(now).safeParse({ ...p, id_issued_on: p.id_issued_on ?? "" });
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const i of r.error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/** Tham số save_id_photo_identity từ người đăng ký, hoặc null nếu chưa đủ điều kiện lưu. */
export function profileSaveInput(p: PrincipalWithIssued, now = new Date()): SaveIdPhotoInput | null {
  if (Object.keys(profileSaveIssues(p, now)).length > 0) return null;
  return toSaveIdPhotoInput({ ...p, id_issued_on: p.id_issued_on ?? "" });
}

/** Gộp lỗi lưu hồ sơ vào khối principal (lỗi của form đăng ký giữ ưu tiên). */
export function withProfileSaveIssues(g: GroupedIssues, p: PrincipalWithIssued, now = new Date()): GroupedIssues {
  return { ...g, principal: { ...profileSaveIssues(p, now), ...g.principal } };
}
