import { describe, expect, it } from "vitest";
import { editedFields, type KycValues } from "./editedFields";

const decoded: KycValues = {
  full_name: "NGUYỄN VĂN AN",
  id_number: "001099012345",
  date_of_birth: "1985-04-12",
  gender: "male",
  address: "Số 12 Phố Huế, Hà Nội",
  id_issued_on: "2021-08-15",
};

describe("editedFields", () => {
  it("không đổi gì ⇒ rỗng", () => {
    expect(editedFields(decoded, { ...decoded })).toEqual([]);
  });

  it("chỉ đổi hoa thường / khoảng trắng / dạng Unicode ⇒ không tính là sửa", () => {
    const final: KycValues = {
      ...decoded,
      full_name: "  Nguyễn  Văn An ".normalize("NFD"),
      id_number: "001 099 012345",
      address: "Số 12  Phố Huế,  Hà Nội",
    };
    expect(editedFields(decoded, final)).toEqual([]);
  });

  it("liệt kê đúng trường đã sửa theo thứ tự cố định", () => {
    const final: KycValues = { ...decoded, address: "Số 14 Phố Huế, Hà Nội", full_name: "Nguyễn Văn Ân" };
    expect(editedFields(decoded, final)).toEqual(["full_name", "address"]);
  });

  it("xoá trắng một trường đã đọc được cũng là sửa", () => {
    expect(editedFields(decoded, { ...decoded, gender: "" })).toEqual(["gender"]);
  });

  it("trường máy không đọc được ⇒ người dùng điền không tính là sửa", () => {
    const partial: KycValues = { ...decoded, id_issued_on: null, date_of_birth: "" };
    const final: KycValues = { ...decoded, id_issued_on: "2021-08-16", date_of_birth: "1985-04-13" };
    expect(editedFields(partial, final)).toEqual([]);
  });

  it("không có bản đọc (gõ tay) ⇒ rỗng", () => {
    expect(editedFields(null, decoded)).toEqual([]);
    expect(editedFields(undefined, decoded)).toEqual([]);
  });
});
