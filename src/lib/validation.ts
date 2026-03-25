import { z } from "zod";

// Authentication validation
export const authSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email là bắt buộc")
    .email("Email không hợp lệ")
    .max(255, "Email không được vượt quá 255 ký tự"),
  password: z
    .string()
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
    .max(128, "Mật khẩu không được vượt quá 128 ký tự"),
  name: z
    .string()
    .trim()
    .min(2, "Tên phải có ít nhất 2 ký tự")
    .max(100, "Tên không được vượt quá 100 ký tự")
    .optional(),
});

// Contact information validation
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên liên hệ phải có ít nhất 2 ký tự")
    .max(100, "Tên liên hệ không được vượt quá 100 ký tự"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,15}$/, "Số điện thoại không hợp lệ")
    .max(15, "Số điện thoại không được vượt quá 15 ký tự"),
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .max(255, "Email không được vượt quá 255 ký tự"),
});

// Listing validation
export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "Tiêu đề phải có ít nhất 10 ký tự")
    .max(200, "Tiêu đề không được vượt quá 200 ký tự"),
  description: z
    .string()
    .trim()
    .max(5000, "Mô tả không được vượt quá 5000 ký tự")
    .optional(),
  price: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Giá không hợp lệ"),
  area: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Diện tích không hợp lệ"),
  province: z
    .string()
    .trim()
    .min(1, "Tỉnh/Thành phố là bắt buộc")
    .max(100, "Tỉnh/Thành phố không được vượt quá 100 ký tự"),
  district: z
    .string()
    .trim()
    .min(1, "Quận/Huyện là bắt buộc")
    .max(100, "Quận/Huyện không được vượt quá 100 ký tự"),
  ward: z
    .string()
    .trim()
    .min(1, "Phường/Xã là bắt buộc")
    .max(100, "Phường/Xã không được vượt quá 100 ký tự"),
  street: z
    .string()
    .trim()
    .min(1, "Đường/Số nhà là bắt buộc")
    .max(200, "Đường/Số nhà không được vượt quá 200 ký tự"),
  projectName: z
    .string()
    .trim()
    .max(200, "Tên dự án không được vượt quá 200 ký tự")
    .optional(),
  prominentFeatures: z
    .string()
    .trim()
    .max(500, "Đặc điểm nổi bật không được vượt quá 500 ký tự")
    .optional(),
});

// Organization validation - enhanced
export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên tổ chức là bắt buộc")
    .max(200, "Tên tổ chức không được vượt quá 200 ký tự"),
  taxId: z
    .string()
    .trim()
    .min(1, "Mã số thuế là bắt buộc")
    .max(20, "Mã số thuế không được vượt quá 20 ký tự")
    .regex(/^[0-9\-]+$/, "Mã số thuế chỉ được chứa số và dấu gạch ngang"),
  businessLicenseNumber: z
    .string()
    .trim()
    .min(1, "Số giấy phép kinh doanh là bắt buộc")
    .max(50, "Số giấy phép không được vượt quá 50 ký tự"),
  address: z
    .string()
    .trim()
    .min(1, "Địa chỉ trụ sở là bắt buộc")
    .max(500, "Địa chỉ không được vượt quá 500 ký tự"),
  legalRepresentative: z
    .string()
    .trim()
    .min(1, "Người đại diện pháp luật là bắt buộc")
    .max(100, "Tên người đại diện không được vượt quá 100 ký tự"),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Số điện thoại là bắt buộc")
    .regex(/^[0-9+\-\s()]{8,15}$/, "Số điện thoại không hợp lệ"),
  registrationDate: z.string().optional(),
});

// Sanitization helper
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .slice(0, 10000); // Hard limit
}
