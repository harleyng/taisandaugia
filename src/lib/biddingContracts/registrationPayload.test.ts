import { describe, expect, it } from "vitest";
import { contractToRegistrationPayload } from "./registrationPayload";

type Parties = Parameters<typeof contractToRegistrationPayload>[0];

const base: Parties = {
  buyer_kind: "individual",
  phone: "0912345678",
  email: "a@b.vn",
  full_name: "Nguyễn Văn A",
  id_type: "cccd",
  id_number: "001099012345",
  date_of_birth: "1990-01-01",
  gender: "male",
  address: "1 Tràng Tiền, Hà Nội",
  id_front_path: "u1/front.jpg",
  id_back_path: "u1/back.jpg",
  id_read_method: "qr",
  id_edited_fields: ["address"],
  org_name: null,
  org_tax_code: null,
  org_address: null,
  org_reg_doc_path: null,
  has_proxy: false,
  proxy_full_name: null,
  proxy_id_type: null,
  proxy_id_number: null,
  proxy_date_of_birth: null,
  proxy_gender: null,
  proxy_phone: null,
  proxy_address: null,
  proxy_id_front_path: null,
  proxy_id_back_path: null,
  proxy_id_read_method: null,
  proxy_id_edited_fields: [],
  poa_doc_path: null,
};

describe("contractToRegistrationPayload", () => {
  it("chép nguyên ảnh + cách đọc + trường đã sửa của người đăng ký", () => {
    const p = contractToRegistrationPayload(base);
    expect(p.buyer_kind).toBe("individual");
    expect(p.principal).toMatchObject({
      id_front_path: "u1/front.jpg",
      id_back_path: "u1/back.jpg",
      read_method: "qr",
      edited_fields: ["address"],
    });
    expect(p.organization).toBeNull();
    expect(p.proxy).toBeNull();
  });

  it("tổ chức + uỷ quyền đủ trường thì đi kèm", () => {
    const p = contractToRegistrationPayload({
      ...base,
      buyer_kind: "organization",
      org_name: "Công ty ABC",
      org_tax_code: "0101234567",
      org_address: "Hà Nội",
      org_reg_doc_path: "u1/dkkd.pdf",
      has_proxy: true,
      proxy_full_name: "Trần Thị B",
      proxy_id_type: "passport",
      proxy_id_number: "B1234567",
      proxy_phone: "0987654321",
      proxy_address: "Hải Phòng",
      proxy_id_front_path: "u1/pp.jpg",
      poa_doc_path: "u1/poa.pdf",
    });
    expect(p.organization).toEqual({
      name: "Công ty ABC",
      tax_code: "0101234567",
      address: "Hà Nội",
      reg_doc_path: "u1/dkkd.pdf",
    });
    expect(p.proxy).toMatchObject({ full_name: "Trần Thị B", id_back_path: null, poa_doc_path: "u1/poa.pdf" });
  });

  it("hồ sơ cũ (trước eKYC) không có ảnh ⇒ gửi null để server tự quyết", () => {
    const p = contractToRegistrationPayload({ ...base, id_front_path: null, id_back_path: null, id_read_method: null });
    expect(p.principal.id_front_path).toBeNull();
    expect(p.principal.read_method).toBeNull();
  });
});
