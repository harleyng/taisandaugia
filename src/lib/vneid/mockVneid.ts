// Kho dữ liệu giả của "VNeID" — CÔNG DÂN BỊA, sinh tất định theo userId.
//
// XOÁ NGUYÊN FILE khi tích hợp VNeID thật: seam nằm ở useVneidIdentity (hook),
// không phải ở đây. Mọi thứ trả về phải khớp CHECK của user_verified_identities
// (CCCD đúng 12 chữ số, địa chỉ ≥ 5 ký tự) — nếu không, bước lưu sẽ vỡ.
//
// Cấu trúc số CCCD 12 chữ số (TT 59/2021/TT-BCA): 3 số mã tỉnh nơi đăng ký khai
// sinh + 1 số giới tính/thế kỷ + 2 số cuối năm sinh + 6 số ngẫu nhiên.

import { seededInt, seededPick } from "@/lib/seededRand";

export type VneidGender = "male" | "female";

export interface VneidIdentity {
  full_name: string;
  id_number: string;
  /** YYYY-MM-DD */
  id_issued_on: string;
  /** YYYY-MM-DD */
  date_of_birth: string;
  gender: VneidGender;
  address: string;
}

const PROVINCES = [
  { code: "001", name: "Hà Nội", district: "Quận Cầu Giấy", ward: "Phường Dịch Vọng", street: "Trần Thái Tông" },
  { code: "079", name: "TP. Hồ Chí Minh", district: "Quận 3", ward: "Phường Võ Thị Sáu", street: "Nam Kỳ Khởi Nghĩa" },
  { code: "048", name: "Đà Nẵng", district: "Quận Hải Châu", ward: "Phường Thạch Thang", street: "Lê Duẩn" },
  { code: "031", name: "Hải Phòng", district: "Quận Lê Chân", ward: "Phường An Biên", street: "Tô Hiệu" },
  { code: "092", name: "Cần Thơ", district: "Quận Ninh Kiều", ward: "Phường Tân An", street: "Hai Bà Trưng" },
  { code: "075", name: "Đồng Nai", district: "TP. Biên Hoà", ward: "Phường Tân Phong", street: "Đồng Khởi" },
] as const;

const FAMILY = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Phan"] as const;
const MIDDLE: Record<VneidGender, readonly string[]> = {
  male: ["Văn", "Minh", "Đức", "Quốc", "Hữu"],
  female: ["Thị", "Ngọc", "Thu", "Minh", "Thanh"],
};
const GIVEN: Record<VneidGender, readonly string[]> = {
  male: ["Anh", "Hùng", "Dũng", "Khang", "Phúc", "Long", "Tuấn"],
  female: ["Lan", "Hương", "Trang", "Linh", "Mai", "Hà", "Ngân"],
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Hồ sơ công dân VNeID giả cho một tài khoản. Có tên trong profile thì dùng tên
 * đó (người dùng nhận ra chính mình), không thì bịa theo giới tính.
 */
export function mockVneidIdentity(userId: string, profileName?: string | null): VneidIdentity {
  const gender: VneidGender = seededInt(userId, "gender", 0, 1) === 0 ? "male" : "female";
  const province = seededPick(PROVINCES, userId, "province") ?? PROVINCES[0];

  const year = seededInt(userId, "birth-year", 1965, 2003);
  const dob = `${year}-${pad2(seededInt(userId, "birth-month", 1, 12))}-${pad2(seededInt(userId, "birth-day", 1, 28))}`;

  // Thế kỷ 20: nam 0 / nữ 1. Thế kỷ 21: nam 2 / nữ 3.
  const centuryDigit = (year >= 2000 ? 2 : 0) + (gender === "female" ? 1 : 0);
  const serial = String(seededInt(userId, "serial", 0, 999_999)).padStart(6, "0");
  const idNumber = `${province.code}${centuryDigit}${String(year % 100).padStart(2, "0")}${serial}`;

  const issuedYear = seededInt(userId, "issued-year", 2021, 2024);
  const issuedOn = `${issuedYear}-${pad2(seededInt(userId, "issued-month", 1, 12))}-${pad2(seededInt(userId, "issued-day", 1, 28))}`;

  const trimmed = profileName?.trim() ?? "";
  const fullName =
    trimmed.length >= 3
      ? trimmed
      : [
          seededPick(FAMILY, userId, "family"),
          seededPick(MIDDLE[gender], userId, "middle"),
          seededPick(GIVEN[gender], userId, "given"),
        ].join(" ");

  const houseNo = seededInt(userId, "house", 1, 220);
  const address = `Số ${houseNo} ${province.street}, ${province.ward}, ${province.district}, ${province.name}`;

  return { full_name: fullName, id_number: idNumber, id_issued_on: issuedOn, date_of_birth: dob, gender, address };
}
