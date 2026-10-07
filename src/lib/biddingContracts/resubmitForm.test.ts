import { describe, expect, it } from "vitest";
import { contractToRegistrationPayload } from "./registrationPayload";
import { makeRegistrationSchema, toStartPayload } from "./registrationForm";
import { contractToFormValues, groupIssues, hasIssues, type ContractParties } from "./resubmitForm";

const base: ContractParties = {
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

const withOrgAndProxy: ContractParties = {
  ...base,
  buyer_kind: "organization",
  org_name: "Công ty ABC",
  org_tax_code: "0101234567",
  org_address: "12 Láng Hạ, Hà Nội",
  org_reg_doc_path: "u1/dkkd.pdf",
  has_proxy: true,
  proxy_full_name: "Trần Thị B",
  proxy_id_type: "cccd",
  proxy_id_number: "001199054321",
  proxy_date_of_birth: "1995-05-05",
  proxy_gender: "female",
  proxy_phone: "0987654321",
  proxy_address: "3 Kim Mã, Hà Nội",
  proxy_id_front_path: "u1/pfront.jpg",
  proxy_id_back_path: "u1/pback.jpg",
  proxy_id_read_method: "typed",
  proxy_id_edited_fields: [],
  poa_doc_path: "u1/poa.pdf",
};

describe("contractToFormValues", () => {
  it("không sửa gì thì payload gửi lại trùng bản chụp đã nộp", () => {
    for (const c of [base, withOrgAndProxy]) {
      const values = contractToFormValues(c);
      // Thiếu khối tổ chức = null với server (_bidding_parties_from_payload đọc ->'organization').
      const sent = toStartPayload(values);
      expect({ ...sent, organization: sent.organization ?? null }).toEqual(contractToRegistrationPayload(c));
    }
  });

  it("giá trị điền sẵn qua được schema (đã đồng ý chia sẻ)", () => {
    const parsed = makeRegistrationSchema({ now: new Date("2026-10-08") }).safeParse(contractToFormValues(withOrgAndProxy));
    expect(parsed.success).toBe(true);
  });

  it("không có uỷ quyền ⇒ khối uỷ quyền rỗng, người dự phiên là chính mình", () => {
    const v = contractToFormValues(base);
    expect(v.attendee).toBe("self");
    expect(v.proxy.full_name).toBe("");
    expect(v.proxy.poa_doc_path).toBeNull();
  });
});

describe("groupIssues", () => {
  it("chia lỗi theo khối, giữ lỗi đầu tiên mỗi ô", () => {
    const schema = makeRegistrationSchema({ now: new Date("2026-10-08") });
    const values = contractToFormValues(withOrgAndProxy);
    const r = schema.safeParse({
      ...values,
      phone: "123",
      principal: { ...values.principal, full_name: "A" },
      organization: { ...values.organization, tax_code: "12" },
      proxy: { ...values.proxy, poa_doc_path: null },
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const g = groupIssues(r.error.issues);
    expect(Object.keys(g.root)).toEqual(["phone"]);
    expect(Object.keys(g.principal)).toEqual(["full_name"]);
    expect(Object.keys(g.organization)).toEqual(["tax_code"]);
    expect(Object.keys(g.proxy)).toEqual(["poa_doc_path"]);
    expect(hasIssues(g)).toBe(true);
  });

  it("không lỗi ⇒ hasIssues false", () => {
    expect(hasIssues(groupIssues([]))).toBe(false);
  });
});
