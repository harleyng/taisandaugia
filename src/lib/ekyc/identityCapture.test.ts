import { describe, expect, it } from "vitest";
import type { KycValues } from "./editedFields";
import { applyRead, editField } from "./identityCapture";
import { kycProfileDefaults, makeKycProfileSchema, toSaveIdPhotoInput, type KycProfileValues } from "./kycProfileForm";

const NOW = new Date("2026-10-08T00:00:00Z");

const decoded: KycValues = {
  full_name: "Nguyễn Văn An",
  id_number: "001099012345",
  date_of_birth: "1985-04-12",
  gender: "male",
  address: "Số 12 Phố Huế, Hà Nội",
  id_issued_on: null,
};

const blank = (): KycProfileValues => kycProfileDefaults(null, "An");

describe("applyRead", () => {
  it("điền trường đọc được, giữ trường đọc hỏng, xoá cờ cũ", () => {
    const start = { ...blank(), id_issued_on: "2020-01-01", edited_fields: ["address"] };
    const next = applyRead(start, { method: "qr", values: decoded });
    expect(next).toMatchObject({
      full_name: "Nguyễn Văn An",
      id_number: "001099012345",
      gender: "male",
      id_issued_on: "2020-01-01",
      read_method: "qr",
      edited_fields: [],
    });
  });

  it("không đọc được ⇒ giữ ô, chuyển sang tự nhập", () => {
    const start = { ...blank(), full_name: "Trần B", read_method: "qr" as const, edited_fields: ["full_name"] };
    expect(applyRead(start, null)).toMatchObject({ full_name: "Trần B", read_method: "typed", edited_fields: [] });
  });
});

describe("editField", () => {
  const read = applyRead(blank(), { method: "qr", values: decoded });

  it("so với bản đọc: sửa rồi sửa lại như cũ ⇒ hết cờ", () => {
    const edited = editField(read, "address", "Số 14 Phố Huế, Hà Nội", decoded);
    expect(edited.edited_fields).toEqual(["address"]);
    expect(editField(edited, "address", "Số 12 Phố Huế, Hà Nội", decoded).edited_fields).toEqual([]);
  });

  it("trường không thuộc danh sách theo dõi ⇒ không gắn cờ", () => {
    expect(editField(read, "id_front_path", "u/x.jpg", decoded).edited_fields).toEqual([]);
  });

  it("không còn bản đọc (mở lại danh tính đã lưu) ⇒ sửa trường nào gắn cờ trường đó", () => {
    const saved = { ...read, edited_fields: ["address"] };
    expect(editField(saved, "full_name", "Nguyễn Văn Ân", null).edited_fields).toEqual(["full_name", "address"]);
    // Gõ lại y nguyên ⇒ không phải sửa.
    expect(editField(saved, "full_name", "Nguyễn Văn An", null).edited_fields).toEqual(["address"]);
  });

  it("tự nhập ⇒ không bao giờ gắn cờ", () => {
    expect(editField(blank(), "full_name", "Lê C", null).edited_fields).toEqual([]);
  });
});

describe("makeKycProfileSchema", () => {
  const schema = makeKycProfileSchema(NOW);
  const valid: KycProfileValues = {
    ...applyRead(blank(), { method: "qr", values: decoded }),
    id_front_path: "u/front.jpg",
    id_back_path: "u/back.jpg",
    id_issued_on: "2021-08-15",
  };
  const fields = (v: KycProfileValues) => {
    const r = schema.safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("đủ thông tin ⇒ hợp lệ", () => {
    expect(fields(valid)).toEqual([]);
  });

  it("ảnh luôn bắt buộc; hộ chiếu không cần mặt sau", () => {
    expect(fields({ ...valid, id_front_path: null, id_back_path: null })).toEqual(["id_front_path", "id_back_path"]);
    expect(fields({ ...valid, id_type: "passport", id_number: "C1234567", id_back_path: null })).toEqual([]);
  });

  it("ngày sinh bắt buộc, ngày cấp không trước ngày sinh / không ở tương lai", () => {
    expect(fields({ ...valid, date_of_birth: "" })).toEqual(["date_of_birth"]);
    expect(fields({ ...valid, id_issued_on: "1980-01-01" })).toEqual(["id_issued_on"]);
    expect(fields({ ...valid, id_issued_on: "2027-01-01" })).toEqual(["id_issued_on"]);
  });
});

describe("toSaveIdPhotoInput", () => {
  it("chuẩn hoá số giấy tờ, bỏ mặt sau của hộ chiếu, trường rỗng ⇒ null", () => {
    const v: KycProfileValues = {
      ...blank(),
      full_name: " Lê Thị C ",
      id_type: "passport",
      id_number: "c 123 4567",
      date_of_birth: "1990-01-01",
      address: "Hà Nội, Việt Nam",
      id_front_path: "u/f.jpg",
      id_back_path: "u/b.jpg",
      edited_fields: ["full_name", "bogus"],
    };
    expect(toSaveIdPhotoInput(v)).toEqual({
      id_type: "passport",
      id_number: "C1234567",
      full_name: "Lê Thị C",
      date_of_birth: "1990-01-01",
      address: "Hà Nội, Việt Nam",
      id_front_path: "u/f.jpg",
      id_back_path: null,
      gender: null,
      id_issued_on: null,
      read_method: "typed",
      edited_fields: ["full_name"],
    });
  });

  it("danh tính VNeID đã lưu mở ra không có ảnh ⇒ phải chụp", () => {
    const v = kycProfileDefaults({
      source: "vneid",
      full_name: "Nguyễn Văn An",
      id_number: "001099012345",
      date_of_birth: "1985-04-12",
      gender: "male",
      address: "Hà Nội",
      id_issued_on: "2021-08-15",
    });
    expect(v).toMatchObject({ id_front_path: null, read_method: "typed", id_issued_on: "2021-08-15" });
  });
});
