// Form "danh tính đã lưu" trên trang Hồ sơ cá nhân (KycCaptureDialog): ảnh giấy
// tờ + dữ liệu đọc QR/OCR/gõ tay ⇒ save_id_photo_identity.
//
// Dùng lại khối danh tính của form đăng ký (registrationForm) để luật hai nơi
// không lệch nhau, cộng thêm: ảnh LUÔN bắt buộc, ngày sinh bắt buộc (RPC RAISE
// khi thiếu), và ngày cấp (QR có sẵn; form đăng ký không cần).

import { z } from "zod";
import {
  applySavedIdentity,
  checkIdentity,
  emptyIdentity,
  identityBlockSchema,
  normalizeIdNumber,
  type IdentityBlockValues,
  type SavedIdentity,
} from "@/lib/biddingContracts/registrationForm";
import type { Gender, IdType } from "@/types/bidding-contract";
import { KYC_EDITABLE_FIELDS, type KycField, type ReadMethod } from "./editedFields";

/** Giá trị IdentityCapture: khối danh tính + ngày cấp ("" = chưa có). */
export type IdentityCaptureValues = IdentityBlockValues & { id_issued_on?: string };
export type KycProfileValues = IdentityBlockValues & { id_issued_on: string };

/** Tham số save_id_photo_identity (useSaveIdPhotoIdentity). */
export interface SaveIdPhotoInput {
  id_type: IdType;
  id_number: string;
  full_name: string;
  /** yyyy-mm-dd */
  date_of_birth: string;
  address: string;
  id_front_path: string;
  /** Bắt buộc với CCCD. */
  id_back_path?: string | null;
  gender?: Gender | null;
  id_issued_on?: string | null;
  read_method: ReadMethod;
  edited_fields: KycField[];
}

export function makeKycProfileSchema(now = new Date()) {
  return identityBlockSchema.extend({ id_issued_on: z.string() }).superRefine((v, ctx) => {
    checkIdentity(ctx, [], v, "bạn", true, now);
    if (!v.date_of_birth) {
      ctx.addIssue({ code: "custom", path: ["date_of_birth"], message: "Vui lòng nhập ngày sinh" });
    }
    const today = now.toISOString().slice(0, 10);
    if (v.id_issued_on && (v.id_issued_on > today || (v.date_of_birth && v.id_issued_on <= v.date_of_birth))) {
      ctx.addIssue({ code: "custom", path: ["id_issued_on"], message: "Ngày cấp không hợp lệ" });
    }
  });
}

/** Giá trị mở dialog: bản đã lưu (VNeID ⇒ không có ảnh, phải chụp) hoặc trống + tên trên profile. */
export function kycProfileDefaults(
  saved: (SavedIdentity & { id_issued_on?: string | null }) | null | undefined,
  profileName?: string | null,
): KycProfileValues {
  if (saved) return { ...applySavedIdentity(saved), id_issued_on: saved.id_issued_on ?? "" };
  return { ...emptyIdentity(), full_name: profileName?.trim() ?? "", id_issued_on: "" };
}

const isKycField = (f: string): f is KycField => (KYC_EDITABLE_FIELDS as readonly string[]).includes(f);

/** Chỉ gọi sau khi schema đã qua (ảnh mặt trước chắc chắn có). */
export function toSaveIdPhotoInput(v: KycProfileValues): SaveIdPhotoInput {
  return {
    id_type: v.id_type,
    id_number: normalizeIdNumber(v.id_number),
    full_name: v.full_name.trim(),
    date_of_birth: v.date_of_birth,
    address: v.address.trim(),
    id_front_path: v.id_front_path ?? "",
    // Hộ chiếu chỉ có trang thông tin ⇒ bỏ mặt sau còn sót khi đổi loại giấy tờ.
    id_back_path: v.id_type === "cccd" ? v.id_back_path : null,
    gender: v.gender || null,
    id_issued_on: v.id_issued_on || null,
    read_method: v.read_method,
    edited_fields: v.edited_fields.filter(isKycField),
  };
}
