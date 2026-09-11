import { describe, expect, it } from "vitest";
import {
  applyVerifiedIdentity,
  identityDefaults,
  identityFormSchema,
  identityToRpcArgs,
  matchesVerifiedIdentity,
  toLocalPhone,
  type IdentityFormValues,
} from "./identityForm";
import type { Gender, VerifiedIdentity } from "@/types/bidding-contract";

const valid = (): IdentityFormValues => ({
  full_name: "Nguyễn Văn An",
  id_type: "cccd",
  id_number: "079 085 123456",
  date_of_birth: "1985-04-12",
  gender: "male",
  phone: "0912345678",
  email: "an@example.com",
  address: "12 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
  consent: true,
});

const verified: VerifiedIdentity = {
  user_id: "u1",
  source: "vneid",
  full_name: "Trần Thị Mai",
  id_number: "001190654321",
  id_issued_on: "2022-03-01",
  date_of_birth: "1990-07-20",
  gender: "female",
  address: "Số 5 Trần Thái Tông, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội",
  verified_at: "2026-09-11T00:00:00Z",
  created_at: "2026-09-11T00:00:00Z",
  updated_at: "2026-09-11T00:00:00Z",
};

const paths = (v: unknown) => {
  const r = identityFormSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("identityFormSchema", () => {
  it("dữ liệu hợp lệ thì qua (CCCD có khoảng trắng vẫn được)", () => {
    expect(paths(valid())).toEqual([]);
  });

  it("CCCD 9–12 chữ số, hộ chiếu ≥ 6 ký tự", () => {
    expect(paths({ ...valid(), id_number: "12345678" })).toContain("id_number");
    expect(paths({ ...valid(), id_number: "1234567890123" })).toContain("id_number");
    expect(paths({ ...valid(), id_type: "passport", id_number: "B123" })).toContain("id_number");
    expect(paths({ ...valid(), id_type: "passport", id_number: "B1234567" })).toEqual([]);
  });

  it("SĐT phải /^0[0-9]{9}$/, bắt buộc đồng ý chia sẻ", () => {
    expect(paths({ ...valid(), phone: "912345678" })).toContain("phone");
    expect(paths({ ...valid(), consent: false })).toContain("consent");
  });
});

describe("identityDefaults", () => {
  it("VNeID ghi đè danh tính, giữ SĐT / email từ hồ sơ trước", () => {
    const last = {
      full_name: "Nguyễn Văn An",
      id_type: "cccd" as const,
      id_number: "079085123456",
      date_of_birth: null as string | null,
      gender: null as Gender | null,
      phone: "0987654321",
      email: "an@example.com",
      address: "12 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
    };
    const d = identityDefaults({ profileName: "Mai", authEmail: "x@y.z", verified, last });
    expect(d.full_name).toBe("Trần Thị Mai");
    expect(d.id_number).toBe("001190654321");
    expect(d.phone).toBe("0987654321");
    expect(d.email).toBe("an@example.com");
    expect(d.consent).toBe(false);
  });

  it("không có gì thì lấy tên profile + email / SĐT tài khoản", () => {
    const d = identityDefaults({ profileName: " Lê Hoà ", authEmail: "hoa@x.vn", authPhone: "84912345678" });
    expect(d.full_name).toBe("Lê Hoà");
    expect(d.email).toBe("hoa@x.vn");
    expect(d.phone).toBe("0912345678");
  });
});

describe("matchesVerifiedIdentity", () => {
  it("khớp CCCD + họ tên không phân biệt hoa thường", () => {
    const v = applyVerifiedIdentity(valid(), verified);
    expect(matchesVerifiedIdentity(v, verified)).toBe(true);
    expect(matchesVerifiedIdentity({ ...v, full_name: "TRẦN THỊ MAI" }, verified)).toBe(true);
    expect(matchesVerifiedIdentity({ ...v, full_name: "Trần Mai" }, verified)).toBe(false);
    expect(matchesVerifiedIdentity({ ...v, id_type: "passport" }, verified)).toBe(false);
    expect(matchesVerifiedIdentity(v, null)).toBe(false);
  });
});

describe("toLocalPhone / identityToRpcArgs", () => {
  it("chuẩn hoá SĐT tài khoản", () => {
    expect(toLocalPhone("84912345678")).toBe("0912345678");
    expect(toLocalPhone("+84 912 345 678")).toBe("0912345678");
    expect(toLocalPhone("abc")).toBe("");
  });

  it("bỏ khoảng trắng số giấy tờ, ô trống thành undefined", () => {
    const args = identityToRpcArgs("s1", { ...valid(), date_of_birth: "", gender: "" });
    expect(args._id_number).toBe("079085123456");
    expect(args._date_of_birth).toBeUndefined();
    expect(args._gender).toBeUndefined();
  });
});
