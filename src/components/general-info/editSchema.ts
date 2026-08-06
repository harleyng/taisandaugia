// Schema + giá trị mặc định cho form Thông tin chung.
//
// Tách khỏi EditInfoSheet.tsx để file component chỉ xuất component (rule
// react-refresh/only-export-components). ThongTinChungPage cần cả hai mà không
// cần render sheet.

import { z } from 'zod'
import type { OrgGeneralInfo } from '@/types/general-info'

export const editSchema = z.object({
  name: z.string().min(2, 'Tên công ty phải có ít nhất 2 ký tự'),
  shortName: z.string().optional(),
  orgType: z.enum(['TRUNG_TAM_DV', 'CONG_TY_HOP_DANH', 'DN_TU_NHAN']),
  taxCode: z.string().min(10, 'MST phải có 10 chữ số').max(13),
  registrationCode: z.string().optional(),
  logoUrl: z.string().optional(),
  address: z.string().min(3, 'Vui lòng nhập địa chỉ'),
  ward: z.string().optional(),
  district: z.string().optional(),
  province: z.string().min(1, 'Vui lòng chọn tỉnh/TP'),
  phone: z.string().regex(/^0[0-9]{9}$/, 'Số điện thoại không hợp lệ (VD: 0971234567)'),
  alternativePhone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email('Email không hợp lệ'),
  alternativeEmail: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  website: z.string().url('URL không hợp lệ (bắt đầu bằng https://)').optional().or(z.literal('')),

  legalRepName: z.string().min(3, 'Họ tên phải có ít nhất 3 ký tự'),
  legalRepPosition: z.string().optional(),
  legalRepIdNumber: z.string().optional(),
  legalRepIdIssuedDate: z.string().optional(),
  legalRepIdIssuedPlace: z.string().optional(),

  foundedDate: z.string().min(1, 'Vui lòng nhập ngày thành lập'),
  establishmentDecisionNumber: z.string().optional(),
  establishmentDecisionDate: z.string().optional(),
  establishmentDecisionIssuer: z.string().optional(),
  establishmentDecisionFile: z.string().optional(),
  businessLicenseNumber: z.string().optional(),
  businessLicenseDate: z.string().optional(),
  businessLicenseIssuer: z.string().optional(),
  businessLicenseFile: z.string().optional(),
})

export type EditFormValues = z.infer<typeof editSchema>

export function buildDefaults(info: OrgGeneralInfo): EditFormValues {
  return {
    name: info.name ?? '',
    shortName: info.shortName ?? '',
    orgType: info.orgType ?? 'CONG_TY_HOP_DANH',
    taxCode: info.taxCode ?? '',
    registrationCode: info.registrationCode ?? '',
    logoUrl: info.logoUrl ?? '',
    address: info.address ?? '',
    ward: info.ward ?? '',
    district: info.district ?? '',
    province: info.province ?? '',
    phone: info.phone ?? '',
    alternativePhone: info.alternativePhone ?? '',
    fax: info.fax ?? '',
    email: info.email ?? '',
    alternativeEmail: info.alternativeEmail ?? '',
    website: info.website ?? '',
    legalRepName: info.legalRepName ?? '',
    legalRepPosition: info.legalRepPosition ?? '',
    legalRepIdNumber: info.legalRepIdNumber ?? '',
    legalRepIdIssuedDate: info.legalRepIdIssuedDate ?? '',
    legalRepIdIssuedPlace: info.legalRepIdIssuedPlace ?? '',
    foundedDate: info.foundedDate ?? '',
    establishmentDecisionNumber: info.establishmentDecisionNumber ?? '',
    establishmentDecisionDate: info.establishmentDecisionDate ?? '',
    establishmentDecisionIssuer: info.establishmentDecisionIssuer ?? '',
    establishmentDecisionFile: info.establishmentDecisionFile ?? '',
    businessLicenseNumber: info.businessLicenseNumber ?? '',
    businessLicenseDate: info.businessLicenseDate ?? '',
    businessLicenseIssuer: info.businessLicenseIssuer ?? '',
    businessLicenseFile: info.businessLicenseFile ?? '',
  }
}
