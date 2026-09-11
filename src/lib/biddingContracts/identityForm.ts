// Form danh tính khi mua hồ sơ tham gia: schema Zod + giá trị điền sẵn + quy đổi
// sang tham số RPC start_bidding_contract.
//
// Luật ở đây là BÁO SỚM; nguồn sự thật là các RAISE trong start_bidding_contract
// và CHECK trên auction_bidding_contracts. Sửa một bên nên sửa cả hai.

import { z } from "zod";
import type { Gender, IdType, VerifiedIdentity } from "@/types/bidding-contract";

export const normalizeIdNumber = (v: string) => v.replace(/\s/g, "").toUpperCase();

export const identityFormSchema = z
  .object({
    full_name: z.string().trim().min(3, "Họ tên tối thiểu 3 ký tự"),
    id_type: z.enum(["cccd", "passport"]),
    id_number: z.string().trim().min(1, "Nhập số giấy tờ"),
    date_of_birth: z.string().optional(),
    gender: z.enum(["male", "female", ""]).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^0[0-9]{9}$/, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0"),
    email: z.string().trim().email("Email không hợp lệ"),
    address: z.string().trim().min(5, "Vui lòng nhập địa chỉ liên hệ"),
    consent: z.boolean().refine((v) => v, "Vui lòng đồng ý chia sẻ thông tin với tổ chức đấu giá"),
  })
  .superRefine((v, ctx) => {
    const id = normalizeIdNumber(v.id_number);
    if (v.id_type === "cccd" && !/^[0-9]{9,12}$/.test(id)) {
      ctx.addIssue({ code: "custom", path: ["id_number"], message: "Số CCCD gồm 9–12 chữ số" });
    }
    if (v.id_type === "passport" && id.length < 6) {
      ctx.addIssue({ code: "custom", path: ["id_number"], message: "Số hộ chiếu tối thiểu 6 ký tự" });
    }
  });

export type IdentityFormValues = z.infer<typeof identityFormSchema>;

/** Số điện thoại Supabase Auth lưu dạng "84912345678" → "0912345678". */
export function toLocalPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (/^84[0-9]{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return /^0[0-9]{9}$/.test(digits) ? digits : "";
}

interface LastContract {
  full_name: string;
  id_type: IdType;
  id_number: string;
  date_of_birth: string | null;
  gender: Gender | null;
  phone: string;
  email: string;
  address: string;
}

interface DefaultsInput {
  profileName?: string | null;
  authEmail?: string | null;
  authPhone?: string | null;
  verified?: VerifiedIdentity | null;
  /** Hồ sơ gần nhất của chính người mua — điền lại SĐT / email / địa chỉ đã dùng. */
  last?: LastContract | null;
}

/** Ưu tiên: danh tính VNeID > hồ sơ gần nhất > profile / tài khoản. */
export function identityDefaults({ profileName, authEmail, authPhone, verified, last }: DefaultsInput): IdentityFormValues {
  const base: IdentityFormValues = {
    full_name: last?.full_name ?? profileName?.trim() ?? "",
    id_type: last?.id_type ?? "cccd",
    id_number: last?.id_number ?? "",
    date_of_birth: last?.date_of_birth ?? "",
    gender: last?.gender ?? "",
    phone: last?.phone ?? toLocalPhone(authPhone),
    email: last?.email ?? authEmail ?? "",
    address: last?.address ?? "",
    consent: false,
  };
  return verified ? applyVerifiedIdentity(base, verified) : base;
}

/** Ghi đè các trường VNeID cung cấp; SĐT / email giữ nguyên người dùng nhập. */
export function applyVerifiedIdentity(values: IdentityFormValues, v: VerifiedIdentity): IdentityFormValues {
  return {
    ...values,
    full_name: v.full_name,
    id_type: "cccd",
    id_number: v.id_number,
    date_of_birth: v.date_of_birth,
    gender: v.gender ?? "",
    address: v.address,
  };
}

/**
 * Form còn khớp bản VNeID không — cùng quy tắc server dùng để gắn
 * identity_source = 'vneid' (CCCD + họ tên, không phân biệt hoa thường).
 */
export function matchesVerifiedIdentity(values: Pick<IdentityFormValues, "full_name" | "id_type" | "id_number">, v: VerifiedIdentity | null | undefined): boolean {
  if (!v || values.id_type !== "cccd") return false;
  return (
    normalizeIdNumber(values.id_number) === v.id_number &&
    values.full_name.trim().toLowerCase() === v.full_name.trim().toLowerCase()
  );
}

export type StartContractArgs = ReturnType<typeof identityToRpcArgs>;

export function identityToRpcArgs(sessionId: string, v: IdentityFormValues) {
  return {
    _session_id: sessionId,
    _full_name: v.full_name.trim(),
    _id_type: v.id_type,
    _id_number: normalizeIdNumber(v.id_number),
    _phone: v.phone.trim(),
    _email: v.email.trim(),
    _address: v.address.trim(),
    _date_of_birth: v.date_of_birth || undefined,
    _gender: v.gender || undefined,
  };
}
