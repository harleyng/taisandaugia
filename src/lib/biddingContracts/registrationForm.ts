// Form đăng ký tham gia đấu giá (trang /sessions/:id/dang-ky): người đăng ký là
// cá nhân hoặc tổ chức, khối danh tính dùng lại cho người đăng ký / người đại diện
// theo pháp luật / người được uỷ quyền, rồi quy đổi sang payload JSONB của
// start_bidding_contract(_session_id, _payload) và resubmit_bidding_contract.
//
// Luật ở đây là BÁO SỚM; nguồn sự thật là _bidding_parties_from_payload + CHECK
// abc_org_shape / abc_proxy_shape / abc_images_shape
// (supabase/migrations/20261008100100_bidding_contract_parties.sql). Sửa một bên
// nên sửa cả hai.

import { z } from "zod";
import type {
  Gender,
  IdType,
  IdentityPayload,
  RegistrationPayload,
  SavedIdentitySource,
} from "@/types/bidding-contract";
import { KYC_EDITABLE_FIELDS, type KycField, type ReadMethod } from "@/lib/ekyc/editedFields";
export const normalizeIdNumber = (v: string) => v.replace(/\s/g, "").toUpperCase();

/** Số điện thoại Supabase Auth lưu dạng "84912345678" → "0912345678". */
export function toLocalPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (/^84[0-9]{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return /^0[0-9]{9}$/.test(digits) ? digits : "";
}

export const normalizeTaxCode = (v: string) => v.replace(/[\s-]/g, "");

const PHONE_RE = /^0[0-9]{9}$/;
const TAX_CODE_RE = /^[0-9]{10}([0-9]{3})?$/;

const identityShape = {
  full_name: z.string(),
  id_type: z.enum(["cccd", "passport"]),
  id_number: z.string(),
  date_of_birth: z.string(),
  gender: z.enum(["male", "female", ""]),
  address: z.string(),
  id_front_path: z.string().nullable(),
  id_back_path: z.string().nullable(),
  read_method: z.enum(["qr", "ocr", "typed"]),
  edited_fields: z.array(z.string()),
};

const identityBlock = z.object(identityShape);
/** Khối danh tính dùng lại cho form khác (danh tính lưu trên hồ sơ — kycProfileForm). */
export const identityBlockSchema = identityBlock;
const proxyBlock = z.object({ ...identityShape, phone: z.string(), poa_doc_path: z.string().nullable() });

const baseSchema = z.object({
  buyer_kind: z.enum(["individual", "organization"]),
  phone: z.string(),
  email: z.string(),
  principal: identityBlock,
  organization: z.object({
    name: z.string(),
    tax_code: z.string(),
    address: z.string(),
    reg_doc_path: z.string().nullable(),
  }),
  /** self = chính người đăng ký / người đại diện theo pháp luật dự phiên. */
  attendee: z.enum(["self", "proxy"]),
  proxy: proxyBlock,
  consent: z.boolean(),
});

export type IdentityBlockValues = z.infer<typeof identityBlock>;
export type ProxyBlockValues = z.infer<typeof proxyBlock>;
export type RegistrationFormValues = z.infer<typeof baseSchema>;

/** Danh tính VNeID đã lưu — tối thiểu để biết người đăng ký có được miễn ảnh không. */
export interface VneidRef {
  full_name: string;
  id_number: string;
}

/** Cùng quy tắc server gắn identity_source = 'vneid': CCCD + họ tên, không phân biệt hoa thường. */
export function matchesVneid(v: Pick<IdentityBlockValues, "full_name" | "id_type" | "id_number">, vneid: VneidRef | null | undefined): boolean {
  if (!vneid || v.id_type !== "cccd") return false;
  return (
    normalizeIdNumber(v.id_number) === vneid.id_number &&
    v.full_name.trim().toLowerCase() === vneid.full_name.trim().toLowerCase()
  );
}

/** Ngày sinh hợp lệ khi đủ 14 tuổi và không trước 1900 — như _kyc_check_identity. */
function dobOk(iso: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(iso))) return false;
  const p = (n: number) => String(n).padStart(2, "0");
  const cutoff = `${now.getFullYear() - 14}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  return iso >= "1900-01-01" && iso <= cutoff;
}

type Ctx = z.RefinementCtx;

/** Kiểm một khối danh tính; `who` nêu "của ai" trong câu báo lỗi giống server. */
export function checkIdentity(ctx: Ctx, at: string[], v: IdentityBlockValues, who: string, imagesRequired: boolean, now: Date) {
  const issue = (field: string, message: string) => ctx.addIssue({ code: "custom", path: [...at, field], message });
  const id = normalizeIdNumber(v.id_number);

  if (v.full_name.trim().length < 3) issue("full_name", "Họ tên tối thiểu 3 ký tự");
  if (v.id_type === "cccd" && !/^[0-9]{9,12}$/.test(id)) issue("id_number", "Số CCCD gồm 9–12 chữ số");
  if (v.id_type === "passport" && id.length < 6) issue("id_number", "Số hộ chiếu tối thiểu 6 ký tự");
  if (v.address.trim().length < 5) issue("address", `Vui lòng nhập địa chỉ của ${who}`);
  if (v.date_of_birth && !dobOk(v.date_of_birth, now)) issue("date_of_birth", `Ngày sinh của ${who} không hợp lệ`);

  if (!imagesRequired) return;
  if (!v.id_front_path) issue("id_front_path", `Vui lòng tải ảnh mặt trước giấy tờ của ${who}`);
  if (v.id_type === "cccd" && !v.id_back_path) issue("id_back_path", `Vui lòng tải ảnh mặt sau CCCD của ${who}`);
}

interface SchemaOptions {
  /** Danh tính VNeID của người dùng — khớp thì người đăng ký không phải tải ảnh. */
  vneid?: VneidRef | null;
  now?: Date;
}

export function makeRegistrationSchema({ vneid = null, now = new Date() }: SchemaOptions = {}) {
  return baseSchema.superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const org = v.buyer_kind === "organization";
    const who = org ? "người đại diện theo pháp luật" : "người đăng ký";

    if (!PHONE_RE.test(v.phone.trim())) issue(["phone"], "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0");
    if (!z.string().email().safeParse(v.email.trim()).success) issue(["email"], "Email không hợp lệ");

    checkIdentity(ctx, ["principal"], v.principal, who, !matchesVneid(v.principal, vneid), now);

    if (org) {
      const o = v.organization;
      if (o.name.trim().length < 3) issue(["organization", "name"], "Tên tổ chức tối thiểu 3 ký tự");
      if (!TAX_CODE_RE.test(normalizeTaxCode(o.tax_code))) issue(["organization", "tax_code"], "Mã số thuế gồm 10 hoặc 13 chữ số");
      if (o.address.trim().length < 5) issue(["organization", "address"], "Vui lòng nhập địa chỉ trụ sở tổ chức");
      if (!o.reg_doc_path) issue(["organization", "reg_doc_path"], "Vui lòng tải giấy chứng nhận đăng ký doanh nghiệp");
    }

    if (v.attendee === "proxy") {
      const x = v.proxy;
      checkIdentity(ctx, ["proxy"], x, "người được uỷ quyền", true, now);
      if (!PHONE_RE.test(x.phone.trim())) {
        issue(["proxy", "phone"], "Số điện thoại người được uỷ quyền gồm 10 chữ số, bắt đầu bằng 0");
      }
      if (x.id_number.trim() && normalizeIdNumber(x.id_number) === normalizeIdNumber(v.principal.id_number)) {
        issue(["proxy", "id_number"], `Người được uỷ quyền phải là người khác với ${who}`);
      }
      if (!x.poa_doc_path) issue(["proxy", "poa_doc_path"], "Vui lòng tải giấy uỷ quyền");
    }

    if (!v.consent) issue(["consent"], "Vui lòng đồng ý chia sẻ thông tin với tổ chức đấu giá");
  });
}

// ─── Giá trị mặc định ─────────────────────────────────────────────────────────

export const emptyIdentity = (): IdentityBlockValues => ({
  full_name: "",
  id_type: "cccd",
  id_number: "",
  date_of_birth: "",
  gender: "",
  address: "",
  id_front_path: null,
  id_back_path: null,
  read_method: "typed",
  edited_fields: [],
});

const emptyProxy = (): ProxyBlockValues => ({ ...emptyIdentity(), phone: "", poa_doc_path: null });

/**
 * Danh tính đã lưu trên hồ sơ người dùng (user_verified_identities). Ảnh của
 * nguồn 'id_photo' được DÙNG LẠI nguyên đường dẫn — server chỉ đòi ảnh nằm trong
 * thư mục của người gọi và đã tải lên thật.
 */
export interface SavedIdentity {
  source: SavedIdentitySource;
  id_type?: IdType | null;
  full_name: string;
  id_number: string;
  date_of_birth: string | null;
  gender: Gender | null;
  address: string;
  id_front_path?: string | null;
  id_back_path?: string | null;
  read_method?: ReadMethod | null;
  edited_fields?: string[] | null;
}

/** Điền khối danh tính từ bản đã lưu (nút "Dùng danh tính đã lưu"). */
export function applySavedIdentity(saved: SavedIdentity): IdentityBlockValues {
  const photo = saved.source === "id_photo";
  return {
    full_name: saved.full_name,
    id_type: saved.id_type ?? "cccd",
    id_number: saved.id_number,
    date_of_birth: saved.date_of_birth ?? "",
    gender: saved.gender ?? "",
    address: saved.address,
    id_front_path: photo ? (saved.id_front_path ?? null) : null,
    id_back_path: photo ? (saved.id_back_path ?? null) : null,
    read_method: photo ? (saved.read_method ?? "typed") : "typed",
    edited_fields: photo ? (saved.edited_fields ?? []) : [],
  };
}

interface DefaultsInput {
  profileName?: string | null;
  authEmail?: string | null;
  authPhone?: string | null;
  saved?: SavedIdentity | null;
  /** Hồ sơ gần nhất của chính người mua — điền lại SĐT / email liên hệ đã dùng. */
  last?: { phone: string; email: string } | null;
}

/**
 * Ưu tiên: danh tính đã lưu > profile / tài khoản; liên hệ: hồ sơ gần nhất >
 * tài khoản. Mặc định cá nhân tự dự phiên.
 */
export function registrationDefaults({ profileName, authEmail, authPhone, saved, last }: DefaultsInput = {}): RegistrationFormValues {
  return {
    buyer_kind: "individual",
    phone: last?.phone || toLocalPhone(authPhone),
    email: last?.email || (authEmail ?? ""),
    principal: saved ? applySavedIdentity(saved) : { ...emptyIdentity(), full_name: profileName?.trim() ?? "" },
    organization: { name: "", tax_code: "", address: "", reg_doc_path: null },
    attendee: "self",
    proxy: emptyProxy(),
    consent: false,
  };
}

// ─── Payload gửi server (RegistrationPayload ở src/types/bidding-contract.ts) ──

const isKycField = (f: string): f is KycField => (KYC_EDITABLE_FIELDS as readonly string[]).includes(f);

function identityPayload(v: IdentityBlockValues): IdentityPayload {
  const hasImages = Boolean(v.id_front_path || v.id_back_path);
  return {
    full_name: v.full_name.trim(),
    id_type: v.id_type,
    id_number: normalizeIdNumber(v.id_number),
    date_of_birth: v.date_of_birth || undefined,
    gender: v.gender || undefined,
    address: v.address.trim(),
    // Không có ảnh (khớp VNeID) ⇒ không gửi cách đọc: server để NULL.
    ...(hasImages
      ? {
          id_front_path: v.id_front_path ?? undefined,
          // Hộ chiếu chỉ có trang thông tin ⇒ bỏ mặt sau còn sót khi đổi loại giấy tờ.
          id_back_path: v.id_type === "cccd" ? (v.id_back_path ?? undefined) : undefined,
          read_method: v.read_method,
          edited_fields: v.edited_fields.filter(isKycField),
        }
      : {}),
  };
}

/** Chỉ gửi khối đang dùng: tổ chức khi organization, người được uỷ quyền khi attendee = proxy. */
export function toStartPayload(v: RegistrationFormValues): RegistrationPayload {
  const o = v.organization;
  return {
    buyer_kind: v.buyer_kind,
    phone: v.phone.trim(),
    email: v.email.trim(),
    principal: identityPayload(v.principal),
    ...(v.buyer_kind === "organization"
      ? {
          organization: {
            name: o.name.trim(),
            tax_code: normalizeTaxCode(o.tax_code),
            address: o.address.trim(),
            reg_doc_path: o.reg_doc_path ?? "",
          },
        }
      : {}),
    proxy:
      v.attendee === "proxy"
        ? {
            ...identityPayload(v.proxy),
            id_front_path: v.proxy.id_front_path ?? "",
            phone: v.proxy.phone.trim(),
            poa_doc_path: v.proxy.poa_doc_path ?? "",
          }
        : null,
  };
}
